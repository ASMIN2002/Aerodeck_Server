const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

exports.submitReview = async (req, res) => {

    try {

        const {

            session_token,
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
             WHERE product_id = ?
             AND user_id = ?`,

            [
                product_id,
                user_id
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
                product_id,
                user_id,
                rating,
                review_message
            )
            VALUES
            (?,?,?,?)`,

            [
                product_id,
                user_id,
                rating,
                review_message
            ]

        );

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

        const { product_id } = req.params;
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
            WHERE product_id = ?
            AND user_id = ?`,

            [
                product_id,
                user_id
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