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