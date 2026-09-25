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
                oi.order_status

             FROM Cancel_Aerodeck c

             LEFT JOIN Order_Items_Aerodeck oi
             ON c.order_item_id = oi.order_item_id

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

        /* ============================================
           1. GET CANCEL RECORD
           ============================================ */
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

        /* ============================================
           2. UPDATE CANCEL TABLE
           ============================================ */
        await pool.query(
            `UPDATE Cancel_Aerodeck
             SET cancel_status = ?
             WHERE cancel_id = ?`,
            [cancel_status, cancel_id]
        );

        /* ============================================
           3. UPDATE ITEM TABLE
           ============================================ */
        await pool.query(
            `UPDATE Order_Items_Aerodeck
             SET order_status = ?
             WHERE order_item_id = ?`,
            [cancel_status, cancelRow.order_item_id]
        );

        /* ============================================
           4. GET ORDER_ID
           ============================================ */
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

        /* ============================================
           5. CHECK — saare items same status?
           ============================================ */
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

        /* ============================================
           6. UPDATE ORDER TABLE — agar saare items same
           ============================================ */
        if (totalItems > 0 && totalItems === matchingItems) {

            await pool.query(
                `UPDATE Orders_Aerodeck
                 SET order_status = ?
                 WHERE order_id = ?`,
                [cancel_status, order_id]
            );

            /* ============================================
               7. REFUND HYPO POINTS — sirf CANCELLED pe
               ============================================ */
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

        const {
            order_item_id,
            order_status
        } = req.body;

        /* ============================================
           1. GET ITEM (product_id + order_id)
           ============================================ */
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

        /* ============================================
           2. UPDATE ITEM STATUS
           ============================================ */
        await pool.query(
            `UPDATE Order_Items_Aerodeck
             SET order_status = ?
             WHERE order_item_id = ?`,
            [order_status, order_item_id]
        );

        /* ============================================
           3. RETURN DATE LOGIC (G/S products)
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
           4. CHECK — ALL ITEMS DELIVERED?
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

                /* Saare items delivered → Order DELIVERED */
                await pool.query(
                    `UPDATE Orders_Aerodeck
                     SET order_status = 'DELIVERED'
                     WHERE order_id = ?`,
                    [item.order_id]
                );

            } else {

                /* Kuch pending → Order PLACED */
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