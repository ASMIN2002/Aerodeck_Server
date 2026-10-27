const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

async function authenticate(session_token) {
    if (!session_token) return null;
    return await getUserIdFromSession(session_token);
}

function getMinQuantity(productId) {
    const id = String(productId);
    if (id.startsWith("G") || id.startsWith("S") || id.startsWith("M")) return 1;
    return 50;
}

function serverError(res, err, context = "Server error.") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

const emptyQuery = () => Promise.resolve([[]]);

exports.getCart = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const [cartRows] = await pool.query(
            `SELECT cart_id, product_id, quantity, created_at
             FROM user_cart_heepit
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [user_id]
        );

        if (!cartRows.length) {
            return res.json({ success: true, message: "Cart is empty.", data: [] });
        }

        const giftIds = [];
        const medicineIds = [];
        const shopIds = [];

        for (const cart of cartRows) {
            const id = String(cart.product_id);
            if (id.startsWith("G")) giftIds.push(id);
            else if (id.startsWith("M")) medicineIds.push(id);
            else if (id.startsWith("S")) shopIds.push(id);
        }

        const [[gifts], [medicines], [shops]] = await Promise.all([
            giftIds.length
                ? pool.query(
                    `SELECT gift_id, gift_name, gift_image1, gift_price, gift_demo_price,
                            gift_discount_percentage, gift_rating, gift_status
                     FROM food_heepit WHERE gift_id IN (?)`,
                    [giftIds]
                )
                : emptyQuery(),
            medicineIds.length
                ? pool.query(
                    `SELECT medicine_id, medicine_name, medicine_image1, medicine_price, medicine_demo_price,
                            medicine_discount_percentage, medicine_rating, medicine_status
                     FROM medicine_heepit WHERE medicine_id IN (?)`,
                    [medicineIds]
                )
                : emptyQuery(),
            shopIds.length
                ? pool.query(
                    `SELECT shop_id, shop_name, shop_image1, shop_price, shop_demo_price,
                            shop_discount_percentage, shop_rating, shop_status
                     FROM shop_heepit WHERE shop_id IN (?)`,
                    [shopIds]
                )
                : emptyQuery(),
        ]);

        const giftsMap = new Map(gifts.map((g) => [String(g.gift_id), g]));
        const medicinesMap = new Map(medicines.map((m) => [String(m.medicine_id), m]));
        const shopsMap = new Map(shops.map((s) => [String(s.shop_id), s]));

        const finalCart = [];
        for (const cart of cartRows) {
            const id = String(cart.product_id);
            let item = null;
            if (id.startsWith("G")) item = giftsMap.get(id);
            else if (id.startsWith("M")) item = medicinesMap.get(id);
            else if (id.startsWith("S")) item = shopsMap.get(id);

            if (!item) continue;

            finalCart.push({
                ...item,
                cart_id: cart.cart_id,
                quantity: cart.quantity,
                product_id: cart.product_id,
                created_at: cart.created_at,
            });
        }

        return res.json({ success: true, message: "Cart fetched successfully.", data: finalCart });
    } catch (err) {
        return serverError(res, err, "Cart fetch failed.");
    }
};

exports.addToCart = async (req, res) => {
    try {
        const { session_token, product_id, quantity } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        if (!product_id) {
            return res.status(400).json({ success: false, message: "Product ID required." });
        }

        const finalQuantity = Math.max(Number(quantity) || 1, getMinQuantity(product_id));

        const [exists] = await pool.query(
            `SELECT cart_id FROM user_cart_heepit WHERE user_id = ? AND product_id = ? LIMIT 1`,
            [user_id, product_id]
        );

        if (exists.length > 0)
            return res.json({ success: false, message: "Product already added." });

        await pool.query(
            `INSERT INTO user_cart_heepit (user_id, product_id, quantity) VALUES (?, ?, ?)`,
            [user_id, product_id, finalQuantity]
        );

        return res.json({ success: true, message: "Product added to cart." });
    } catch (err) {
        return serverError(res, err, "Add to cart failed.");
    }
};

exports.updateQuantity = async (req, res) => {
    try {
        const { session_token, product_id, quantity } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        if (!product_id) {
            return res.status(400).json({ success: false, message: "Product ID required." });
        }

        const finalQuantity = Math.max(Number(quantity) || 1, getMinQuantity(product_id));

        const [result] = await pool.query(
            `UPDATE user_cart_heepit SET quantity = ? WHERE user_id = ? AND product_id = ?`,
            [finalQuantity, user_id, product_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Cart item not found." });
        }

        return res.json({ success: true, message: "Quantity updated." });
    } catch (err) {
        return serverError(res, err, "Update quantity failed.");
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        const { session_token } = req.body;
        const { productId } = req.params;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        if (!productId) {
            return res.status(400).json({ success: false, message: "Product ID required." });
        }

        const [result] = await pool.query(
            `DELETE FROM user_cart_heepit WHERE user_id = ? AND product_id = ?`,
            [user_id, productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Cart item not found." });
        }

        return res.json({ success: true, message: "Product removed from cart." });
    } catch (err) {
        return serverError(res, err, "Remove from cart failed.");
    }
};