const pool = require("../../config/db");

exports.placeOrder = async (req, res) => {

    try {
        console.log(req.body);

        const {

            user_id,
            address_id,
            payment_method,
            order_type,
            items,
            total_items,
            subtotal,
            gst,
            platform_fee,
            delivery_fee,
            total_amount

        } = req.body;

        const orderNumber = "AD" + Date.now();

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
        address_id

    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                orderNumber,
                user_id,
                order_type === "PRODUCTS" ? "PRODUCT" : "CARD",
                total_items,
                subtotal,
                0,
                gst,
                platform_fee,
                delivery_fee,
                total_amount,
                payment_method,
                payment_method === "COD" ? "PENDING" : "PAID",
                "PLACED",
                address_id

            ]

        );

        const order_id = orderResult.insertId;

        for (const item of items) {

            let productType = "";
            let productName = "";
            let productImage = "";
            let unitPrice = 0;

            if (item.product_id.startsWith("G")) {

                productType = "GIFT";
                productName = item.gift_name;
                productImage = item.gift_image1;
                unitPrice = Number(item.gift_price);

            } else if (item.product_id.startsWith("S")) {

                productType = "SHOP";
                productName = item.shop_name;
                productImage = item.shop_image1;
                unitPrice = Number(item.shop_price);

            }

            await pool.query(

                `INSERT INTO Order_Items_Aerodeck (

            order_id,
            product_id,
            product_type,
            product_name,
            product_image,
            unit_price,
            quantity,
            total_price

        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

                [

                    order_id,
                    item.product_id,
                    productType,
                    productName,
                    productImage,
                    unitPrice,
                    item.quantity,
                    unitPrice * item.quantity

                ]

            );

        }

        await pool.query(

            `DELETE FROM User_Cart_Aerodeck
     WHERE user_id = ?`,

            [user_id]

        );

        console.log("Order ID:", order_id);
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

        const { user_id } = req.query;
        const [rows] = await pool.query(

            `SELECT

        order_id,
        order_number,
        total_items,
        total_amount,
        order_status,
        payment_status,
        payment_method,
        created_at

    FROM Orders_Aerodeck

    WHERE user_id = ?

    ORDER BY created_at DESC`,

            [user_id]

        );
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

                product_id,
                product_name,
                product_image,
                quantity,
                unit_price,
                total_price,
                product_type

            FROM Order_Items_Aerodeck

            WHERE order_id = ?`,

            [order_id]

        );

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