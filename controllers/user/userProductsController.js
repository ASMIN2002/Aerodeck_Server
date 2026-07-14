const pool = require("../../config/db");

exports.getProducts = async (req, res) => {

    try {

        const [rows] = await pool.query(`
            SELECT
    product_id,
    product_name,
    product_highlight_text,
    product_demo_price,
    product_discount_percentage,
    product_price,
    product_image1,
    product_total_likes,
    product_total_saves,
    product_rating,
    product_status
FROM Products_Aerodeck
ORDER BY product_id DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};