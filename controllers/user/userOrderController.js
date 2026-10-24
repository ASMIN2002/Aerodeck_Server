const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");
const { sendNotificationToUser } = require("../../utils/sendNotification");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const PRODUCT_TABLES = {
    G: { table: "food_heepit", idCol: "gift_id", type: "GIFT" },
    S: { table: "shop_heepit", idCol: "shop_id", type: "SHOP" },
    M: { table: "medicine_heepit", idCol: "medicine_id", type: "MEDICINE" },
    DEFAULT: { table: "cards_heepit", idCol: "product_id", type: "CARD" },
};

function getProductTable(productId) {
    const prefix = String(productId).charAt(0);
    return PRODUCT_TABLES[prefix] || PRODUCT_TABLES.DEFAULT;
}

function formatProcessingDate(d) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatMySQLDate(date) {
    if (!date) return null;
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 19).replace("T", " ");
}

async function authenticate(session_token) {
    if (!session_token) return null;
    return await getUserIdFromSession(session_token);
}

function unauthorized(res) {
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
}

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

async function safeNotify(user_id, title, body, data) {
    try {
        await sendNotificationToUser(user_id, title, body, data);
    } catch (err) {
        console.error("Notification error:", err.message);
    }
}

async function upsertProcessingStatus(item_id, order_status) {
    const todayStr = formatProcessingDate(new Date());
    const newEntry = `${order_status}~${todayStr}`;

    const [existing] = await pool.query(
        `SELECT id, processing_update FROM processing_updates WHERE item_id = ? LIMIT 1`,
        [item_id]
    );

    if (existing.length === 0) {
        await pool.query(
            `INSERT INTO processing_updates (item_id, processing_update) VALUES (?, ?)`,
            [item_id, newEntry]
        );
        return;
    }

    const current = existing[0].processing_update || "";
    const entries = current.split(",").map((s) => s.trim()).filter(Boolean);
    let found = false;

    const updatedEntries = entries.map((entry) => {
        const [status] = entry.split("~");
        if (status === order_status) {
            found = true;
            return newEntry;
        }
        return entry;
    });

    if (!found) updatedEntries.push(newEntry);

    await pool.query(
        `UPDATE processing_updates SET processing_update = ? WHERE id = ?`,
        [updatedEntries.join(","), existing[0].id]
    );
}

