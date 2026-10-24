const pool = require("../config/db");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const COMMISSION_RATE = 0.10;
const REWARD_THRESHOLD = 250;

const PRODUCT_TABLES = {
    G: { table: "food_heepit", idCol: "gift_id", imageCol: "gift_image1" },
    S: { table: "shop_heepit", idCol: "shop_id", imageCol: "shop_image1" },
    M: { table: "medicine_heepit", idCol: "medicine_id", imageCol: "medicine_image1" },
    DEFAULT: { table: "cards_heepit", idCol: "product_id", imageCol: "product_image1" },
};

function getProductTable(productId) {
    const prefix = String(productId).charAt(0);
    return PRODUCT_TABLES[prefix] || PRODUCT_TABLES.DEFAULT;
}

function formatProcessingDate(d) {
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
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

async function getProductImage(product_id) {
    try {
        const { table, idCol, imageCol } = getProductTable(product_id);
        const [[row]] = await pool.query(
            `SELECT ${imageCol} AS image FROM ${table} WHERE ${idCol} = ? LIMIT 1`,
            [product_id]
        );
        return row?.image || "";
    } catch (err) {
        console.error("GET PRODUCT IMAGE ERROR:", err.message);
        return "";
    }
}

async function sendOrderStatusNotification(order_item_id, order_status) {
    try {
        const { sendNotificationToUser } = require("../utils/sendNotification");

        const [[item]] = await pool.query(
            `SELECT oi.order_item_id, oi.product_id, oi.product_name, o.user_id, o.order_id
             FROM order_items_heepit oi
             INNER JOIN orders_heepit o ON oi.order_id = o.order_id
             WHERE oi.order_item_id = ? LIMIT 1`,
            [order_item_id]
        );

        if (!item || !item.user_id) return;

        const image = await getProductImage(item.product_id);

        const statusMap = {
            PLACED: { title: "Order Placed ✅", body: `Your order "${item.product_name}" is placed.` },
            PACKED: { title: "Order Packed 📦", body: `Your order "${item.product_name}" has been packed.` },
            SHIPPED: { title: "Order Shipped 🚚", body: `Your order "${item.product_name}" has been shipped.` },
            OUT_FOR_DELIVERY: { title: "Out for Delivery 🛵", body: `Your order "${item.product_name}" is out for delivery.` },
            DELIVERED: { title: "Order Delivered 🎉", body: `Your order "${item.product_name}" has been delivered.` },
            REQUESTED: { title: "Cancel Request ❌", body: `Your cancel request for "${item.product_name}" has been submitted.` },
            PROCESSING: { title: "Cancel Processing ⏳", body: `Your cancel request for "${item.product_name}" is being processed.` },
            CANCELLED: { title: "Order Cancelled ❌", body: `Your order "${item.product_name}" has been cancelled.` },
            REFUND: { title: "Refund Initiated 💰", body: `Your refund for "${item.product_name}" has been initiated.` },
        };

        const notif = statusMap[order_status];
        if (!notif) return;

        await sendNotificationToUser(
            item.user_id,
            notif.title,
            notif.body,
            { order_id: String(item.order_id) },
            image
        );
    } catch (err) {
        console.error("SEND ORDER STATUS NOTIFICATION ERROR:", err.message);
    }
}

async function getAdminFromPostedBy(postedBy) {
    const [[admin]] = await pool.query(
        `SELECT id FROM heepitadmin WHERE username = ? LIMIT 1`,
        [postedBy]
    );
    return admin?.id || null;
}

async function getPostedByFromProduct(productId, productType) {
    const tableMap = {
        SHOP: { table: "shop_heepit", idCol: "shop_id" },
        CARD: { table: "cards_heepit", idCol: "product_id" },
    };

    const config = tableMap[productType];
    if (!config) return null;

    const [[row]] = await pool.query(
        `SELECT posted_by FROM ${config.table} WHERE ${config.idCol} = ? LIMIT 1`,
        [productId]
    );

    return row?.posted_by || null;
}

async function addCommission(adminId, order_item_id, sellAmount) {
    const commissionAmount = sellAmount * COMMISSION_RATE;

    const [existing] = await pool.query(
        `SELECT id FROM admin_commision WHERE item_id = ? LIMIT 1`,
        [order_item_id]
    );

    const isNewEntry = existing.length === 0;

    try {
        await pool.query(
            `INSERT INTO admin_commision
             (admin_id, item_id, commission, status, created_at, updated_at)
             VALUES (?, ?, ?, 0, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                commission = VALUES(commission),
                updated_at = NOW()`,
            [adminId, order_item_id, commissionAmount]
        );
    } catch (err) {
        console.error("COMMISSION SAVE ERROR:", err.message);
        return;
    }

    if (!isNewEntry) return;

    const currentMonth = MONTHS[new Date().getMonth()];

    const [[statsRow]] = await pool.query(
        `SELECT analysh FROM heepitadmin_stats WHERE admin_id = ? LIMIT 1`,
        [adminId]
    );

    const parts = (statsRow?.analysh || "").split(",").map((p) => p.trim()).filter(Boolean);
    const lastIdx = parts.length - 1;

    if (lastIdx >= 0 && parts[lastIdx].startsWith(currentMonth + "~")) {
        const oldVal = Number(parts[lastIdx].split("~")[1]) || 0;
        parts[lastIdx] = `${currentMonth}~${oldVal + sellAmount}`;
    } else {
        parts.push(`${currentMonth}~${sellAmount}`);
    }

    await pool.query(
        `UPDATE heepitadmin_stats
         SET sells = sells + ?,
             commission = commission + ?,
             delivered = delivered + 1,
             pending = GREATEST(pending - 1, 0),
             analysh = ?
         WHERE admin_id = ?`,
        [sellAmount, commissionAmount, parts.join(","), adminId]
    );
}

async function refundHypoPoints(order_id) {
    const [[orderRow]] = await pool.query(
        `SELECT user_id, is_hypo_used FROM orders_heepit WHERE order_id = ?`,
        [order_id]
    );

    if (!orderRow || orderRow.is_hypo_used !== 1) return;

    const [[rewardRow]] = await pool.query(
        `SELECT used_hypo FROM user_rewards_heepit WHERE user_id = ?`,
        [orderRow.user_id]
    );

    if (!rewardRow || rewardRow.used_hypo <= 0) return;

    await pool.query(
        `UPDATE user_rewards_heepit
         SET hypo_points = hypo_points + ?, used_hypo = 0
         WHERE user_id = ?`,
        [rewardRow.used_hypo, orderRow.user_id]
    );

    await pool.query(
        `UPDATE orders_heepit SET is_hypo_used = 0 WHERE order_id = ?`,
        [order_id]
    );
}

exports.getOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM order_items_heepit ORDER BY order_item_id DESC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getCancels = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.cancel_id, c.order_item_id, c.product_id, c.user_id,
                    c.product_category, c.quantity, c.cancel_reason, c.order_date,
                    c.payment_status, c.cancel_status, c.cancel_request_date,
                    oi.product_name, oi.product_image, oi.unit_price, oi.total_price,
                    oi.order_id, oi.order_status, oi.category,
                    COALESCE(s.posted_by, p.posted_by) AS posted_by
             FROM cancel_heepit c
             LEFT JOIN order_items_heepit oi ON c.order_item_id = oi.order_item_id
             LEFT JOIN shop_heepit s ON c.product_id = s.shop_id
             LEFT JOIN cards_heepit p ON c.product_id = p.product_id
             ORDER BY c.cancel_id DESC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateCancelStatus = async (req, res) => {
    try {
        const { cancel_id, cancel_status } = req.body;

        const [[cancelRow]] = await pool.query(
            `SELECT cancel_id, order_item_id, user_id
             FROM cancel_heepit WHERE cancel_id = ?`,
            [cancel_id]
        );

        if (!cancelRow)
            return res.status(404).json({ success: false, message: "Cancel record not found." });

        await pool.query(
            `UPDATE cancel_heepit SET cancel_status = ? WHERE cancel_id = ?`,
            [cancel_status, cancel_id]
        );

        await pool.query(
            `UPDATE order_items_heepit SET order_status = ? WHERE order_item_id = ?`,
            [cancel_status, cancelRow.order_item_id]
        );

        const [[itemRow]] = await pool.query(
            `SELECT order_id FROM order_items_heepit WHERE order_item_id = ?`,
            [cancelRow.order_item_id]
        );

        let order_updated = false;

        if (itemRow) {
            const order_id = itemRow.order_id;

            const [countRows] = await pool.query(
                `SELECT COUNT(*) AS total,
                        SUM(CASE WHEN order_status = ? THEN 1 ELSE 0 END) AS matching
                 FROM order_items_heepit WHERE order_id = ?`,
                [cancel_status, order_id]
            );

            const totalItems = Number(countRows[0].total || 0);
            const matchingItems = Number(countRows[0].matching || 0);

            if (totalItems > 0 && totalItems === matchingItems) {
                await pool.query(
                    `UPDATE orders_heepit SET order_status = ? WHERE order_id = ?`,
                    [cancel_status, order_id]
                );
                order_updated = true;

                if (cancel_status === "CANCELLED") {
                    await refundHypoPoints(order_id);
                }
            }
        }

        await sendOrderStatusNotification(cancelRow.order_item_id, cancel_status);

        return res.json({
            success: true,
            message: "Cancel status updated.",
            order_updated,
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { order_item_id, order_status } = req.body;

        const [[item]] = await pool.query(
            `SELECT product_id, order_id FROM order_items_heepit WHERE order_item_id = ?`,
            [order_item_id]
        );

        if (!item)
            return res.status(404).json({ success: false, message: "Item not found." });

        await pool.query(
            `UPDATE order_items_heepit SET order_status = ? WHERE order_item_id = ?`,
            [order_status, order_item_id]
        );

        await upsertProcessingStatus(order_item_id, order_status);

        if (order_status === "DELIVERED") {
            const [[itemFull]] = await pool.query(
                `SELECT product_id, product_type, total_price
                 FROM order_items_heepit WHERE order_item_id = ?`,
                [order_item_id]
            );

            if (itemFull && (itemFull.product_type === "SHOP" || itemFull.product_type === "CARD")) {
                const postedBy = await getPostedByFromProduct(itemFull.product_id, itemFull.product_type);

                if (postedBy) {
                    const adminId = await getAdminFromPostedBy(postedBy);
                    if (adminId) {
                        const sellAmount = Number(itemFull.total_price) || 0;
                        await addCommission(adminId, order_item_id, sellAmount);
                    }
                }
            }

            if (item.product_id.startsWith("G") || item.product_id.startsWith("S")) {
                const [[details]] = await pool.query(
                    `SELECT return_days FROM product_details_heepit WHERE product_id = ?`,
                    [item.product_id]
                );

                let returnDate = null;

                if (details && Number(details.return_days) > 0) {
                    returnDate = new Date();
                    returnDate.setDate(returnDate.getDate() + Number(details.return_days));
                }

                await pool.query(
                    `UPDATE order_items_heepit SET return_date = ? WHERE order_item_id = ?`,
                    [returnDate, order_item_id]
                );
            }
        }

        if (item.order_id) {
            const [countRows] = await pool.query(
                `SELECT COUNT(*) AS total,
                        SUM(CASE WHEN order_status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered,
                        SUM(CASE WHEN order_status != 'DELIVERED' THEN 1 ELSE 0 END) AS pending
                 FROM order_items_heepit WHERE order_id = ?`,
                [item.order_id]
            );

            const totalItems = Number(countRows[0].total || 0);
            const pendingItems = Number(countRows[0].pending || 0);

            if (totalItems > 0 && pendingItems === 0) {
                await pool.query(
                    `UPDATE orders_heepit SET order_status = 'DELIVERED' WHERE order_id = ?`,
                    [item.order_id]
                );

                const [pendingRewardItems] = await pool.query(
                    `SELECT COUNT(*) AS pending_count
                     FROM order_items_heepit oi
                     LEFT JOIN return_heepit r ON oi.order_item_id = r.order_item_id
                     WHERE oi.order_id = ?
                     AND (
                         (r.return_status IS NOT NULL AND r.return_status NOT IN ('NONE', ''))
                         OR
                         (oi.return_date IS NOT NULL AND oi.return_date >= NOW())
                     )`,
                    [item.order_id]
                );

                const pendingRewardCount = Number(pendingRewardItems[0]?.pending_count || 0);

                if (pendingRewardCount === 0) {
                    const [[valueRow]] = await pool.query(
                        `SELECT SUM(unit_price * quantity) AS total_value
                         FROM order_items_heepit WHERE order_id = ?`,
                        [item.order_id]
                    );

                    const totalValue = Number(valueRow?.total_value || 0);
                    const chances = Math.floor(totalValue / REWARD_THRESHOLD);

                    if (chances > 0) {
                        const [[orderRow]] = await pool.query(
                            `SELECT user_id FROM orders_heepit WHERE order_id = ?`,
                            [item.order_id]
                        );

                        if (orderRow?.user_id) {
                            const userId = orderRow.user_id;

                            const [existing] = await pool.query(
                                `SELECT id FROM user_rewards_heepit WHERE user_id = ? LIMIT 1`,
                                [userId]
                            );

                            if (existing.length > 0) {
                                await pool.query(
                                    `UPDATE user_rewards_heepit
                                     SET count = count + ?, updated_at = NOW()
                                     WHERE user_id = ?`,
                                    [chances, userId]
                                );
                            } else {
                                await pool.query(
                                    `INSERT INTO user_rewards_heepit
                                     (user_id, hypo_points, count, redeemed, updated_at)
                                     VALUES (?, 0, ?, 0, NOW())`,
                                    [userId, chances]
                                );
                            }
                        }
                    }
                }
            } else {
                await pool.query(
                    `UPDATE orders_heepit SET order_status = 'PLACED' WHERE order_id = ?`,
                    [item.order_id]
                );
            }
        }

        await sendOrderStatusNotification(order_item_id, order_status);

        return res.json({ success: true, message: "Order status updated." });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getOrdersWithUser = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT oi.*, o.order_id, o.user_id, o.address_id,
                    u.full_name AS customer_name, u.mobile_number AS customer_mobile,
                    u.whatsapp_number AS customer_whatsapp, u.email AS customer_email,
                    u.profile_image AS customer_image,
                    a.full_name AS address_name, a.mobile_number AS address_mobile,
                    a.house_flat, a.area_street, a.landmark, a.pincode, a.city, a.state,
                    a.latitude, a.longitude, a.address_type, a.is_primary
             FROM order_items_heepit oi
             LEFT JOIN orders_heepit o ON oi.order_id = o.order_id
             LEFT JOIN users_heepit u ON o.user_id = u.user_id
             LEFT JOIN user_address_heepit a ON o.address_id = a.address_id
             ORDER BY oi.order_item_id DESC`
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getAdminCommissions = async (req, res) => {
    try {
        const { admin_id } = req.params;

        if (!admin_id)
            return res.status(400).json({ success: false, message: "admin_id is required." });

        const [rows] = await pool.query(
            `SELECT ac.id, ac.admin_id, ac.item_id, ac.commission, ac.status,
                    ac.created_at, ac.updated_at,
                    oi.product_name, oi.product_id, oi.category, oi.quantity,
                    oi.total_price, oi.order_id, oi.order_status
             FROM admin_commision ac
             LEFT JOIN order_items_heepit oi ON ac.item_id = oi.order_item_id
             WHERE ac.admin_id = ?
             ORDER BY ac.id DESC`,
            [admin_id]
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "GET ADMIN COMMISSIONS ERROR:");
    }
};

exports.getAllCommissions = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ac.id, ac.admin_id, ac.item_id, ac.commission, ac.status,
                    ac.created_at, ac.updated_at,
                    oi.product_name, oi.product_id, oi.category, oi.quantity,
                    oi.total_price, oi.order_id, oi.order_status,
                    ha.username AS admin_username, ha.name AS admin_name
             FROM admin_commision ac
             LEFT JOIN order_items_heepit oi ON ac.item_id = oi.order_item_id
             LEFT JOIN heepitadmin ha ON ac.admin_id = ha.id
             ORDER BY ac.id DESC`
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "GET ALL COMMISSIONS ERROR:");
    }
};

exports.updateCommissionStatus = async (req, res) => {
    try {
        const { id, status } = req.body;

        if (!id)
            return res.status(400).json({ success: false, message: "id required." });

        await pool.query(
            `UPDATE admin_commision SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status ? 1 : 0, id]
        );

        return res.json({ success: true, message: "Status updated." });
    } catch (err) {
        return serverError(res, err, "UPDATE COMMISSION STATUS ERROR:");
    }
};