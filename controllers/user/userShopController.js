const pool = require("../../config/db");
const SHOP_COLUMNS = `
    shop_id,
    shop_name,
    shop_description,
    shop_category,
    shop_price,
    shop_demo_price,
    shop_discount_percentage,
    shop_rating,
    shop_highlight_text,
    shop_status,
    shop_image1,
    shop_image2,
    shop_image3,
    shop_image4,
    shop_total_likes,
    shop_total_saves,
    shop_created_at
`;
function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}
exports.getShops = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 500, 1), 1000);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);
        const category = req.query.category;
        let query = `SELECT ${SHOP_COLUMNS} FROM shop_heepit`;
        const params = [];
        if (category) {
            query += ` WHERE shop_category = ?`;
            params.push(category);
        }
        query += ` ORDER BY shop_id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        const [rows] = await pool.query(query, params);
        return res.json({
            success: true,
            data: rows,
            pagination: { limit, offset, count: rows.length },
        });
    } catch (err) {
        return serverError(res, err, "getShops failed");
    }
};