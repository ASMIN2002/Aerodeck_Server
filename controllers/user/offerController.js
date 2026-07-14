const pool = require("../../config/db");

exports.getOffers = async (req, res) => {

    try {

        const [rows] = await pool.query(`
            SELECT
offer_id,
offer_name,
offer_description,
offer_demo_price,
offer_discount_percentage,
offer_highlight_text,
offer_price,
offer_image1,
offer_image2,
offer_image3,
offer_status,
offer_expired_at
FROM Products_Offer_Aerodeck
ORDER BY offer_id DESC;
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