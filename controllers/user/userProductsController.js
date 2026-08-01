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
    product_image2,
    product_image3,
    product_image4,
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
exports.getRelatedProducts = async (req, res) => {

    try {

        const { category, exclude } = req.query;

        const [rows] = await pool.query(
            `
            SELECT *
            FROM Products_Aerodeck
            WHERE product_category = ?
              AND product_id != ?
              AND product_status = 1
            ORDER BY product_id DESC
            LIMIT 10
            `,
            [category, exclude]
        );

        res.json(rows);

    } catch (err) {

        console.error(err);
        res.status(500).json({ message: "Server Error" });

    }

};