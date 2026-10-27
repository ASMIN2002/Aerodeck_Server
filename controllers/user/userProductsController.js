const pool = require("../../config/db");

const CARD_COLUMNS = `
    product_id,
    product_name,
    product_category,
    product_description,
    product_highlight_text,
    product_demo_price,
    product_discount_percentage,
    product_price,
    product_image1,
    product_image2,
    product_image3,
    product_image4,
    product_total_likes,
    product_total_saves,
    product_rating,
    product_status
`;

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

exports.getProducts = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        const category = req.query.category;

        let query = `SELECT ${CARD_COLUMNS} FROM cards_heepit`;
        const params = [];

        if (category) {
            query += ` WHERE product_category = ?`;
            params.push(category);
        }

        query += ` ORDER BY product_id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await pool.query(query, params);

        return res.json({
            success: true,
            data: rows,
            pagination: { limit, offset, count: rows.length },
        });
    } catch (err) {
        return serverError(res, err, "getProducts failed");
    }
};

exports.getRelatedProducts = async (req, res) => {
    try {
        const { category, exclude } = req.query;

        if (!category) {
            return res.status(400).json({ success: false, message: "category is required" });
        }

        let query = `SELECT ${CARD_COLUMNS} FROM cards_heepit WHERE product_category = ? AND product_status = 1`;
        const params = [category];

        if (exclude) {
            query += ` AND product_id != ?`;
            params.push(exclude);
        }

        query += ` ORDER BY product_id DESC LIMIT 10`;

        const [rows] = await pool.query(query, params);

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "getRelatedProducts failed");
    }
};