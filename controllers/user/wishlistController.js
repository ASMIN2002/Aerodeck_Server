const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const PRODUCT_TABLES = {
    G: { table: "food_heepit", idCol: "gift_id", savesCol: "gift_total_saves", type: "gift" },
    S: { table: "shop_heepit", idCol: "shop_id", savesCol: "shop_total_saves", type: "shop" },
    M: { table: "medicine_heepit", idCol: "medicine_id", savesCol: "medicine_total_saves", type: "medicine" },
    DEFAULT: { table: "cards_heepit", idCol: "product_id", savesCol: "product_total_saves", type: "card" },
};

function getProductTable(productId) {
    const prefix = String(productId).charAt(0);
    return PRODUCT_TABLES[prefix] || PRODUCT_TABLES.DEFAULT;
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

async function updateSavesCount(productId, delta) {
    const { table, idCol, savesCol } = getProductTable(productId);

    const query =
        delta > 0
            ? `UPDATE ${table} SET ${savesCol} = ${savesCol} + 1 WHERE ${idCol} = ?`
            : `UPDATE ${table} SET ${savesCol} = GREATEST(${savesCol} - 1, 0) WHERE ${idCol} = ?`;

    await pool.query(query, [productId]);
}

exports.getWishlist = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);
        if (!user_id) return unauthorized(res);

        const [wishlistRows] = await pool.query(
            `SELECT * FROM user_wishlist_heepit WHERE user_id = ?`,
            [user_id]
        );

        if (!wishlistRows.length) {
            return res.json({ success: true, message: "Wishlist fetched successfully.", data: [] });
        }

        const giftIds = [];
        const medicineIds = [];
        const shopIds = [];
        const cardIds = [];

        for (const row of wishlistRows) {
            const id = String(row.product_id);
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
                ? pool.query(`SELECT * FROM cards_heepit WHERE product_id IN (?)`, [cardIds])
                : Promise.resolve([[]]),
        ]);

        const timeMap = {};
        for (const row of wishlistRows) {
            timeMap[row.product_id] = row.created_at;
        }

        const wishlist = [
            ...cards.map((item) => ({ ...item, type: "card", created_at: timeMap[item.product_id] })),
            ...gifts.map((item) => ({ ...item, type: "gift", created_at: timeMap[item.gift_id] })),
            ...medicines.map((item) => ({ ...item, type: "medicine", created_at: timeMap[item.medicine_id] })),
            ...shops.map((item) => ({ ...item, type: "shop", created_at: timeMap[item.shop_id] })),
        ];

        wishlist.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json({ success: true, message: "Wishlist fetched successfully.", data: wishlist });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.saveProduct = async (req, res) => {
    try {
        const { session_token, product_id } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const [exists] = await pool.query(
            `SELECT wishlist_id FROM user_wishlist_heepit WHERE user_id = ? AND product_id = ?`,
            [user_id, product_id]
        );

        if (exists.length > 0)
            return res.json({ success: false, message: "Product already saved." });

        await pool.query(
            `INSERT INTO user_wishlist_heepit (user_id, product_id) VALUES (?, ?)`,
            [user_id, product_id]
        );

        await updateSavesCount(product_id, 1);

        return res.json({ success: true, message: "Product saved successfully." });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.removeProduct = async (req, res) => {
    try {
        const { session_token } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const { productId } = req.params;

        await pool.query(
            `DELETE FROM user_wishlist_heepit WHERE user_id = ? AND product_id = ?`,
            [user_id, productId]
        );

        await updateSavesCount(productId, -1);

        return res.json({ success: true, message: "Product removed successfully." });
    } catch (err) {
        return serverError(res, err);
    }
};