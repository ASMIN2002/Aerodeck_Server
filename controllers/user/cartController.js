const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

async function authenticate(session_token) {
    if (!session_token) return null;
    return await getUserIdFromSession(session_token);
}

function getMinQuantity(productId) {
    const id = String(productId);
    return id.startsWith("G") || id.startsWith("S") ? 1 : 50;
}

function serverError(res, err, context = "Server error.") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

exports.getCart = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);

        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const [cartRows] = await pool.query(
            `SELECT * FROM user_cart_heepit WHERE user_id = ? ORDER BY created_at DESC`,
            [user_id]
        );

        if (!cartRows.length) {
            return res.json({ success: true, message: "Cart is empty.", data: [] });
        }

        const giftIds = [];
        const medicineIds = [];
        const shopIds = [];
        const cardIds = [];

        for (const cart of cartRows) {
            const id = String(cart.product_id);
            if (id.startsWith("G")) giftIds.push(id);
            else if (id.startsWith("M")) medicineIds.push(id);
            else if (id.startsWith("S")) shopIds.push(id);
            else cardIds.push(Number(id));
        }

        const [[gifts], [medicines], [shops], [cards]] = await Promise.all([
            giftIds.length
                ? pool.query(`SELECT * FROM food_heepit WHERE gift_id IN (?)`, [giftIds])
                : Promise.resolve([[]]),
            medicineIds.length
                ? pool.query(`SELECT * FROM medicine_heepit WHERE medicine_id IN (?)`, [medicineIds])
                : Promise.resolve([[]]),
            shopIds.length
                ? pool.query(`SELECT * FROM shop_heepit WHERE shop_id IN (?)`, [shopIds])
                : Promise.resolve([[]]),
            cardIds.length
                ? pool.query(
                    `SELECT p.*, d.delivery
                     FROM cards_heepit p
                     LEFT JOIN product_details_heepit d ON p.product_id = d.product_id
                     WHERE p.product_id IN (?)`,
                    [cardIds]
                )
                : Promise.resolve([[]]),
        ]);

        const giftsMap = new Map(gifts.map((g) => [String(g.gift_id), g]));
        const medicinesMap = new Map(medicines.map((m) => [String(m.medicine_id), m]));
        const shopsMap = new Map(shops.map((s) => [String(s.shop_id), s]));
        const cardsMap = new Map(cards.map((c) => [String(c.product_id), c]));

        const finalCart = cartRows
            .map((cart) => {
                const id = String(cart.product_id);
                let item = null;

                if (id.startsWith("G")) item = giftsMap.get(id);
                else if (id.startsWith("M")) item = medicinesMap.get(id);
                else if (id.startsWith("S")) item = shopsMap.get(id);
                else item = cardsMap.get(id);

                if (!item) return null;

                return {
                    ...item,
                    cart_id: cart.cart_id,
                    quantity: cart.quantity,
                    product_id: cart.product_id,
                    created_at: cart.created_at,
                };
            })
            .filter(Boolean);

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

        const finalQuantity = Math.max(quantity, getMinQuantity(product_id));

        const [exists] = await pool.query(
            `SELECT cart_id FROM user_cart_heepit WHERE user_id = ? AND product_id = ?`,
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

        const finalQuantity = Math.max(quantity, getMinQuantity(product_id));

        await pool.query(
            `UPDATE user_cart_heepit SET quantity = ? WHERE user_id = ? AND product_id = ?`,
            [finalQuantity, user_id, product_id]
        );

        return res.json({ success: true, message: "Quantity updated." });
    } catch (err) {
        return serverError(res, err, "Update quantity failed.");
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        const { session_token } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const { productId } = req.params;

        await pool.query(
            `DELETE FROM user_cart_heepit WHERE user_id = ? AND product_id = ?`,
            [user_id, productId]
        );

        return res.json({ success: true, message: "Product removed from cart." });
    } catch (err) {
        return serverError(res, err, "Remove from cart failed.");
    }
};