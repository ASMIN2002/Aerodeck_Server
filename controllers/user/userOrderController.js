const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");


exports.placeOrder = async (req, res) => {

    try {
        const {

            session_token,
            address_id,
            payment_method,
            order_type,
            items,
            total_items,
            subtotal,
            gst,
            platform_fee,
            delivery_fee,
            total_amount,
            hypo_points_used

        } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({

                success: false,

                message: "Invalid or expired session."

            });

        }
        const orderNumber = "AD" + Date.now();

        const paymentStatus =
            payment_method === "COD"
                ? "PENDING"
                : order_type === "CARD"
                    ? "PARTIAL"
                    : "PAID";

        const [orderResult] = await pool.query(

            `INSERT INTO Orders_Aerodeck (
    order_number,
    user_id,
    order_type,
    total_items,
    subtotal,
    discount,
    gst,
    platform_fee,
    delivery_fee,
    total_amount,
    payment_method,
    payment_status,
    order_status,
    address_id,
    is_hypo_used
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                orderNumber,
                user_id,
                order_type === "PRODUCT" ? "PRODUCT" : "CARD",
                total_items,
                subtotal,
                0,
                gst,
                platform_fee,
                delivery_fee,
                total_amount,
                payment_method,
                paymentStatus,
                "PLACED",
                address_id,
                hypo_points_used > 0 ? 1 : 0

            ]

        );

        const order_id = orderResult.insertId;

        await pool.query(

            `INSERT INTO Payment_Aerodeck
    (
        order_id,
        user_id,
        payment_method,
        payment_status,
        amount
    )
    VALUES
    (?,?,?,?,?)`,

            [
                order_id,
                user_id,
                payment_method,
                paymentStatus,
                total_amount
            ]

        );

        for (const item of items) {

            let productType = "";
            let productName = "";
            let productImage = "";
            let unitPrice = 0;
            let cancelDate = null;
            let productCategory = null;

            if (item.product_id.startsWith("G")) {

                productType = "GIFT";
                productName = item.gift_name;
                productImage = item.gift_image1;
                unitPrice = Number(item.gift_price);
                cancelDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

            } else if (item.product_id.startsWith("S")) {

                productType = "SHOP";
                productName = item.shop_name;
                productImage = item.shop_image1;
                unitPrice = Number(item.shop_price);
                cancelDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

                const [shopRows] = await pool.query(
                    `SELECT shop_category, posted_by FROM Shop_Aerodeck WHERE shop_id = ? LIMIT 1`,
                    [item.product_id]
                );

                productCategory = shopRows.length ? shopRows[0].shop_category : null;

                /* ============================================
                   UPDATE PENDING COUNT IN STATS
                   ============================================ */
                if (shopRows.length && shopRows[0].posted_by) {

                    const postedBy = shopRows[0].posted_by;

                    const [adminRows] = await pool.query(
                        `SELECT id FROM heepitadmin WHERE username = ? LIMIT 1`,
                        [postedBy]
                    );

                    if (adminRows.length > 0) {

                        await pool.query(
                            `UPDATE heepitadmin_stats
                             SET pending = pending + 1
                             WHERE admin_id = ?`,
                            [adminRows[0].id]
                        );

                    }

                }

            } else {

                productType = "CARD";
                productName = item.card_name;
                productImage = item.card_image1;
                unitPrice = Number(item.card_price);
                cancelDate = new Date(
                    Date.now() + 24 * 60 * 60 * 1000
                );

            }

            await pool.query(

                `INSERT INTO Order_Items_Aerodeck (
    order_id,
    product_id,
    product_type,
    category,
    product_name,
    product_image,
    unit_price,
    quantity,
    total_price,
    order_status,
    payment_status,
    cancel_date
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

                [
                    order_id,
                    item.product_id,
                    productType,
                    productCategory,
                    productName,
                    productImage,
                    unitPrice,
                    item.quantity,
                    unitPrice * item.quantity,
                    "PLACED",
                    paymentStatus,
                    cancelDate
                ]

            );

            await pool.query(

                `UPDATE Order_Items_Aerodeck
     SET payment_status = (
         SELECT payment_status
         FROM Orders_Aerodeck
         WHERE order_id = ?
     )
     WHERE order_id = ?`,

                [
                    order_id,
                    order_id
                ]

            );

            const invoiceNumber =
                `AJDD${new Date().getFullYear()}${String(order_id).padStart(6, "0")}-${item.product_id}`;

            const gstPercentage = 18;
            const gstAmount = (unitPrice * item.quantity * gstPercentage) / 100;
            const totalAmount = (unitPrice * item.quantity) + gstAmount;

            await pool.query(

                `INSERT INTO Invoice_Aerodeck
    (
        invoice_number,
        order_id,
        order_number,
        user_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        gst_percentage,
        gst_amount,
        total_amount,
        gstin_number
    )
    VALUES
    (?,?,?,?,?,?,?,?,?,?,?,?)`,

                [
                    invoiceNumber,
                    order_id,
                    orderNumber,
                    user_id,
                    item.product_id,
                    productName,
                    item.quantity,
                    unitPrice,
                    gstPercentage,
                    gstAmount,
                    totalAmount,
                    "21ABCDE1234F1Z5"
                ]

            );

        }

        for (const item of items) {

            await pool.query(

                `DELETE FROM User_Cart_Aerodeck
         WHERE user_id = ?
         AND product_id = ?`,

                [
                    user_id,
                    item.product_id
                ]

            );

        }

        res.json({

            success: true,

            message: "Order Placed Successfully",

            order_id,

            order_number: orderNumber

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }

};
exports.getOrders = async (req, res) => {

    try {

        const { session_token } = req.query;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({

                success: false,

                message: "Invalid or expired session."

            });

        }

        const [rows] = await pool.query(

            `SELECT

                o.order_id,
                o.user_id,
                o.order_number,
                o.total_items,
                o.total_amount,
                o.order_status,
                o.payment_status,
                o.payment_method,
                o.created_at,
                o.address_id,
                o.is_hypo_used, 

                a.full_name,
                a.mobile_number,
                a.house_flat,
                a.area_street,
                a.landmark,
                a.city,
                a.state,
                a.pincode,
                a.address_type

            FROM Orders_Aerodeck o

            LEFT JOIN User_Address_Aerodeck a
            ON o.address_id = a.address_id

            WHERE o.user_id = ?

            ORDER BY o.created_at DESC`,

            [user_id]

        );
        for (const order of rows) {

            const [[count]] = await pool.query(

                `SELECT
            COUNT(*) AS total,
            SUM(
                CASE
                    WHEN order_status != 'CANCELLED'
                    THEN 1
                    ELSE 0
                END
            ) AS available
         FROM Order_Items_Aerodeck
         WHERE order_id = ?`,

                [order.order_id]

            );

            order.available_items = Number(count.available || 0);
            order.total_items = Number(count.total || 0);

            if (order.available_items === 0 && order.total_items > 0) {

                await pool.query(

                    `UPDATE Orders_Aerodeck
             SET order_status = 'CANCELLED'
             WHERE order_id = ?`,

                    [order.order_id]

                );

                order.order_status = "CANCELLED";

            }

        }

        res.json({

            success: true,
            data: rows

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: "Internal Server Error"

        });

    }

};
exports.getOrderDetails = async (req, res) => {

    try {

        const { order_id } = req.params;

        const [rows] = await pool.query(

            `SELECT
    oi.order_item_id,
    oi.product_id,
    oi.product_name,
    oi.product_image,
    oi.quantity,
    oi.unit_price,
    oi.total_price,
    oi.product_type,
    oi.order_status,
    oi.order_id,
    oi.created_at AS order_date,
    oi.payment_status,
    oi.cancel_date,
    oi.return_date,
    o.user_id,
    o.payment_status AS order_payment_status,
    o.created_at AS order_created_at,
    o.is_hypo_used,
    r.return_status,
    r.return_request_date

FROM Order_Items_Aerodeck oi

INNER JOIN Orders_Aerodeck o
ON oi.order_id = o.order_id

LEFT JOIN Return_Aerodeck r
ON oi.order_item_id = r.order_item_id

WHERE oi.order_id = ?`,

            [order_id]

        );

        const result = [];

        for (const item of rows) {

            let table = "";

            if (item.product_id.startsWith("G")) {

                table = "Gifts_Aerodeck";

            } else if (item.product_id.startsWith("S")) {

                table = "Shop_Aerodeck";

            } else if (item.product_id.startsWith("P")) {

                table = "Premium_Aerodeck";

            } else {

                table = "Products_Aerodeck";

            }

            if (!table) {

                result.push(item);
                continue;

            }

            let idColumn = "";

            if (item.product_id.startsWith("G")) {

                idColumn = "gift_id";

            } else if (item.product_id.startsWith("S")) {

                idColumn = "shop_id";

            } else if (item.product_id.startsWith("P")) {

                idColumn = "premium_id";

            } else {

                idColumn = "product_id";

            }

            const [product] = await pool.query(

                `SELECT * FROM ${table} WHERE ${idColumn} = ?`,

                [item.product_id]

            );
            if (item.product_id.startsWith("G")) {

                result.push({

                    ...item,

                    product_name: product[0].gift_name,
                    product_description: product[0].gift_description,
                    product_price: product[0].gift_price,

                    product_image1: product[0].gift_image1,
                    product_image2: product[0].gift_image2,
                    product_image3: product[0].gift_image3,
                    product_image4: product[0].gift_image4,

                    product_rating: product[0].gift_rating,
                    product_status: product[0].gift_status

                });

            } else if (item.product_id.startsWith("S")) {

                result.push({

                    ...item,

                    product_name: product[0].shop_name,
                    product_description: product[0].shop_description,
                    product_price: product[0].shop_price,

                    product_image1: product[0].shop_image1,
                    product_image2: product[0].shop_image2,
                    product_image3: product[0].shop_image3,
                    product_image4: product[0].shop_image4,

                    product_rating: product[0].shop_rating,
                    product_status: product[0].shop_status

                });

            } else if (item.product_id.startsWith("P")) {

                result.push({

                    ...item,

                    product_name: product[0].premium_name,
                    product_description: product[0].premium_description,
                    product_price: product[0].premium_price,

                    product_image1: product[0].premium_image1,
                    product_image2: product[0].premium_image2,
                    product_image3: product[0].premium_image3,
                    product_image4: product[0].premium_image4,

                    product_rating: product[0].premium_rating,
                    product_status: product[0].premium_status

                });

            } else {

                result.push({

                    ...item,

                    product_name: product[0].product_name,
                    product_description: product[0].product_description,
                    product_price: product[0].product_price,

                    product_image1: product[0].product_image1,
                    product_image2: product[0].product_image2,
                    product_image3: product[0].product_image3,
                    product_image4: product[0].product_image4,

                    product_rating: product[0].product_rating,
                    product_status: product[0].product_status

                });

            }
        }

        res.json({

            success: true,

            data: result

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Internal Server Error"

        });

    }

};
exports.updateReturnDate = async (req, res) => {

    try {

        const { order_id, product_id } = req.body;

        const [rows] = await pool.query(
            `
            SELECT return_days
            FROM User_Product_Detail
            WHERE product_id = ?
            `,
            [product_id]
        );

        let returnDate = null;

        if (rows.length && Number(rows[0].return_days) > 0) {

            returnDate = new Date();

            returnDate.setDate(
                returnDate.getDate() + Number(rows[0].return_days)
            );

        }

        await pool.query(
            `
            UPDATE Order_Items_Aerodeck
            SET
                return_date = ?,
                return_status = 'NONE'
            WHERE
                order_id = ?
                AND product_id = ?
            `,
            [
                returnDate,
                order_id,
                product_id
            ]
        );

        res.json({
            success: true,
            message: "Return date updated."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};
exports.updateOrderItemStatus = async (req, res) => {

    try {

        const { order_id, product_id, order_status } = req.body;

        // Item status update

        await pool.query(
            `UPDATE Order_Items_Aerodeck
             SET order_status = ?
             WHERE order_id = ?
             AND product_id = ?`,
            [order_status, order_id, product_id]
        );
        // Check remaining items

        const [rows] = await pool.query(
            `SELECT COUNT(*) AS pending
             FROM Order_Items_Aerodeck
             WHERE order_id = ?
             AND order_status != 'DELIVERED'`,
            [order_id]
        );

        // If all delivered -> complete order

        if (rows[0].pending === 0) {

            await pool.query(
                `UPDATE Orders_Aerodeck
         SET order_status = 'COMPLETE'
         WHERE order_id = ?`,
                [order_id]
            );

        } else {

            await pool.query(
                `UPDATE Orders_Aerodeck
         SET order_status = 'PLACED'
         WHERE order_id = ?`,
                [order_id]
            );

        }

        res.json({
            success: true,
            message: "Status Updated"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

exports.cancelOrder = async (req, res) => {

    try {

        const {
            order_item_id,
            product_id,
            user_id,
            product_category,
            quantity,
            order_date,
            payment_status,
            cancel_reason
        } = req.body;


        let mysqlOrderDate = null;

        if (order_date) {
            const parsed = new Date(order_date);
            if (!isNaN(parsed.getTime())) {
                mysqlOrderDate = parsed
                    .toISOString()
                    .slice(0, 19)
                    .replace("T", " ");
            }
        }

        let paymentStatus = payment_status;

        if (paymentStatus === "PARTIAL") {
            paymentStatus = "PAID";
        }
        const cancelStatus = "REQUESTED";


        await pool.query(

            `INSERT INTO Cancel_Aerodeck
(
    order_item_id,
    product_id,
    user_id,
    product_category,
    quantity,
    cancel_reason,
    order_date,
    payment_status,
    cancel_status
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                order_item_id,
                product_id,
                user_id,
                product_category,
                quantity,
                cancel_reason,
                mysqlOrderDate,
                paymentStatus,
                cancelStatus
            ]

        );


        await pool.query(
            `UPDATE Order_Items_Aerodeck
SET order_status = 'REQUESTED'
WHERE order_item_id = ?`,
            [order_item_id]
        );

        res.json({

            success: true,
            message: "Cancel request submitted.",
            cancel_status: "REQUESTED"

        });


    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};
exports.getCancelStatus = async (req, res) => {

    const { order_item_id } = req.query;

    const [rows] = await pool.query(
        `SELECT cancel_status
FROM Cancel_Aerodeck
WHERE order_item_id = ?
LIMIT 1`,
        [order_item_id]
    );

    res.json({
        success: true,
        cancel_status: rows.length
            ? rows[0].cancel_status
            : "CANCEL"
    });

};
exports.returnProduct = async (req, res) => {

    try {

        const {
            order_item_id,
            user_id,
            order_id,
            product_id,
            quantity,
            return_reason,
            order_date,
            payment_status

        } = req.body;

        const formattedOrderDate = new Date(order_date)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");

        let paymentStatus = payment_status;

        if (paymentStatus !== "PAID") {

            paymentStatus = "PENDING";

        }

        await pool.query(

            `INSERT INTO Return_Aerodeck
    (
        order_item_id,
        user_id,
        order_id,
        product_id,
        quantity,
        return_reason,
        order_date,
        payment_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                order_item_id,
                user_id,
                order_id,
                product_id,
                quantity,
                return_reason,
                formattedOrderDate,
                "PENDING"
            ]

        );
        res.json({

            success: true,
            message: "Return request submitted."

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

exports.cancelWholeOrder = async (req, res) => {

    try {

        const {
            session_token,
            order_id,
            cancel_reason
        } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        /* ============================================
           1. GET ALL CANCELABLE ITEMS
           ============================================ */
        const [items] = await pool.query(
            `SELECT
                order_item_id,
                product_id,
                product_type,
                quantity,
                payment_status,
                created_at
             FROM Order_Items_Aerodeck
             WHERE order_id = ?
             AND order_status NOT IN ('CANCELLED', 'DELIVERED')`,
            [order_id]
        );

        if (items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No items available to cancel."
            });
        }

        /* ============================================
           2. LOOP — CANCEL EACH ITEM
           ============================================ */
        for (const item of items) {

            let mysqlOrderDate = null;

            if (item.created_at) {
                const parsed = new Date(item.created_at);
                if (!isNaN(parsed.getTime())) {
                    mysqlOrderDate = parsed
                        .toISOString()
                        .slice(0, 19)
                        .replace("T", " ");
                }
            }

            let paymentStatus = item.payment_status;

            if (paymentStatus === "PARTIAL") {
                paymentStatus = "PAID";
            }

            /* 2a. Insert into Cancel_Aerodeck */
            await pool.query(
                `INSERT INTO Cancel_Aerodeck
                (
                    order_item_id,
                    product_id,
                    user_id,
                    product_category,
                    quantity,
                    cancel_reason,
                    order_date,
                    payment_status,
                    cancel_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.order_item_id,
                    item.product_id,
                    user_id,
                    item.product_type,
                    item.quantity,
                    cancel_reason,
                    mysqlOrderDate,
                    paymentStatus,
                    "REQUESTED"
                ]
            );

            /* 2b. Update item status */
            await pool.query(
                `UPDATE Order_Items_Aerodeck
                 SET order_status = 'REQUESTED'
                 WHERE order_item_id = ?`,
                [item.order_item_id]
            );

        }

        /* ============================================
           3. UPDATE ORDER STATUS
           ============================================ */
        await pool.query(
            `UPDATE Orders_Aerodeck
             SET order_status = 'REQUESTED'
             WHERE order_id = ?`,
            [order_id]
        );

        res.json({
            success: true,
            message: "Order cancel request submitted.",
            items_cancelled: items.length
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};
/* ============================================
   GET USER INFO + ALL ADDRESSES (Admin)
   ============================================ */
exports.getUserInfoForAdmin = async (req, res) => {
    try {
        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: "user_id required."
            });
        }

        /* User info */
        const [[user]] = await pool.query(
            `SELECT user_id, full_name, mobile_number, whatsapp_number, email
             FROM User_Aerodeck
             WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        /* All addresses */
        const [addresses] = await pool.query(
            `SELECT * FROM User_Address_Aerodeck
             WHERE user_id = ?
             ORDER BY is_primary DESC, address_id ASC`,
            [user_id]
        );

        return res.json({
            success: true,
            user,
            addresses
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.adminPlaceOrder = async (req, res) => {
    try {
        const {
            user_id,
            address_id,
            product_id,
            quantity,
            unit_price,
            making_charges,
            payment_method,
            payment_status,
            advance_amount
        } = req.body;

        if (!user_id || !address_id || !product_id || !quantity) {
            return res.status(400).json({
                success: false,
                message: "user_id, address_id, product_id and quantity are required."
            });
        }

        /* Product fetch */
        const [[product]] = await pool.query(
            `SELECT * FROM Products_Aerodeck
             WHERE product_id = ? LIMIT 1`,
            [product_id]
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const qty = Number(quantity);
        const price = Number(unit_price) || Number(product.product_price) || 0;
        const making = Number(making_charges) || 0;

        const itemTotal = (price * qty) + making;
        const subtotal = itemTotal;
        const platformFee = 0;
        const gst = 0;
        const deliveryFee = 0;
        const totalAmount = subtotal + platformFee + gst + deliveryFee;

        /* Advance / remaining */
        const advance = Number(advance_amount) || 0;
        const remaining = Math.max(0, totalAmount - advance);

        /* Payment status */
        let finalPaymentStatus = payment_status || "PENDING";
        if (payment_status === "PAID") {
            finalPaymentStatus = "PAID";
        } else if (payment_status === "PARTIAL") {
            finalPaymentStatus = "PARTIAL";
        }

        const orderNumber = "AD" + Date.now();

        /* 1. Insert order */
        const [orderResult] = await pool.query(
            `INSERT INTO Orders_Aerodeck (
                order_number, user_id, order_type, total_items,
                subtotal, discount, gst, platform_fee, delivery_fee,
                total_amount, advance_amount, remaining_amount,
                payment_method, payment_status, order_status,
                address_id, is_hypo_used
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderNumber,
                user_id,
                "CARD",
                1,
                subtotal,
                0,
                gst,
                platformFee,
                deliveryFee,
                totalAmount,
                advance,
                remaining,
                payment_method,
                finalPaymentStatus,
                "PLACED",
                address_id,
                0
            ]
        );

        const order_id = orderResult.insertId;

        /* 2. Order item */
        await pool.query(
            `INSERT INTO Order_Items_Aerodeck (
                order_id, product_id, product_type, category,
                product_name, product_image, unit_price, quantity,
                total_price, order_status, payment_status, cancel_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order_id,
                product_id,
                "CARD",
                product.product_category,
                product.product_name,
                product.product_image1,
                price,
                qty,
                itemTotal,
                "PLACED",
                finalPaymentStatus,
                new Date(Date.now() + 24 * 60 * 60 * 1000)
            ]
        );

        /* 3. Payment row */
        await pool.query(
            `INSERT INTO Payment_Aerodeck
             (order_id, user_id, payment_method, payment_status, amount)
             VALUES (?, ?, ?, ?, ?)`,
            [order_id, user_id, payment_method, finalPaymentStatus, advance > 0 ? advance : totalAmount]
        );

        return res.json({
            success: true,
            message: "Order placed successfully.",
            order_id,
            order_number: orderNumber
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};