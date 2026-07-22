const pool = require("../../config/db");

exports.getGifts = async (req, res) => {

    try {

        const [rows] = await pool.query(`
            SELECT
                gift_id,
                gift_name,
                gift_highlight_text,
                gift_demo_price,
                gift_discount_percentage,
                gift_price,
                gift_image1,
                gift_image2,
                gift_image3,
                gift_image4,
                gift_total_likes,
                gift_total_saves,
                gift_rating,
                gift_status
            FROM Gifts_Aerodeck
            ORDER BY gift_id DESC
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