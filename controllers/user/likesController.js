const pool = require("../../config/db");

// ==============================
// GET USER LIKES
// ==============================

exports.getLikes = async (req, res) => {

    try {

        const { user_id } = req.query;

        const [rows] = await pool.query(

            `SELECT *
             FROM Product_Likes_AERODECK
             WHERE user_id = ?`,

            [user_id]

        );

        res.json({

            success: true,

            message: "Likes fetched successfully.",

            data: rows

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

// ==============================
// LIKE
// ==============================

exports.likeProduct = async (req, res) => {

    try {

        const {

            user_id,
            product_id

        } = req.body;

        const [exists] = await pool.query(

            `SELECT *
             FROM Product_Likes_AERODECK
             WHERE user_id = ?
             AND product_id = ?`,

            [

                user_id,
                product_id

            ]

        );

        if (exists.length > 0) {

            return res.json({

                success: false,
                message: "Already liked."

            });

        }

        await pool.query(

            `INSERT INTO Product_Likes_AERODECK
            (user_id, product_id)
            VALUES (?, ?)`,

            [

                user_id,
                product_id

            ]

        );

        // ==========================
        // GIFT
        // ==========================

        if (String(product_id).startsWith("G")) {

            await pool.query(

                `UPDATE Gifts_Aerodeck
                 SET gift_total_likes = gift_total_likes + 1
                 WHERE gift_id = ?`,

                [

                    product_id

                ]

            );

        }

        // ==========================
        // CARD
        // ==========================

        else {

            await pool.query(

                `UPDATE Products_Aerodeck
                 SET product_total_likes = product_total_likes + 1
                 WHERE product_id = ?`,

                [

                    product_id

                ]

            );

        }

        res.json({

            success: true,

            message: "Liked successfully."

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

// ==============================
// UNLIKE
// ==============================

exports.unlikeProduct = async (req, res) => {

    try {

        const { user_id } = req.body;

        const { productId } = req.params;

        await pool.query(

            `DELETE
             FROM Product_Likes_AERODECK
             WHERE user_id = ?
             AND product_id = ?`,

            [

                user_id,
                productId

            ]

        );

        // ==========================
        // GIFT
        // ==========================

        if (String(productId).startsWith("G")) {

            await pool.query(

                `UPDATE Gifts_Aerodeck
                 SET gift_total_likes =
                 GREATEST(gift_total_likes - 1, 0)
                 WHERE gift_id = ?`,

                [

                    productId

                ]

            );

        }

        // ==========================
        // CARD
        // ==========================

        else {

            await pool.query(

                `UPDATE Products_Aerodeck
                 SET product_total_likes =
                 GREATEST(product_total_likes - 1, 0)
                 WHERE product_id = ?`,

                [

                    productId

                ]

            );

        }

        res.json({

            success: true,

            message: "Unlike successfully."

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};