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
        else if (String(product_id).startsWith("S")) {

            await pool.query(

                `UPDATE Shop_Aerodeck
         SET shop_total_likes = shop_total_likes + 1
         WHERE shop_id = ?`,

                [product_id]

            );

        }
        else if (String(product_id).startsWith("P")) {

            await pool.query(

                `UPDATE Premium_Aerodeck
         SET premium_total_likes = premium_total_likes + 1
         WHERE premium_id = ?`,

                [product_id]

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
        let totalLikes = 0;

        // GIFT
        if (String(product_id).startsWith("G")) {

            const [rows] = await pool.query(
                `SELECT gift_total_likes
         FROM Gifts_Aerodeck
         WHERE gift_id = ?`,
                [product_id]
            );

            totalLikes = rows[0]?.gift_total_likes || 0;
        }

        // SHOP
        else if (String(product_id).startsWith("S")) {

            const [rows] = await pool.query(
                `SELECT shop_total_likes
         FROM Shop_Aerodeck
         WHERE shop_id = ?`,
                [product_id]
            );

            totalLikes = rows[0]?.shop_total_likes || 0;
        }

        // PREMIUM
        else if (String(product_id).startsWith("P")) {

            const [rows] = await pool.query(
                `SELECT premium_total_likes
         FROM Premium_Aerodeck
         WHERE premium_id = ?`,
                [product_id]
            );

            totalLikes = rows[0]?.premium_total_likes || 0;
        }

        // CARD
        else {

            const [rows] = await pool.query(
                `SELECT product_total_likes
         FROM Products_Aerodeck
         WHERE product_id = ?`,
                [product_id]
            );

            totalLikes = rows[0]?.product_total_likes || 0;
        }

        res.json({

            success: true,

            message: "Liked successfully.",

            totalLikes

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
        else if (String(productId).startsWith("S")) {

            await pool.query(

                `UPDATE Shop_Aerodeck
         SET shop_total_likes =
         GREATEST(shop_total_likes - 1, 0)
         WHERE shop_id = ?`,

                [productId]

            );

        }
        else if (String(productId).startsWith("P")) {

            await pool.query(

                `UPDATE Premium_Aerodeck
         SET premium_total_likes =
         GREATEST(premium_total_likes - 1, 0)
         WHERE premium_id = ?`,

                [productId]

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

        let totalLikes = 0;

        // GIFT
        if (String(productId).startsWith("G")) {

            const [rows] = await pool.query(
                `SELECT gift_total_likes
         FROM Gifts_Aerodeck
         WHERE gift_id = ?`,
                [productId]
            );

            totalLikes = rows[0]?.gift_total_likes || 0;
        }

        // SHOP
        else if (String(productId).startsWith("S")) {

            const [rows] = await pool.query(
                `SELECT shop_total_likes
         FROM Shop_Aerodeck
         WHERE shop_id = ?`,
                [productId]
            );

            totalLikes = rows[0]?.shop_total_likes || 0;
        }

        // PREMIUM
        else if (String(productId).startsWith("P")) {

            const [rows] = await pool.query(
                `SELECT premium_total_likes
         FROM Premium_Aerodeck
         WHERE premium_id = ?`,
                [productId]
            );

            totalLikes = rows[0]?.premium_total_likes || 0;
        }

        // CARD
        else {

            const [rows] = await pool.query(
                `SELECT product_total_likes
         FROM Products_Aerodeck
         WHERE product_id = ?`,
                [productId]
            );

            totalLikes = rows[0]?.product_total_likes || 0;
        }

        res.json({

            success: true,

            message: "Unlike successfully.",

            totalLikes

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