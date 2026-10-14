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