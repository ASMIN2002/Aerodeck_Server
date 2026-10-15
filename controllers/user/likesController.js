const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const PRODUCT_CONFIG = {
    G: { table: "food_heepit", idCol: "gift_id", likesCol: "gift_total_likes" },
    S: { table: "shop_heepit", idCol: "shop_id", likesCol: "shop_total_likes" },
    P: { table: "medical_heepit", idCol: "premium_id", likesCol: "premium_total_likes" },
    DEFAULT: { table: "cards_heepit", idCol: "product_id", likesCol: "product_total_likes" },
};

function getProductConfig(productId) {
    const prefix = String(productId).charAt(0);
    return PRODUCT_CONFIG[prefix] || PRODUCT_CONFIG.DEFAULT;
}

async function authenticate(session_token) {
    if (!session_token) return null;
    return await getUserIdFromSession(session_token);
}

function serverError(res, err, context = "Server error.") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

async function updateLikesCount(productId, delta) {
    const { table, idCol, likesCol } = getProductConfig(productId);

    const query =
        delta > 0
            ? `UPDATE ${table} SET ${likesCol} = ${likesCol} + 1 WHERE ${idCol} = ?`
            : `UPDATE ${table} SET ${likesCol} = GREATEST(${likesCol} - 1, 0) WHERE ${idCol} = ?`;

    await pool.query(query, [productId]);

    const [rows] = await pool.query(
        `SELECT ${likesCol} AS total FROM ${table} WHERE ${idCol} = ?`,
        [productId]
    );

    return rows[0]?.total || 0;
}

exports.getLikes = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);

        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const [rows] = await pool.query(
            `SELECT * FROM likes_heepit WHERE user_id = ?`,
            [user_id]
        );

        return res.json({ success: true, message: "Likes fetched successfully.", data: rows });
    } catch (err) {
        return serverError(res, err, "Fetch likes failed.");
    }
};

exports.getMyLikes = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);

        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const [likes] = await pool.query(
            `SELECT like_id, product_id FROM likes_heepit
             WHERE user_id = ?
             ORDER BY like_id DESC`,
            [user_id]
        );

        if (likes.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const giftIds = [];
        const shopIds = [];
        const premiumIds = [];
        const cardIds = [];

        for (const l of likes) {
            const id = String(l.product_id);
            if (id.startsWith("G")) giftIds.push(id);
            else if (id.startsWith("S")) shopIds.push(id);
            else if (id.startsWith("P")) premiumIds.push(id);
            else cardIds.push(Number(id));
        }

        const [[gifts], [shops], [premiums], [cards]] = await Promise.all([
            giftIds.length
                ? pool.query(
                    `SELECT gift_id AS id, gift_name AS name, gift_image1 AS image, gift_total_likes AS total_likes
                     FROM food_heepit WHERE gift_id IN (?)`,
                    [giftIds]
                )
                : Promise.resolve([[]]),
            shopIds.length
                ? pool.query(
                    `SELECT shop_id AS id, shop_name AS name, shop_image1 AS image, shop_total_likes AS total_likes
                     FROM shop_heepit WHERE shop_id IN (?)`,
                    [shopIds]
                )
                : Promise.resolve([[]]),
            premiumIds.length
                ? pool.query(
                    `SELECT premium_id AS id, premium_name AS name, premium_image1 AS image, premium_total_likes AS total_likes
                     FROM medical_heepit WHERE premium_id IN (?)`,
                    [premiumIds]
                )
                : Promise.resolve([[]]),
            cardIds.length
                ? pool.query(
                    `SELECT product_id AS id, product_name AS name, product_image1 AS image, product_total_likes AS total_likes
                     FROM cards_heepit WHERE product_id IN (?)`,
                    [cardIds]
                )
                : Promise.resolve([[]]),
        ]);

        const giftsMap = new Map(gifts.map((g) => [String(g.id), { ...g, type: "gifts" }]));
        const shopsMap = new Map(shops.map((s) => [String(s.id), { ...s, type: "shop" }]));
        const premiumsMap = new Map(premiums.map((p) => [String(p.id), { ...p, type: "premium" }]));
        const cardsMap = new Map(cards.map((c) => [String(c.id), { ...c, type: "products" }]));

        const data = likes.map((l) => {
            const id = String(l.product_id);

            let product = null;
            if (id.startsWith("G")) product = giftsMap.get(id);
            else if (id.startsWith("S")) product = shopsMap.get(id);
            else if (id.startsWith("P")) product = premiumsMap.get(id);
            else product = cardsMap.get(id);

            return {
                like_id: l.like_id,
                product_id: l.product_id,
                product_name: product?.name || "Unknown",
                product_image: product?.image || "",
                total_likes: product?.total_likes || 0,
                product_type: product?.type || "products",
            };
        });

        return res.json({ success: true, data });
    } catch (err) {
        return serverError(res, err, "Fetch my likes failed.");
    }
};

exports.likeProduct = async (req, res) => {
    try {
        const { session_token, product_id } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const [exists] = await pool.query(
            `SELECT like_id FROM likes_heepit WHERE user_id = ? AND product_id = ?`,
            [user_id, product_id]
        );

        if (exists.length > 0)
            return res.json({ success: false, message: "Already liked." });

        await pool.query(
            `INSERT INTO likes_heepit (user_id, product_id) VALUES (?, ?)`,
            [user_id, product_id]
        );

        const totalLikes = await updateLikesCount(product_id, 1);

        return res.json({ success: true, message: "Liked successfully.", totalLikes });
    } catch (err) {
        return serverError(res, err, "Like failed.");
    }
};

exports.unlikeProduct = async (req, res) => {
    try {
        const { session_token } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const { productId } = req.params;

        await pool.query(
            `DELETE FROM likes_heepit WHERE user_id = ? AND product_id = ?`,
            [user_id, productId]
        );

        const totalLikes = await updateLikesCount(productId, -1);

        return res.json({ success: true, message: "Unlike successfully.", totalLikes });
    } catch (err) {
        return serverError(res, err, "Unlike failed.");
    }
};