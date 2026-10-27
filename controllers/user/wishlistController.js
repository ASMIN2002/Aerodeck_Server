const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const PRODUCT_TABLES = {
    G: { table: "food_heepit", idCol: "gift_id", savesCol: "gift_total_saves" },
    S: { table: "shop_heepit", idCol: "shop_id", savesCol: "shop_total_saves" },
    M: { table: "medicine_heepit", idCol: "medicine_id", savesCol: "medicine_total_saves" },
    DEFAULT: { table: "cards_heepit", idCol: "product_id", savesCol: "product_total_saves" },
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

const emptyQuery = () => Promise.resolve([[]]);

const PRODUCT_COLUMNS = {
    G: `gift_id AS id, gift_name AS name, gift_image1 AS image, gift_price AS price,
        gift_demo_price AS demo_price, gift_discount_percentage AS discount_percentage,
        gift_rating AS rating, gift_status AS status`,
    M: `medicine_id AS id, medicine_name AS name, medicine_image1 AS image, medicine_price AS price,
        medicine_demo_price AS demo_price, medicine_discount_percentage AS discount_percentage,
        medicine_rating AS rating, medicine_status AS status`,
    S: `shop_id AS id, shop_name AS name, shop_image1 AS image, shop_price AS price,
        shop_demo_price AS demo_price, shop_discount_percentage AS discount_percentage,
        shop_rating AS rating, shop_status AS status`,
    DEFAULT: `product_id AS id, product_name AS name, product_image1 AS image, product_price AS price,
              product_demo_price AS demo_price, product_discount_percentage AS discount_percentage,
              product_rating AS rating, product_status AS status`,
};

async function updateSavesCount(conn, productId, delta) {
    const { table, idCol, savesCol } = getProductTable(productId);

    const query =
        delta > 0
            ? `UPDATE ${table} SET ${savesCol} = ${savesCol} + 1 WHERE ${idCol} = ?`
            : `UPDATE ${table} SET ${savesCol} = GREATEST(${savesCol} - 1, 0) WHERE ${idCol} = ?`;

    await conn.query(query, [productId]);
}

exports.getWishlist = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);
        if (!user_id) return unauthorized(res);

        const [wishlistRows] = await pool.query(
            `SELECT wishlist_id, product_id, created_at
             FROM user_wishlist_heepit
             WHERE user_id = ?
             ORDER BY created_at DESC`,
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
                ? pool.query(`SELECT ${PRODUCT_COLUMNS.G} FROM food_heepit WHERE gift_id IN (?)`, [giftIds])
                : emptyQuery(),
            medicineIds.length
                ? pool.query(`SELECT ${PRODUCT_COLUMNS.M} FROM medicine_heepit WHERE medicine_id IN (?)`, [medicineIds])
                : emptyQuery(),
            shopIds.length
                ? pool.query(`SELECT ${PRODUCT_COLUMNS.S} FROM shop_heepit WHERE shop_id IN (?)`, [shopIds])
                : emptyQuery(),
            cardIds.length
                ? pool.query(`SELECT ${PRODUCT_COLUMNS.DEFAULT} FROM cards_heepit WHERE product_id IN (?)`, [cardIds])
                : emptyQuery(),
        ]);

        const timeMap = new Map();
        for (const row of wishlistRows) {
            timeMap.set(String(row.product_id), row.created_at);
        }

        const attachTime = (items, type) =>
            items.map((item) => ({
                ...item,
                type,
                created_at: timeMap.get(String(item.id)) || null,
            }));

        const wishlist = [
            ...attachTime(cards, "card"),
            ...attachTime(gifts, "gift"),
            ...attachTime(medicines, "medicine"),
            ...attachTime(shops, "shop"),
        ];

        wishlist.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json({ success: true, message: "Wishlist fetched successfully.", data: wishlist });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.saveProduct = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { session_token, product_id } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        if (!product_id) {
            conn.release();
            return res.status(400).json({ success: false, message: "Product ID required." });
        }

        const [exists] = await conn.query(
            `SELECT wishlist_id FROM user_wishlist_heepit
             WHERE user_id = ? AND product_id = ? LIMIT 1`,
            [user_id, product_id]
        );

        if (exists.length > 0) {
            conn.release();
            return res.json({ success: false, message: "Product already saved." });
        }

        await conn.beginTransaction();
        try {
            await conn.query(
                `INSERT INTO user_wishlist_heepit (user_id, product_id) VALUES (?, ?)`,
                [user_id, product_id]
            );

            await updateSavesCount(conn, product_id, 1);

            await conn.commit();
            conn.release();
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            if (txErr.code === "ER_DUP_ENTRY") {
                return res.json({ success: false, message: "Product already saved." });
            }
            throw txErr;
        }

        return res.json({ success: true, message: "Product saved successfully." });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};

exports.removeProduct = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { session_token } = req.body;
        const { productId } = req.params;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        if (!productId) {
            conn.release();
            return res.status(400).json({ success: false, message: "Product ID required." });
        }

        await conn.beginTransaction();
        try {
            const [result] = await conn.query(
                `DELETE FROM user_wishlist_heepit WHERE user_id = ? AND product_id = ?`,
                [user_id, productId]
            );

            if (result.affectedRows === 0) {
                await conn.rollback();
                conn.release();
                return res.status(404).json({ success: false, message: "Product not in wishlist." });
            }

            await updateSavesCount(conn, productId, -1);

            await conn.commit();
            conn.release();
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }

        return res.json({ success: true, message: "Product removed successfully." });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};