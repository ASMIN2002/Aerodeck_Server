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
                payment_method === "COD" ? "PENDING" : "PAID",
                total_amount
            ]

        );

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

                o.order_id,
                o.order_number,
                o.total_items,
                o.total_amount,
                o.order_status,
                o.payment_status,
                o.payment_method,
                o.created_at,
                o.address_id,

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

        const result = [];

        for (const item of rows) {

            let table = "";

            if (item.product_id.startsWith("G")) {

                table = "Gifts_Aerodeck";

            } else if (item.product_id.startsWith("S")) {

                table = "Shop_Aerodeck";

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