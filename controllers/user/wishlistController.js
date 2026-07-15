const pool = require("../../config/db");

// ==============================
// GET USER WISHLIST
// ==============================

exports.getWishlist = async (req, res) => {

    try {

        const { user_id } = req.query;

        const [rows] = await pool.query(

            `SELECT *
             FROM User_Wishlist_Aerodeck
             WHERE user_id = ?`,

            [user_id]

        );

        res.json({

            success: true,

            message: "Wishlist fetched successfully.",

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
// SAVE PRODUCT
// ==============================

exports.saveProduct = async (req, res) => {

    try {

        const { user_id, product_id } = req.body;

        const [exists] = await pool.query(

            `SELECT *
             FROM User_Wishlist_Aerodeck
             WHERE user_id = ?
             AND product_id = ?`,

            [user_id, product_id]

        );

        if (exists.length > 0) {

            return res.json({

                success: false,

                message: "Product already saved."

            });

        }

        await pool.query(

            `INSERT INTO User_Wishlist_Aerodeck
            (user_id, product_id)
            VALUES (?, ?)`,

            [user_id, product_id]

        );
        if (String(product_id).startsWith("G")) {

            await pool.query(

                `UPDATE Gifts_Aerodeck
         SET gift_total_saves = gift_total_saves + 1
         WHERE gift_id = ?`,

                [product_id]

            );

        }

        else if (String(product_id).startsWith("S")) {

            await pool.query(

                `UPDATE Shop_Aerodeck
         SET shop_total_saves = shop_total_saves + 1
         WHERE shop_id = ?`,

                [product_id]

            );

        }
        else if (String(product_id).startsWith("P")) {

            await pool.query(

                `UPDATE Premium_Aerodeck
         SET premium_total_saves = premium_total_saves + 1
         WHERE premium_id = ?`,

                [product_id]

            );

        }

        else {

            await pool.query(

                `UPDATE Products_Aerodeck
         SET product_total_saves = product_total_saves + 1
         WHERE product_id = ?`,

                [product_id]

            );

        }


        res.json({

            success: true,

            message: "Product saved successfully."

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
// REMOVE PRODUCT
// ==============================

exports.removeProduct = async (req, res) => {

    try {

        const { user_id } = req.body;

        const { productId } = req.params;

        await pool.query(

            `DELETE FROM User_Wishlist_Aerodeck
             WHERE user_id = ?
             AND product_id = ?`,

            [user_id, productId]

        );

        if (String(productId).startsWith("G")) {

            await pool.query(

                `UPDATE Gifts_Aerodeck
         SET gift_total_saves =
         GREATEST(gift_total_saves - 1, 0)
         WHERE gift_id = ?`,

                [productId]

            );

        }


        else if (String(productId).startsWith("S")) {

            await pool.query(

                `UPDATE Shop_Aerodeck
         SET shop_total_saves =
         GREATEST(shop_total_saves - 1, 0)
         WHERE shop_id = ?`,

                [productId]

            );

        }

        else if (String(productId).startsWith("P")) {

            await pool.query(

                `UPDATE Premium_Aerodeck
         SET premium_total_saves =
         GREATEST(premium_total_saves - 1, 0)
         WHERE premium_id = ?`,

                [productId]

            );

        }

        else {

            await pool.query(

                `UPDATE Products_Aerodeck
         SET product_total_saves =
         GREATEST(product_total_saves - 1, 0)
         WHERE product_id = ?`,

                [productId]

            );

        }

        res.json({

            success: true,

            message: "Product removed successfully."

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