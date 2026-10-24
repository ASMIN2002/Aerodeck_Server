const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const PRODUCT_CONFIG = {
    G: { table: "food_heepit", idCol: "gift_id", ratingCol: "gift_rating" },
    S: { table: "shop_heepit", idCol: "shop_id", ratingCol: "shop_rating" },
    M: { table: "medicine_heepit", idCol: "medicine_id", ratingCol: "medicine_rating" },
    DEFAULT: { table: "cards_heepit", idCol: "product_id", ratingCol: "product_rating" },
};

function getProductConfig(productId) {
    const prefix = String(productId).charAt(0);
    return PRODUCT_CONFIG[prefix] || PRODUCT_CONFIG.DEFAULT;
}

async function authenticate(session_token) {
    if (!session_token) return null;
    return await getUserIdFromSession(session_token);
}

function serverError(res, err, context = "Internal Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

exports.submitReview = async (req, res) => {
    try {
        const { session_token, order_item_id, product_id, rating, review_message } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const [exists] = await pool.query(
            `SELECT rating_id FROM ratings_heepit WHERE order_item_id = ?`,
            [order_item_id]
        );

        if (exists.length > 0)
            return res.json({ success: false, message: "You have already reviewed this product." });

        await pool.query(
            `INSERT INTO ratings_heepit (order_item_id, product_id, user_id, rating, review_message)
             VALUES (?, ?, ?, ?, ?)`,
            [order_item_id, product_id, user_id, rating, review_message]
        );

        const [[avg]] = await pool.query(
            `SELECT ROUND(AVG(rating), 2) AS average_rating
             FROM ratings_heepit WHERE product_id = ?`,
            [product_id]
        );

        const { table, idCol, ratingCol } = getProductConfig(product_id);

        await pool.query(
            `UPDATE ${table} SET ${ratingCol} = ? WHERE ${idCol} = ?`,
            [avg.average_rating, product_id]
        );

        return res.json({ success: true, message: "Review submitted successfully." });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getReview = async (req, res) => {
    try {
        const { order_item_id } = req.params;
        const { session_token } = req.query;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid or expired session." });

        const [rows] = await pool.query(
            `SELECT rating, review_message FROM ratings_heepit WHERE order_item_id = ?`,
            [order_item_id]
        );

        if (rows.length === 0)
            return res.json({ success: true, rated: false });

        return res.json({
            success: true,
            rated: true,
            rating: rows[0].rating,
            review_message: rows[0].review_message,
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getAllReviews = async (req, res) => {
    try {
        const { product_id } = req.params;

        const [[summary], [reviews]] = await Promise.all([
            pool.query(
                `SELECT
                    COUNT(CASE WHEN rating = 5 THEN 1 END) AS five,
                    COUNT(CASE WHEN rating = 4 THEN 1 END) AS four,
                    COUNT(CASE WHEN rating = 3 THEN 1 END) AS three,
                    COUNT(CASE WHEN rating = 2 THEN 1 END) AS two,
                    COUNT(CASE WHEN rating = 1 THEN 1 END) AS one
                 FROM ratings_heepit WHERE product_id = ?`,
                [product_id]
            ),
            pool.query(
                `SELECT u.full_name, u.profile_image, r.rating, r.review_message
                 FROM ratings_heepit r
                 INNER JOIN users_heepit u ON r.user_id = u.user_id
                 WHERE r.product_id = ?
                 ORDER BY r.rating DESC`,
                [product_id]
            ),
        ]);

        return res.json({ success: true, summary, reviews });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getTopReviews = async (req, res) => {
    try {
        const { product_id } = req.params;

        const [reviews] = await pool.query(
            `SELECT u.full_name, u.profile_image, r.rating, r.review_message
             FROM ratings_heepit r
             INNER JOIN users_heepit u ON r.user_id = u.user_id
             WHERE r.product_id = ?
             ORDER BY r.rating DESC, r.rating_id DESC
             LIMIT 5`,
            [product_id]
        );

        return res.json({ success: true, reviews });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getMyReviewImages = async (req, res) => {
    try {
        const { order_item_id } = req.params;
        const { session_token } = req.query;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid session." });

        const [rows] = await pool.query(
            `SELECT media_id, image_url, public_id
             FROM review_media_heepit
             WHERE order_item_id = ?
             ORDER BY media_id ASC`,
            [order_item_id]
        );

        return res.json({ success: true, images: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getReviewMedia = async (req, res) => {
    try {
        const { product_id } = req.params;

        const [rows] = await pool.query(
            `SELECT rm.media_id, rm.image_url, rm.upload_date, r.rating, u.full_name, u.profile_image
             FROM review_media_heepit rm
             INNER JOIN ratings_heepit r
                 ON rm.order_item_id = r.order_item_id AND rm.user_id = r.user_id
             INNER JOIN users_heepit u ON rm.user_id = u.user_id
             WHERE rm.product_id = ?
             ORDER BY rm.upload_date DESC`,
            [product_id]
        );

        return res.json({ success: true, images: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getMyReviews = async (req, res) => {
    try {
        const { session_token } = req.query;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return res.status(401).json({ success: false, message: "Invalid session." });

        const [reviews] = await pool.query(
            `SELECT
                r.rating_id,
                r.order_item_id,
                r.product_id,
                r.rating,
                r.review_message,
                r.created_at
             FROM ratings_heepit r
             WHERE r.user_id = ?
             ORDER BY r.created_at DESC`,
            [user_id]
        );

        if (reviews.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const giftIds = [];
        const shopIds = [];
        const medicineIds = [];
        const cardIds = [];

        for (const r of reviews) {
            const id = String(r.product_id);
            if (id.startsWith("G")) giftIds.push(id);
            else if (id.startsWith("S")) shopIds.push(id);
            else if (id.startsWith("M")) medicineIds.push(id);
            else cardIds.push(Number(id));
        }

        const [[gifts], [shops], [medicines], [cards]] = await Promise.all([
            giftIds.length
                ? pool.query(
                    `SELECT gift_id AS id, gift_name AS name, gift_price AS price, gift_image1 AS image FROM food_heepit WHERE gift_id IN (?)`,
                    [giftIds]
                )
                : Promise.resolve([[]]),
            shopIds.length
                ? pool.query(
                    `SELECT shop_id AS id, shop_name AS name, shop_price AS price, shop_image1 AS image FROM shop_heepit WHERE shop_id IN (?)`,
                    [shopIds]
                )
                : Promise.resolve([[]]),
            medicineIds.length
                ? pool.query(
                    `SELECT medicine_id AS id, medicine_name AS name, medicine_price AS price, medicine_image1 AS image FROM medicine_heepit WHERE medicine_id IN (?)`,
                    [medicineIds]
                )
                : Promise.resolve([[]]),
            cardIds.length
                ? pool.query(
                    `SELECT product_id AS id, product_name AS name, product_price AS price, product_image1 AS image FROM cards_heepit WHERE product_id IN (?)`,
                    [cardIds]
                )
                : Promise.resolve([[]]),
        ]);

        const giftsMap = new Map(gifts.map((g) => [String(g.id), { ...g, type: "gifts" }]));
        const shopsMap = new Map(shops.map((s) => [String(s.id), { ...s, type: "shop" }]));
        const medicinesMap = new Map(medicines.map((m) => [String(m.id), { ...m, type: "medicine" }]));
        const cardsMap = new Map(cards.map((c) => [String(c.id), { ...c, type: "products" }]));

        const data = reviews.map((r) => {
            const id = String(r.product_id);

            let product = null;
            if (id.startsWith("G")) product = giftsMap.get(id);
            else if (id.startsWith("S")) product = shopsMap.get(id);
            else if (id.startsWith("M")) product = medicinesMap.get(id);
            else product = cardsMap.get(id);

            return {
                ...r,
                product_name: product?.name || "Unknown",
                product_price: product?.price || 0,
                product_image: product?.image || "",
                product_type: product?.type || "products",
            };
        });

        return res.json({ success: true, data });
    } catch (err) {
        return serverError(res, err);
    }
};