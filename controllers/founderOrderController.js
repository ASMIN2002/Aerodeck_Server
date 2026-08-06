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
exports.updateOrderStatus = async (req, res) => {

    try {

        const {

            order_item_id,
            order_status

        } = req.body;

        const [[item]] = await pool.query(

            `SELECT product_id
             FROM Order_Items_Aerodeck
             WHERE order_item_id = ?`,

            [order_item_id]

        );
        console.log("Product ID:", item.product_id);

        await pool.query(

            `UPDATE Order_Items_Aerodeck
             SET order_status = ?
             WHERE order_item_id = ?`,

            [
                order_status,
                order_item_id
            ]

        );

        if (

            order_status === "DELIVERED" &&

            (item.product_id.startsWith("G") ||

                item.product_id.startsWith("S"))

        ) {
            console.log("Inside Return Logic");

            const [[details]] = await pool.query(

                `SELECT return_days
                 FROM User_Product_Detail
                 WHERE product_id = ?`,

                [item.product_id]

            );
            console.log("Details:", details);

            let returnDate = null;

            if (

                details &&
                Number(details.return_days) > 0

            ) {

                returnDate = new Date();

                returnDate.setDate(

                    returnDate.getDate() +

                    Number(details.return_days)

                );
                console.log("Return Date:", returnDate);

            }

            await pool.query(

                `UPDATE Order_Items_Aerodeck
                 SET return_date = ?
                 WHERE order_item_id = ?`,

                [
                    returnDate,
                    order_item_id
                ]

            );
            console.log("Return Date Saved");

        }

        res.json({

            success: true,

            message: "Order status updated."

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