const crypto = require("crypto");
const Razorpay = require("razorpay");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");
const pool = require("../../config/db");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PRODUCT_META = {
    G: { type: "GIFT", cancelDays: 3 },
    S: { type: "SHOP", cancelDays: 3 },
    P: { type: "PREMIUM", cancelDays: 1 },
    DEFAULT: { type: "CARD", cancelDays: 1 },
};

function getProductMeta(productId) {
    const prefix = String(productId).charAt(0);
    return PRODUCT_META[prefix] || PRODUCT_META.DEFAULT;
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

exports.createOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount)
            return res.status(400).json({ success: false, message: "Amount is required." });

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `AD_${Date.now()}`,
        });

        return res.json({ success: true, order });
    } catch (err) {
        return serverError(res, err, "Unable to create payment order.");
    }
};

exports.getPaymentConfig = (req, res) => {
    return res.json({ success: true, key: process.env.RAZORPAY_KEY_ID });
};

exports.verifyPayment = async (req, res) => {
    let connection;

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
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
            advance_amount,
            remaining_amount,
        } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid Signature" });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[lastOrder]] = await connection.query(
            `SELECT order_id FROM orders_heepit ORDER BY order_id DESC LIMIT 1`
        );

        const nextId = (lastOrder?.order_id || 0) + 1;
        const order_number = `AD${new Date().getFullYear()}${String(nextId).padStart(6, "0")}`;

        const isCard = order_type === "CARD";
        const itemPaymentStatus = isCard ? "PARTIAL" : "PAID";

        const [orderResult] = await connection.query(
            `INSERT INTO orders_heepit (
                order_number, user_id, order_type, total_items, subtotal, discount,
                gst, platform_fee, delivery_fee, total_amount, advance_amount,
                remaining_amount, payment_method, payment_status, order_status, address_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order_number, user_id, order_type, total_items, subtotal, 0,
                gst, platform_fee, delivery_fee, total_amount,
                isCard ? advance_amount : 0,
                isCard ? remaining_amount : 0,
                payment_method, itemPaymentStatus, "PLACED", address_id,
            ]
        );

        const order_id = orderResult.insertId;

        await connection.query(
            `INSERT INTO payment_heepit (
                order_id, user_id, razorpay_order_id, razorpay_payment_id,
                razorpay_signature, payment_method, payment_status, amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order_id, user_id, razorpay_order_id, razorpay_payment_id,
                razorpay_signature, payment_method, itemPaymentStatus, total_amount,
            ]
        );

        for (const item of items) {
            const meta = getProductMeta(item.product_id);
            const cancelDate = new Date(Date.now() + meta.cancelDays * 24 * 60 * 60 * 1000);

            const price = Number(
                item.product_price ?? item.shop_price ?? item.gift_price ?? 0
            );
            const name =
                item.product_name || item.shop_name || item.gift_name || "Unknown Product";
            const image =
                item.product_image1 || item.shop_image1 || item.gift_image1 || "";

            await connection.query(
                `INSERT INTO order_items_heepit (
                    order_id, product_id, product_type, product_name, product_image,
                    unit_price, quantity, total_price, payment_status, cancel_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    order_id, item.product_id, meta.type, name, image,
                    price, item.quantity, price * item.quantity, itemPaymentStatus, cancelDate,
                ]
            );

            const invoice_number = `AJDD${new Date().getFullYear()}${String(order_id).padStart(6, "0")}-${item.product_id}`;
            const gstPercentage = 18;
            const gstAmount = (price * item.quantity * gstPercentage) / 100;
            const totalAmount = price * item.quantity + gstAmount;

            await connection.query(
                `INSERT INTO invoice_heepit (
                    invoice_number, order_id, order_number, user_id, product_id,
                    product_name, quantity, unit_price, gst_percentage, gst_amount,
                    total_amount, gstin_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    invoice_number, order_id, order_number, user_id, item.product_id,
                    name, item.quantity, price, gstPercentage, gstAmount,
                    totalAmount, "21ABCDE1234F1Z5",
                ]
            );
        }

        if (items.length) {
            const productIds = items.map((i) => i.product_id);
            await connection.query(
                `DELETE FROM user_cart_heepit WHERE user_id = ? AND product_id IN (?)`,
                [user_id, productIds]
            );
        }

        await connection.commit();

        return res.json({
            success: true,
            order_id,
            order_number,
            message: "Payment Verified Successfully",
        });
    } catch (err) {
        if (connection) await connection.rollback();
        return serverError(res, err, "Payment verification failed.");
    } finally {
        if (connection) connection.release();
    }
};

exports.savePaymentDetails = async (req, res) => {
    try {
        const {
            session_token, product_id, order_id,
            upload_image_url, url_id, name, number,
        } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        if (!product_id || !order_id || !upload_image_url || !url_id || !name || !number)
            return res.status(400).json({ success: false, message: "All payment details are required." });

        await pool.query(
            `INSERT INTO UserPaymentDetails (
                user_id, product_id, upload_image_url, url_id, name, number, payment_date
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [user_id, product_id, upload_image_url, url_id, name, number]
        );

        await pool.query(
            `UPDATE orders_heepit SET payment_status = 'PROCESSING'
             WHERE order_id = ? AND user_id = ?`,
            [order_id, user_id]
        );

        await pool.query(
            `UPDATE order_items_heepit SET payment_status = 'PROCESSING'
             WHERE order_id = ? AND product_id = ?`,
            [order_id, product_id]
        );

        return res.json({ success: true, message: "Payment details saved successfully." });
    } catch (err) {
        return serverError(res, err, "Failed to save payment details.");
    }
};