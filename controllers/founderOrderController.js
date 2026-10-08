const pool = require("../config/db");

exports.getOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT *
            FROM Order_Items_Aerodeck
            ORDER BY order_item_id DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getCancels = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                c.cancel_id,
                c.order_item_id,
                c.product_id,
                c.user_id,
                c.product_category,
                c.quantity,
                c.cancel_reason,
                c.order_date,
                c.payment_status,
                c.cancel_status,
                c.cancel_request_date,

                oi.product_name,
                oi.product_image,
                oi.unit_price,
                oi.total_price,
                oi.order_id,
                oi.order_status,
                oi.category,

                s.posted_by

             FROM Cancel_Aerodeck c

             LEFT JOIN Order_Items_Aerodeck oi
                ON c.order_item_id = oi.order_item_id

             LEFT JOIN Shop_Aerodeck s
                ON c.product_id = s.shop_id

             ORDER BY c.cancel_id DESC`
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.updateCancelStatus = async (req, res) => {
    try {
        const { cancel_id, cancel_status } = req.body;

        const [[cancelRow]] = await pool.query(
            `SELECT cancel_id, order_item_id, user_id
             FROM Cancel_Aerodeck
             WHERE cancel_id = ?`,
            [cancel_id]
        );

        if (!cancelRow) {
            return res.status(404).json({
                success: false,
                message: "Cancel record not found."
            });
        }

        await pool.query(
            `UPDATE Cancel_Aerodeck
             SET cancel_status = ?
             WHERE cancel_id = ?`,
            [cancel_status, cancel_id]
        );

        await pool.query(
            `UPDATE Order_Items_Aerodeck
             SET order_status = ?
             WHERE order_item_id = ?`,
            [cancel_status, cancelRow.order_item_id]
        );

        const [[itemRow]] = await pool.query(
            `SELECT order_id
             FROM Order_Items_Aerodeck
             WHERE order_item_id = ?`,
            [cancelRow.order_item_id]
        );

        if (!itemRow) {
            return res.json({
                success: true,
                message: "Cancel status updated."
            });
        }

        const order_id = itemRow.order_id;

        const [countRows] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN order_status = ? THEN 1 ELSE 0 END) AS matching
             FROM Order_Items_Aerodeck
             WHERE order_id = ?`,
            [cancel_status, order_id]
        );

        const totalItems = Number(countRows[0].total || 0);
        const matchingItems = Number(countRows[0].matching || 0);

        if (totalItems > 0 && totalItems === matchingItems) {

            await pool.query(
                `UPDATE Orders_Aerodeck
                 SET order_status = ?
                 WHERE order_id = ?`,
                [cancel_status, order_id]
            );

            if (cancel_status === "CANCELLED") {

                const [[orderRow]] = await pool.query(
                    `SELECT user_id, is_hypo_used
                     FROM Orders_Aerodeck
                     WHERE order_id = ?`,
                    [order_id]
                );

                if (orderRow && orderRow.is_hypo_used === 1) {

                    const [[rewardRow]] = await pool.query(
                        `SELECT used_hypo
                         FROM USER_REWARDS
                         WHERE user_id = ?`,
                        [orderRow.user_id]
                    );

                    if (rewardRow && rewardRow.used_hypo > 0) {

                        const refundPoints = rewardRow.used_hypo;

                        await pool.query(
                            `UPDATE USER_REWARDS
                             SET hypo_points = hypo_points + ?,
                                 used_hypo = 0
                             WHERE user_id = ?`,
                            [refundPoints, orderRow.user_id]
                        );

                        await pool.query(
                            `UPDATE Orders_Aerodeck
                             SET is_hypo_used = 0
                             WHERE order_id = ?`,
                            [order_id]
                        );
                    }
                }
            }
        }

        res.json({
            success: true,
            message: "Cancel status updated.",
            order_updated: totalItems === matchingItems
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { order_item_id, order_status } = req.body;

        const [[item]] = await pool.query(
            `SELECT product_id, order_id
             FROM Order_Items_Aerodeck
             WHERE order_item_id = ?`,
            [order_item_id]
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found."
            });
        }

        await pool.query(
            `UPDATE Order_Items_Aerodeck
             SET order_status = ?
             WHERE order_item_id = ?`,
            [order_status, order_item_id]
        );

        /* ============================================
           STATS + COMMISSION — SHOP item DELIVERED hone pe
           ============================================ */
        if (order_status === "DELIVERED") {

            const [[itemFull]] = await pool.query(
                `SELECT product_id, product_type, total_price
                 FROM Order_Items_Aerodeck
                 WHERE order_item_id = ?`,
                [order_item_id]
            );

            if (itemFull && itemFull.product_type === "SHOP") {

                const [shopRows] = await pool.query(
                    `SELECT posted_by FROM Shop_Aerodeck 
                     WHERE shop_id = ? LIMIT 1`,
                    [itemFull.product_id]
                );

                if (shopRows.length > 0 && shopRows[0].posted_by) {

                    const postedBy = shopRows[0].posted_by;

                    const [adminRows] = await pool.query(
                        `SELECT id FROM heepitadmin 
                         WHERE username = ? LIMIT 1`,
                        [postedBy]
                    );

                    if (adminRows.length > 0) {

                        const adminId = adminRows[0].id;
                        const sellAmount = Number(itemFull.total_price) || 0;
                        const commissionAmount = sellAmount * 0.10;

                        /* ---- Check — already inserted? ---- */
                        const [existingComm] = await pool.query(
                            `SELECT id FROM admin_comm 
                             WHERE item_id = ? LIMIT 1`,
                            [order_item_id]
                        );

                        const isNewEntry = existingComm.length === 0;

                        /* ---- Insert / Update admin_comm ---- */
                        try {
                            await pool.query(
                                `INSERT INTO admin_comm
                                 (admin_id, item_id, commission, status, created_at, updated_at)
                                 VALUES (?, ?, ?, 0, NOW(), NOW())
                                 ON DUPLICATE KEY UPDATE
                                    commission = VALUES(commission),
                                    updated_at = NOW()`,
                                [adminId, order_item_id, commissionAmount]
                            );
                        } catch (commErr) {
                            console.log("COMMISSION SAVE ERROR:", commErr);
                        }

                        /* ---- Stats update — sirf agar nayi entry hai ---- */
                        if (isNewEntry) {

                            const monthNames = [
                                "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                                "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
                            ];
                            const currentMonth =
                                monthNames[new Date().getMonth()];

                            const [[statsRow]] = await pool.query(
                                `SELECT analysh FROM heepitadmin_stats
                                 WHERE admin_id = ?
                                 LIMIT 1`,
                                [adminId]
                            );

                            let analyshStr = statsRow?.analysh || "";

                            const parts = analyshStr
                                .split(",")
                                .map((p) => p.trim())
                                .filter(Boolean);

                            const lastIdx = parts.length - 1;

                            if (
                                lastIdx >= 0 &&
                                parts[lastIdx].startsWith(currentMonth + "~")
                            ) {
                                const oldVal =
                                    Number(parts[lastIdx].split("~")[1]) || 0;
                                const newVal = oldVal + sellAmount;

                                parts[lastIdx] =
                                    `${currentMonth}~${newVal}`;
                            } else {
                                parts.push(
                                    `${currentMonth}~${sellAmount}`
                                );
                            }

                            analyshStr = parts.join(",");

                            await pool.query(
                                `UPDATE heepitadmin_stats
                                 SET sells = sells + ?,
                                     commission = commission + ?,
                                     delivered = delivered + 1,
                                     pending = GREATEST(pending - 1, 0),
                                     analysh = ?
                                 WHERE admin_id = ?`,
                                [
                                    sellAmount,
                                    commissionAmount,
                                    analyshStr,
                                    adminId
                                ]
                            );
                        }
                    }
                }
            }
        }

        /* ============================================
           RETURN DATE LOGIC
           ============================================ */
        if (
            order_status === "DELIVERED" &&
            (item.product_id.startsWith("G") ||
                item.product_id.startsWith("S"))
        ) {

            const [[details]] = await pool.query(
                `SELECT return_days
                 FROM User_Product_Detail
                 WHERE product_id = ?`,
                [item.product_id]
            );

            let returnDate = null;

            if (details && Number(details.return_days) > 0) {
                returnDate = new Date();
                returnDate.setDate(
                    returnDate.getDate() + Number(details.return_days)
                );
            }

            await pool.query(
                `UPDATE Order_Items_Aerodeck
                 SET return_date = ?
                 WHERE order_item_id = ?`,
                [returnDate, order_item_id]
            );
        }

        /* ============================================
           ORDER STATUS UPDATE + REWARDS
           ============================================ */
        if (item.order_id) {

            const [countRows] = await pool.query(
                `SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN order_status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered,
                    SUM(CASE WHEN order_status != 'DELIVERED' THEN 1 ELSE 0 END) AS pending
                 FROM Order_Items_Aerodeck
                 WHERE order_id = ?`,
                [item.order_id]
            );

            const totalItems = Number(countRows[0].total || 0);
            const pendingItems = Number(countRows[0].pending || 0);

            if (totalItems > 0 && pendingItems === 0) {

                await pool.query(
                    `UPDATE Orders_Aerodeck
                     SET order_status = 'DELIVERED'
                     WHERE order_id = ?`,
                    [item.order_id]
                );

                const [pendingRewardItems] = await pool.query(
                    `SELECT COUNT(*) AS pending_count
                     FROM Order_Items_Aerodeck oi
                     LEFT JOIN Return_Aerodeck r 
                        ON oi.order_item_id = r.order_item_id
                     WHERE oi.order_id = ?
                     AND (
                         (r.return_status IS NOT NULL 
                          AND r.return_status NOT IN ('NONE', ''))
                         OR
                         (
                             oi.return_date IS NOT NULL
                             AND oi.return_date >= NOW()
                         )
                     )`,
                    [item.order_id]
                );

                const pendingRewardCount = Number(
                    pendingRewardItems[0]?.pending_count || 0
                );

                if (pendingRewardCount === 0) {

                    const [[valueRow]] = await pool.query(
                        `SELECT SUM(unit_price * quantity) AS total_value
                         FROM Order_Items_Aerodeck
                         WHERE order_id = ?`,
                        [item.order_id]
                    );

                    const totalValue = Number(valueRow?.total_value || 0);
                    const chances = Math.floor(totalValue / 250);

                    if (chances > 0) {

                        const [[orderRow]] = await pool.query(
                            `SELECT user_id FROM Orders_Aerodeck
                             WHERE order_id = ?`,
                            [item.order_id]
                        );

                        if (orderRow?.user_id) {

                            const userId = orderRow.user_id;

                            const [existing] = await pool.query(
                                `SELECT id FROM USER_REWARDS
                                 WHERE user_id = ? LIMIT 1`,
                                [userId]
                            );

                            if (existing.length > 0) {

                                await pool.query(
                                    `UPDATE USER_REWARDS
                                     SET count = count + ?,
                                         updated_at = NOW()
                                     WHERE user_id = ?`,
                                    [chances, userId]
                                );

                            } else {

                                await pool.query(
                                    `INSERT INTO USER_REWARDS
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
                    `UPDATE Orders_Aerodeck
                     SET order_status = 'PLACED'
                     WHERE order_id = ?`,
                    [item.order_id]
                );
            }
        }

        res.json({
            success: true,
            message: "Order status updated."
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getOrdersWithUser = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                oi.*,
                o.user_id,
                o.address_id,
                u.full_name AS customer_name,
                u.mobile_number AS customer_mobile,
                u.whatsapp_number AS customer_whatsapp,
                u.email AS customer_email,
                u.profile_image AS customer_image,
                a.full_name AS address_name,
                a.mobile_number AS address_mobile,
                a.house_flat,
                a.area_street,
                a.landmark,
                a.pincode,
                a.city,
                a.state,
                a.latitude,
                a.longitude,
                a.address_type,
                a.is_primary
            FROM Order_Items_Aerodeck oi
            LEFT JOIN Orders_Aerodeck o 
                ON oi.order_id = o.order_id
            LEFT JOIN User_Aerodeck u 
                ON o.user_id = u.user_id
            LEFT JOIN User_Address_Aerodeck a 
                ON o.address_id = a.address_id
            WHERE oi.product_type = 'SHOP'
            ORDER BY oi.order_item_id DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.getAdminCommissions = async (req, res) => {
    try {
        const { admin_id } = req.params;

        if (!admin_id) {
            return res.status(400).json({
                success: false,
                message: "admin_id is required."
            });
        }

        const [rows] = await pool.query(
            `SELECT
                ac.id,
                ac.admin_id,
                ac.item_id,
                ac.commission,
                ac.status,
                ac.created_at,
                ac.updated_at,

                oi.product_name,
                oi.product_id,
                oi.category,
                oi.quantity,
                oi.total_price,
                oi.order_id,
                oi.order_status

             FROM admin_comm ac

             LEFT JOIN Order_Items_Aerodeck oi
                ON ac.item_id = oi.order_item_id

             WHERE ac.admin_id = ?

             ORDER BY ac.id DESC`,
            [admin_id]
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.error("GET ADMIN COMMISSIONS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
/* ============================================
   GET ALL COMMISSIONS (Founder)
   ============================================ */
exports.getAllCommissions = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                ac.id,
                ac.admin_id,
                ac.item_id,
                ac.commission,
                ac.status,
                ac.created_at,
                ac.updated_at,

                oi.product_name,
                oi.product_id,
                oi.category,
                oi.quantity,
                oi.total_price,
                oi.order_id,
                oi.order_status,

                ha.username AS admin_username,
                ha.name AS admin_name

             FROM admin_comm ac

             LEFT JOIN Order_Items_Aerodeck oi
                ON ac.item_id = oi.order_item_id

             LEFT JOIN heepitadmin ha
                ON ac.admin_id = ha.id

             ORDER BY ac.id DESC`
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.error("GET ALL COMMISSIONS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

/* ============================================
   UPDATE COMMISSION STATUS (Founder)
   ============================================ */
exports.updateCommissionStatus = async (req, res) => {
    try {
        const { id, status } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "id required."
            });
        }

        await pool.query(
            `UPDATE admin_comm
             SET status = ?, updated_at = NOW()
             WHERE id = ?`,
            [status ? 1 : 0, id]
        );

        return res.json({
            success: true,
            message: "Status updated."
        });

    } catch (err) {
        console.error("UPDATE COMMISSION STATUS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};