async function insertCancelRequest({
    order_item_id,
    product_id,
    user_id,
    product_category,
    quantity,
    cancel_reason,
    order_date,
    payment_status,
}) {
    const mysqlOrderDate = formatMySQLDate(order_date);
    const status = payment_status === "PARTIAL" ? "PAID" : payment_status;

    await pool.query(
        `INSERT INTO cancel_heepit (
            order_item_id, product_id, user_id, product_category, quantity,
            cancel_reason, order_date, payment_status, cancel_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [order_item_id, product_id, user_id, product_category, quantity, cancel_reason, mysqlOrderDate, status, "REQUESTED"]
    );

    await pool.query(
        `UPDATE order_items_heepit SET order_status = 'REQUESTED' WHERE order_item_id = ?`,
        [order_item_id]
    );
}

function buildProductMeta(item) {
    if (item.product_id.startsWith("G")) {
        return {
            productType: "GIFT",
            productName: item.gift_name,
            productImage: item.gift_image1,
            unitPrice: Number(item.gift_price),
            cancelDays: 3,
        };
    }
    if (item.product_id.startsWith("S")) {
        return {
            productType: "SHOP",
            productName: item.shop_name,
            productImage: item.shop_image1,
            unitPrice: Number(item.shop_price),
            cancelDays: 3,
        };
    }
    if (item.product_id.startsWith("M")) {
        return {
            productType: "MEDICINE",
            productName: item.medicine_name,
            productImage: item.medicine_image1,
            unitPrice: Number(item.medicine_price),
            cancelDays: 3,
        };
    }
    return {
        productType: "CARD",
        productName: item.card_name,
        productImage: item.card_image1,
        unitPrice: Number(item.card_price),
        cancelDays: 1,
    };
}

exports.placeOrder = async (req, res) => {
    try {
        const {
            session_token, address_id, payment_method, order_type, items,
            total_items, subtotal, gst, platform_fee, delivery_fee,
            total_amount, hypo_points_used,
        } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const orderNumber = "AD" + Date.now();
        const paymentStatus =
            payment_method === "COD" ? "PENDING" : order_type === "CARD" ? "PARTIAL" : "PAID";

        const [orderResult] = await pool.query(
            `INSERT INTO orders_heepit (
                order_number, user_id, order_type, total_items, subtotal, discount,
                gst, platform_fee, delivery_fee, total_amount, payment_method,
                payment_status, order_status, address_id, is_hypo_used
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderNumber, user_id,
                order_type === "PRODUCT" ? "PRODUCT" : "CARD",
                total_items, subtotal, 0, gst, platform_fee, delivery_fee,
                total_amount, payment_method, paymentStatus, "PLACED",
                address_id, hypo_points_used > 0 ? 1 : 0,
            ]
        );

        const order_id = orderResult.insertId;

        await pool.query(
            `INSERT INTO payment_heepit (order_id, user_id, payment_method, payment_status, amount)
             VALUES (?, ?, ?, ?, ?)`,
            [order_id, user_id, payment_method, paymentStatus, total_amount]
        );

        for (const item of items) {
            const meta = buildProductMeta(item);
            let productCategory = null;

            if (meta.productType === "SHOP") {
                const [shopRows] = await pool.query(
                    `SELECT shop_category, posted_by FROM shop_heepit WHERE shop_id = ? LIMIT 1`,
                    [item.product_id]
                );

                productCategory = shopRows.length ? shopRows[0].shop_category : null;

                if (shopRows.length && shopRows[0].posted_by) {
                    const [adminRows] = await pool.query(
                        `SELECT id FROM heepitadmin WHERE username = ? LIMIT 1`,
                        [shopRows[0].posted_by]
                    );
                    if (adminRows.length > 0) {
                        await pool.query(
                            `UPDATE heepitadmin_stats SET pending = pending + 1 WHERE admin_id = ?`,
                            [adminRows[0].id]
                        );
                    }
                }
            }

            if (meta.productType === "MEDICINE") {
                const [medRows] = await pool.query(
                    `SELECT medicine_category FROM medicine_heepit WHERE medicine_id = ? LIMIT 1`,
                    [item.product_id]
                );
                productCategory = medRows.length ? medRows[0].medicine_category : null;
            }

            const cancelDate = new Date(Date.now() + meta.cancelDays * 24 * 60 * 60 * 1000);

            const [itemResult] = await pool.query(
                `INSERT INTO order_items_heepit (
                    order_id, product_id, product_type, category, product_name,
                    product_image, unit_price, quantity, total_price,
                    order_status, payment_status, cancel_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    order_id, item.product_id, meta.productType, productCategory,
                    meta.productName, meta.productImage, meta.unitPrice, item.quantity,
                    meta.unitPrice * item.quantity, "PLACED", paymentStatus, cancelDate,
                ]
            );

            await upsertProcessingStatus(itemResult.insertId, "PLACED");

            await pool.query(
                `UPDATE order_items_heepit
                 SET payment_status = (SELECT payment_status FROM orders_heepit WHERE order_id = ?)
                 WHERE order_id = ?`,
                [order_id, order_id]
            );
        }

        for (const item of items) {
            await pool.query(
                `DELETE FROM user_cart_heepit WHERE user_id = ? AND product_id = ?`,
                [user_id, item.product_id]
            );
        }

        await safeNotify(
            user_id,
            "Order Placed ✅",
            `Your order #${order_id} has been placed successfully.`,
            { order_id: String(order_id) }
        );

        return res.json({
            success: true,
            message: "Order Placed Successfully",
            order_id,
            order_number: orderNumber,
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getOrders = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);
        if (!user_id) return unauthorized(res);

        const [rows] = await pool.query(
            `SELECT
                o.order_id, o.user_id, o.order_number, o.total_items, o.total_amount,
                o.order_status, o.payment_status, o.payment_method, o.created_at,
                o.address_id, o.is_hypo_used,
                a.full_name, a.mobile_number, a.house_flat, a.area_street,
                a.landmark, a.city, a.state, a.pincode, a.address_type
             FROM orders_heepit o
             LEFT JOIN user_address_heepit a ON o.address_id = a.address_id
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC`,
            [user_id]
        );

        if (!rows.length) return res.json({ success: true, data: [] });

        const orderIds = rows.map((o) => o.order_id);

        const [counts] = await pool.query(
            `SELECT order_id,
                COUNT(*) AS total,
                SUM(CASE WHEN order_status != 'CANCELLED' THEN 1 ELSE 0 END) AS available
             FROM order_items_heepit
             WHERE order_id IN (?)
             GROUP BY order_id`,
            [orderIds]
        );

        const countsMap = new Map(
            counts.map((c) => [c.order_id, { total: Number(c.total || 0), available: Number(c.available || 0) }])
        );

        const ordersToCancel = [];

        for (const order of rows) {
            const c = countsMap.get(order.order_id) || { total: 0, available: 0 };
            order.available_items = c.available;
            order.total_items = c.total;

            if (c.available === 0 && c.total > 0) {
                ordersToCancel.push(order.order_id);
                order.order_status = "CANCELLED";
            }
        }

        if (ordersToCancel.length) {
            await pool.query(
                `UPDATE orders_heepit SET order_status = 'CANCELLED' WHERE order_id IN (?)`,
                [ordersToCancel]
            );
        }

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const { order_id } = req.params;

        const [rows] = await pool.query(
            `SELECT
                oi.order_item_id, oi.product_id, oi.product_name, oi.product_image,
                oi.quantity, oi.unit_price, oi.total_price, oi.product_type,
                oi.order_status, oi.order_id, oi.created_at AS order_date,
                oi.payment_status, oi.cancel_date, oi.return_date,
                o.user_id, o.payment_status AS order_payment_status,
                o.created_at AS order_created_at, o.is_hypo_used,
                r.return_status, r.return_request_date
             FROM order_items_heepit oi
             INNER JOIN orders_heepit o ON oi.order_id = o.order_id
             LEFT JOIN return_heepit r ON oi.order_item_id = r.order_item_id
             WHERE oi.order_id = ?`,
            [order_id]
        );

        if (!rows.length) return res.json({ success: true, data: [] });

        const giftIds = [];
        const shopIds = [];
        const medicineIds = [];
        const cardIds = [];

        for (const item of rows) {
            const id = String(item.product_id);
            if (id.startsWith("G")) giftIds.push(id);
            else if (id.startsWith("S")) shopIds.push(id);
            else if (id.startsWith("M")) medicineIds.push(id);
            else cardIds.push(Number(id));
        }

        const [[gifts], [shops], [medicines], [cards]] = await Promise.all([
            giftIds.length
                ? pool.query(`SELECT * FROM food_heepit WHERE gift_id IN (?)`, [giftIds])
                : Promise.resolve([[]]),
            shopIds.length
                ? pool.query(`SELECT * FROM shop_heepit WHERE shop_id IN (?)`, [shopIds])
                : Promise.resolve([[]]),
            medicineIds.length
                ? pool.query(`SELECT * FROM medicine_heepit WHERE medicine_id IN (?)`, [medicineIds])
                : Promise.resolve([[]]),
            cardIds.length
                ? pool.query(`SELECT * FROM cards_heepit WHERE product_id IN (?)`, [cardIds])
                : Promise.resolve([[]]),
        ]);

        const giftsMap = new Map(gifts.map((g) => [String(g.gift_id), g]));
        const shopsMap = new Map(shops.map((s) => [String(s.shop_id), s]));
        const medicinesMap = new Map(medicines.map((m) => [String(m.medicine_id), m]));
        const cardsMap = new Map(cards.map((c) => [String(c.product_id), c]));

        const result = rows.map((item) => {
            const id = String(item.product_id);
            let product = null;
            let productData = {};

            if (id.startsWith("G")) {
                product = giftsMap.get(id);
                if (product) {
                    productData = {
                        product_name: product.gift_name,
                        product_description: product.gift_description,
                        product_price: product.gift_price,
                        product_image1: product.gift_image1,
                        product_image2: product.gift_image2,
                        product_image3: product.gift_image3,
                        product_image4: product.gift_image4,
                        product_rating: product.gift_rating,
                        product_status: product.gift_status,
                    };
                }
            } else if (id.startsWith("S")) {
                product = shopsMap.get(id);
                if (product) {
                    productData = {
                        product_name: product.shop_name,
                        product_description: product.shop_description,
                        product_price: product.shop_price,
                        product_image1: product.shop_image1,
                        product_image2: product.shop_image2,
                        product_image3: product.shop_image3,
                        product_image4: product.shop_image4,
                        product_rating: product.shop_rating,
                        product_status: product.shop_status,
                    };
                }
            } else if (id.startsWith("M")) {
                product = medicinesMap.get(id);
                if (product) {
                    productData = {
                        product_name: product.medicine_name,
                        product_description: product.medicine_description,
                        product_price: product.medicine_price,
                        product_image1: product.medicine_image1,
                        product_image2: product.medicine_image2,
                        product_image3: product.medicine_image3,
                        product_image4: null,
                        product_rating: product.medicine_rating,
                        product_status: product.medicine_status,
                    };
                }
            } else {
                product = cardsMap.get(id);
                if (product) {
                    productData = {
                        product_name: product.product_name,
                        product_description: product.product_description,
                        product_price: product.product_price,
                        product_image1: product.product_image1,
                        product_image2: product.product_image2,
                        product_image3: product.product_image3,
                        product_image4: product.product_image4,
                        product_rating: product.product_rating,
                        product_status: product.product_status,
                    };
                }
            }

            return { ...item, ...productData };
        });

        return res.json({ success: true, data: result });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateReturnDate = async (req, res) => {
    try {
        const { order_id, product_id } = req.body;

        const [rows] = await pool.query(
            `SELECT return_days FROM product_details_heepit WHERE product_id = ?`,
            [product_id]
        );

        let returnDate = null;

        if (rows.length && Number(rows[0].return_days) > 0) {
            returnDate = new Date();
            returnDate.setDate(returnDate.getDate() + Number(rows[0].return_days));
        }

        await pool.query(
            `UPDATE order_items_heepit
             SET return_date = ?, return_status = 'NONE'
             WHERE order_id = ? AND product_id = ?`,
            [returnDate, order_id, product_id]
        );

        return res.json({ success: true, message: "Return date updated." });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateOrderItemStatus = async (req, res) => {
    try {
        const { order_id, product_id, order_status } = req.body;

        await pool.query(
            `UPDATE order_items_heepit
             SET order_status = ?
             WHERE order_id = ? AND product_id = ?`,
            [order_status, order_id, product_id]
        );

        const [rows] = await pool.query(
            `SELECT COUNT(*) AS pending FROM order_items_heepit
             WHERE order_id = ? AND order_status != 'DELIVERED'`,
            [order_id]
        );

        const newStatus = rows[0].pending === 0 ? "COMPLETE" : "PLACED";

        await pool.query(
            `UPDATE orders_heepit SET order_status = ? WHERE order_id = ?`,
            [newStatus, order_id]
        );

        return res.json({ success: true, message: "Status Updated" });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const {
            order_item_id, product_id, user_id, product_category,
            quantity, order_date, payment_status, cancel_reason,
        } = req.body;

        await insertCancelRequest({
            order_item_id,
            product_id,
            user_id,
            product_category,
            quantity,
            cancel_reason,
            order_date,
            payment_status,
        });

        await safeNotify(
            user_id,
            "Cancel Request Submitted ❌",
            `Your cancel request for item #${order_item_id} has been submitted.`,
            { order_item_id: String(order_item_id) }
        );

        return res.json({ success: true, message: "Cancel request submitted.", cancel_status: "REQUESTED" });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getCancelStatus = async (req, res) => {
    try {
        const { order_item_id } = req.query;

        const [rows] = await pool.query(
            `SELECT cancel_status FROM cancel_heepit WHERE order_item_id = ? LIMIT 1`,
            [order_item_id]
        );

        return res.json({
            success: true,
            cancel_status: rows.length ? rows[0].cancel_status : "CANCEL",
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.returnProduct = async (req, res) => {
    try {
        const {
            order_item_id, user_id, order_id, product_id, quantity,
            return_reason, order_date, payment_status,
        } = req.body;

        const formattedOrderDate = formatMySQLDate(order_date);
        const status = payment_status !== "PAID" ? "PENDING" : payment_status;

        await pool.query(
            `INSERT INTO return_heepit (
                order_item_id, user_id, order_id, product_id, quantity,
                return_reason, order_date, payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [order_item_id, user_id, order_id, product_id, quantity, return_reason, formattedOrderDate, status]
        );

        return res.json({ success: true, message: "Return request submitted." });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.cancelWholeOrder = async (req, res) => {
    try {
        const { session_token, order_id, cancel_reason } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const [items] = await pool.query(
            `SELECT order_item_id, product_id, product_type, quantity, payment_status, created_at
             FROM order_items_heepit
             WHERE order_id = ? AND order_status NOT IN ('CANCELLED', 'DELIVERED')`,
            [order_id]
        );

        if (items.length === 0)
            return res.status(400).json({ success: false, message: "No items available to cancel." });

        for (const item of items) {
            await insertCancelRequest({
                order_item_id: item.order_item_id,
                product_id: item.product_id,
                user_id,
                product_category: item.product_type,
                quantity: item.quantity,
                cancel_reason,
                order_date: item.created_at,
                payment_status: item.payment_status,
            });
        }

        await pool.query(
            `UPDATE orders_heepit SET order_status = 'REQUESTED' WHERE order_id = ?`,
            [order_id]
        );

        await safeNotify(
            user_id,
            "Order Cancel Requested ❌",
            `Your cancel request for order #${order_id} has been submitted.`,
            { order_id: String(order_id) }
        );

        return res.json({
            success: true,
            message: "Order cancel request submitted.",
            items_cancelled: items.length,
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getUserInfoForAdmin = async (req, res) => {
    try {
        const { user_id } = req.params;

        if (!user_id)
            return res.status(400).json({ success: false, message: "user_id required." });

        const [[user]] = await pool.query(
            `SELECT user_id, full_name, mobile_number, whatsapp_number, email
             FROM users_heepit WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (!user)
            return res.status(404).json({ success: false, message: "User not found." });

        const [addresses] = await pool.query(
            `SELECT * FROM user_address_heepit
             WHERE user_id = ?
             ORDER BY is_primary DESC, address_id ASC`,
            [user_id]
        );

        return res.json({ success: true, user, addresses });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.adminPlaceOrder = async (req, res) => {
    try {
        const {
            user_id, address_id, product_id, quantity, unit_price,
            making_charges, payment_method, payment_status, advance_amount,
        } = req.body;

        if (!user_id || !address_id || !product_id || !quantity)
            return res.status(400).json({ success: false, message: "user_id, address_id, product_id and quantity are required." });

        const [[product]] = await pool.query(
            `SELECT * FROM cards_heepit WHERE product_id = ? LIMIT 1`,
            [product_id]
        );

        if (!product)
            return res.status(404).json({ success: false, message: "Product not found." });

        const qty = Number(quantity);
        const price = Number(unit_price) || Number(product.product_price) || 0;
        const making = Number(making_charges) || 0;

        const itemTotal = price * qty + making;
        const subtotal = itemTotal;
        const platformFee = 0;
        const gst = 0;
        const deliveryFee = 0;
        const totalAmount = subtotal + platformFee + gst + deliveryFee;

        const advance = Number(advance_amount) || 0;
        const remaining = Math.max(0, totalAmount - advance);

        let finalPaymentStatus = "PENDING";
        if (payment_status === "PAID") finalPaymentStatus = "PAID";
        else if (payment_status === "PARTIAL") finalPaymentStatus = "PARTIAL";

        const orderNumber = "AD" + Date.now();

        const [orderResult] = await pool.query(
            `INSERT INTO orders_heepit (
                order_number, user_id, order_type, total_items, subtotal, discount,
                gst, platform_fee, delivery_fee, total_amount, advance_amount,
                remaining_amount, payment_method, payment_status, order_status,
                address_id, is_hypo_used
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderNumber, user_id, "CARD", 1, subtotal, 0, gst, platformFee,
                deliveryFee, totalAmount, advance, remaining, payment_method,
                finalPaymentStatus, "PLACED", address_id, 0,
            ]
        );

        const order_id = orderResult.insertId;

        const [itemResult] = await pool.query(
            `INSERT INTO order_items_heepit (
                order_id, product_id, product_type, category, product_name,
                product_image, unit_price, quantity, total_price,
                order_status, payment_status, cancel_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order_id, product_id, "CARD", product.product_category,
                product.product_name, product.product_image1, price, qty,
                itemTotal, "PLACED", finalPaymentStatus,
                new Date(Date.now() + 24 * 60 * 60 * 1000),
            ]
        );

        await upsertProcessingStatus(itemResult.insertId, "PLACED");

        await pool.query(
            `INSERT INTO payment_heepit (order_id, user_id, payment_method, payment_status, amount)
             VALUES (?, ?, ?, ?, ?)`,
            [order_id, user_id, payment_method, finalPaymentStatus, advance > 0 ? advance : totalAmount]
        );

        await safeNotify(
            user_id,
            "Order Placed ✅",
            `Your order #${order_id} has been placed successfully.`,
            { order_id: String(order_id) }
        );

        return res.json({
            success: true,
            message: "Order placed successfully.",
            order_id,
            order_number: orderNumber,
        });
    } catch (err) {
        return serverError(res, err);
    }
};