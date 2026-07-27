const crypto = require("crypto");
const Razorpay = require("razorpay");
const pool = require("../../config/db");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {

    try {

        const { amount } = req.body;

        if (!amount) {

            return res.status(400).json({
                success: false,
                message: "Amount is required."
            });

        }

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `AD_${Date.now()}`
        });

        return res.json({
            success: true,
            order
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Unable to create payment order."
        });

    }

};

exports.getPaymentConfig = (req, res) => {

    return res.json({

        success: true,
        key: process.env.RAZORPAY_KEY_ID

    });

};
exports.verifyPayment = async (req, res) => {

    let connection;

    try {

        const {

            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,

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

            full_amount,
            advance_amount,
            remaining_amount,

            total_amount

        } = req.body;

        // Verify Signature

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(
                razorpay_order_id + "|" + razorpay_payment_id
            )
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {

            return res.status(400).json({

                success: false,
                message: "Invalid Signature"

            });

        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // Generate Order Number

        const [[lastOrder]] = await connection.query(`
            SELECT order_id
            FROM Orders_Aerodeck
            ORDER BY order_id DESC
            LIMIT 1
        `);

        const nextId = (lastOrder?.order_id || 0) + 1;

        const order_number =
            `AD${new Date().getFullYear()}${String(nextId).padStart(6, "0")}`;

        // Insert Order

        const [orderResult] = await connection.query(

            `INSERT INTO Orders_Aerodeck
            (
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
                advance_amount,
                remaining_amount,
                payment_method,
                payment_status,
                order_status,
                address_id
            )
            VALUES
            (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,

            [

                order_number,
                user_id,
                order_type,
                total_items,
                subtotal,
                0,
                gst,
                platform_fee,
                delivery_fee,

                full_amount,

                order_type === "CARD"
                    ? advance_amount
                    : full_amount,

                order_type === "CARD"
                    ? remaining_amount
                    : 0,

                payment_method,

                order_type === "CARD"
                    ? "PARTIAL"
                    : "PAID",

                "PLACED",

                address_id
            ]

        );

        const order_id = orderResult.insertId;

        // Save Payment

        await connection.query(

            `INSERT INTO Payment_Aerodeck
            (
                order_id,
                user_id,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                payment_method,
                payment_status,
                amount
            )
            VALUES
            (?,?,?,?,?,?,?,?)`,

            [

                order_id,
                user_id,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                payment_method,
                order_type === "CARD" ? "PARTIAL" : "PAID",
                total_amount

            ]

        );

        // Save Order Items

        for (const item of items) {

            let productType;

            if (String(item.product_id).startsWith("G")) {

                productType = "GIFT";

            } else if (String(item.product_id).startsWith("S")) {

                productType = "SHOP";

            } else if (String(item.product_id).startsWith("P")) {

                productType = "PREMIUM";

            } else {

                productType = "CARD";

            }

            const price = Number(
                item.product_price ??
                item.shop_price ??
                item.gift_price ??
                0
            );

            const name =
                item.product_name ||
                item.shop_name ||
                item.gift_name ||
                "Unknown Product";

            const image =
                item.product_image1 ||
                item.shop_image1 ||
                item.gift_image1 ||
                "";

            await connection.query(


                `INSERT INTO Order_Items_Aerodeck
    (
        order_id,
        product_id,
        product_type,
        product_name,
        product_image,
        unit_price,
        quantity,
        total_price
    )
    VALUES
    (?,?,?,?,?,?,?,?)`,
                [
                    order_id,
                    item.product_id,
                    productType,
                    name,
                    image,
                    price,
                    item.quantity,
                    price * item.quantity
                ]
            );

            const invoice_number =
                `AJDD${new Date().getFullYear()}${String(order_id).padStart(6, "0")}-${item.product_id}`;

            const gstPercentage = 18;
            const gstAmount = (price * item.quantity * gstPercentage) / 100;
            const totalAmount = (price * item.quantity) + gstAmount;

            await connection.query(
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
                    invoice_number,
                    order_id,
                    order_number,
                    user_id,
                    item.product_id,
                    name,
                    item.quantity,
                    price,
                    gstPercentage,
                    gstAmount,
                    totalAmount,
                    "21ABCDE1234F1Z5"
                ]
            );


        }

        // Clear Cart

        for (const item of items) {

            await connection.query(
                `DELETE FROM User_Cart_Aerodeck
         WHERE user_id = ?
         AND product_id = ?`,
                [
                    user_id,
                    item.product_id
                ]
            );
        }
        await connection.commit();

        return res.json({

            success: true,

            order_id,

            order_number,

            message: "Payment Verified Successfully"

        });

    } catch (err) {

        if (connection) {

            await connection.rollback();

        }

        console.error("VERIFY ERROR:", err);
        console.error("SQL MESSAGE:", err.sqlMessage);
        console.error("CODE:", err.code);

        return res.status(500).json({

            success: false,

            message: err.sqlMessage || err.message

        });

    } finally {

        if (connection) {

            connection.release();

        }

    }

};