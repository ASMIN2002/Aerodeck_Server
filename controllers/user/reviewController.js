const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

exports.submitReview = async (req, res) => {

    try {

        const {

            session_token,
            order_item_id,
            product_id,
            rating,
            review_message

        } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({

                success: false,
                message: "Invalid or expired session."

            });

        }

        const [exists] = await pool.query(

            `SELECT rating_id
FROM Product_Ratings_AERODECK
WHERE order_item_id = ?`,

            [
                order_item_id
            ]

        );

        if (exists.length > 0) {

            return res.json({

                success: false,
                message: "You have already reviewed this product."

            });

        }

        await pool.query(

            `INSERT INTO Product_Ratings_AERODECK
            (
            order_item_id,
                product_id,
                user_id,
                rating,
                review_message
            )
            VALUES
            (?,?,?,?,?)`,

            [
                order_item_id,
                product_id,
                user_id,
                rating,
                review_message
            ]

        );
        const [[avg]] = await pool.query(

            `SELECT ROUND(AVG(rating),2) AS average_rating
     FROM Product_Ratings_AERODECK
     WHERE product_id = ?`,

            [product_id]

        );

        if (product_id.startsWith("G")) {

            await pool.query(

                `UPDATE Gifts_Aerodeck
         SET gift_rating = ?
         WHERE gift_id = ?`,

                [
                    avg.average_rating,
                    product_id
                ]

            );

        } else if (product_id.startsWith("S")) {

            await pool.query(

                `UPDATE Shop_Aerodeck
         SET shop_rating = ?
         WHERE shop_id = ?`,

                [
                    avg.average_rating,
                    product_id
                ]

            );

        } else if (product_id.startsWith("P")) {

            await pool.query(

                `UPDATE Premium_Aerodeck
         SET premium_rating = ?
         WHERE premium_id = ?`,

                [
                    avg.average_rating,
                    product_id
                ]

            );

        } else {

            await pool.query(

                `UPDATE Products_Aerodeck
         SET product_rating = ?
         WHERE product_id = ?`,

                [
                    avg.average_rating,
                    product_id
                ]

            );

        }

        res.json({

            success: true,
            message: "Review submitted successfully."

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: "Internal Server Error"

        });

    }

};
exports.getReview = async (req, res) => {

    try {

        const { order_item_id } = req.params;
        const { session_token } = req.query;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({

                success: false,
                message: "Invalid or expired session."

            });

        }

        const [rows] = await pool.query(

            `SELECT
    rating,
    review_message
FROM Product_Ratings_AERODECK
WHERE order_item_id = ?`,

            [
                order_item_id
            ]

        );

        if (rows.length === 0) {

            return res.json({

                success: true,
                rated: false

            });

        }

        res.json({

            success: true,
            rated: true,
            rating: rows[0].rating,
            review_message: rows[0].review_message

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: "Internal Server Error"

        });

    }

};
exports.getAllReviews = async (req, res) => {

    try {

        const { product_id } = req.params;

        // Rating Summary

        const [[summary]] = await pool.query(

            `SELECT

                COUNT(CASE WHEN rating = 5 THEN 1 END) AS five,

                COUNT(CASE WHEN rating = 4 THEN 1 END) AS four,

                COUNT(CASE WHEN rating = 3 THEN 1 END) AS three,

                COUNT(CASE WHEN rating = 2 THEN 1 END) AS two,

                COUNT(CASE WHEN rating = 1 THEN 1 END) AS one

            FROM Product_Ratings_AERODECK

            WHERE product_id = ?`,

            [product_id]

        );

        // All Reviews

        const [reviews] = await pool.query(

            `SELECT

                u.full_name,
                u.profile_image,

                r.rating,
                r.review_message

            FROM Product_Ratings_AERODECK r

            INNER JOIN User_Aerodeck u
            ON r.user_id = u.user_id

            WHERE r.product_id = ?

            ORDER BY r.rating DESC`,

            [product_id]

        );

        res.json({

            success: true,

            summary,

            reviews

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: "Internal Server Error"

        });

    }

};
exports.getTopReviews = async (req, res) => {

    try {

        const { product_id } = req.params;

        const [reviews] = await pool.query(

            `SELECT

                u.full_name,
                u.profile_image,

                r.rating,
                r.review_message

            FROM Product_Ratings_AERODECK r

            INNER JOIN User_Aerodeck u
            ON r.user_id = u.user_id

            WHERE r.product_id = ?

            ORDER BY r.rating DESC, r.rating_id DESC

            LIMIT 5`,

            [product_id]

        );

        res.json({

            success: true,

            reviews

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: "Internal Server Error"

        });

    }

};
exports.getMyReviewImages = async (req, res) => {

    try {

        const { order_item_id } = req.params;
        const { session_token } = req.query;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({

                success: false,
                message: "Invalid session."

            });

        }

        const [rows] = await pool.query(

            `SELECT
    media_id,
    image_url,
    public_id
FROM Review_Media_AERODECK
WHERE
    order_item_id = ?
ORDER BY media_id ASC`,

            [
                order_item_id
            ]

        );

        res.json({

            success: true,

            images: rows

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: "Internal Server Error"

        });

    }

};
exports.getReviewMedia = async (req, res) => {

    try {

        const { product_id } = req.params;

        const [rows] = await pool.query(

            `SELECT

        rm.media_id,
        rm.image_url,
        rm.upload_date,

        r.rating,

        u.full_name,
        u.profile_image

    FROM Review_Media_AERODECK rm

    INNER JOIN Product_Ratings_AERODECK r

        ON rm.order_item_id = r.order_item_id
    AND rm.user_id = r.user_id

    INNER JOIN User_Aerodeck u

        ON rm.user_id = u.user_id

    WHERE rm.product_id = ?

    ORDER BY rm.upload_date DESC`,

            [

                product_id

            ]

        );

        return res.json({

            success: true,

            images: rows

        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};