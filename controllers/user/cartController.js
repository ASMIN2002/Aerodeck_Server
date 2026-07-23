const pool = require("../../config/db");

// ==============================
// GET CART
// ==============================

exports.getCart = async (req, res) => {

    try {

        const { user_id } = req.query;

        const [cartRows] = await pool.query(

            `SELECT *
             FROM User_Cart_Aerodeck
             WHERE user_id = ?`,

            [user_id]

        );
        const productIds = [];
        const giftIds = [];
        const premiumIds = [];
        const shopIds = [];

        for (const row of cartRows) {

            const id = String(row.product_id);

            if (id.startsWith("G")) {

                giftIds.push(id);

            }

            else if (id.startsWith("P")) {

                premiumIds.push(id);

            }

            else if (id.startsWith("S")) {

                shopIds.push(id);

            }

            else {

                productIds.push(Number(id));

            }

        }
        let products = [];

        if (productIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
         FROM Products_Aerodeck
         WHERE product_id IN (?)`,

                [productIds]

            );

            products = rows;

        }
        let gifts = [];

        if (giftIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
         FROM Gifts_Aerodeck
         WHERE gift_id IN (?)`,

                [giftIds]

            );

            gifts = rows;

        }
        let premium = [];

        if (premiumIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
         FROM Premium_Aerodeck
         WHERE premium_id IN (?)`,

                [premiumIds]

            );

            premium = rows;

        }
        let shops = [];

        if (shopIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
         FROM Shop_Aerodeck
         WHERE shop_id IN (?)`,

                [shopIds]

            );

            shops = rows;

        }
        console.log(products);
        console.log(gifts);
        console.log(premium);
        console.log(shops);

        res.json({

            success: true,

            message: "Cart fetched successfully.",

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
// ADD TO CART
// ==============================

exports.addToCart = async (req, res) => {

    try {

        const {

            user_id,

            product_id,

            quantity

        } = req.body;

        let finalQuantity;

        const id = String(product_id);

        if (id.startsWith("G") || id.startsWith("S")) {

            // Gift + Shop
            finalQuantity = quantity < 1 ? 1 : quantity;

        } else {

            // Cards + Premium
            finalQuantity = quantity < 50 ? 50 : quantity;

        }

        const [exists] = await pool.query(

            `SELECT *
             FROM User_Cart_Aerodeck
             WHERE user_id = ?
             AND product_id = ?`,

            [user_id, product_id]

        );

        if (exists.length > 0) {

            return res.json({

                success: false,

                message: "Product already added."

            });

        }

        await pool.query(

            `INSERT INTO User_Cart_Aerodeck
            (user_id, product_id, quantity)
            VALUES (?, ?, ?)`,

            [

                user_id,

                product_id,

                finalQuantity

            ]

        );

        res.json({

            success: true,

            message: "Product added to cart."

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
// UPDATE QUANTITY
// ==============================

exports.updateQuantity = async (req, res) => {

    try {

        const {

            user_id,

            product_id,

            quantity

        } = req.body;

        let finalQuantity;
        const id = String(product_id);

        if (id.startsWith("G") || id.startsWith("S")) {
            finalQuantity = quantity < 1 ? 1 : quantity;
        } else {
            finalQuantity = quantity < 50 ? 50 : quantity;
        }

        await pool.query(

            `UPDATE User_Cart_Aerodeck
             SET quantity = ?
             WHERE user_id = ?
             AND product_id = ?`,

            [

                finalQuantity,

                user_id,

                product_id

            ]

        );

        res.json({

            success: true,

            message: "Quantity updated."

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

exports.removeFromCart = async (req, res) => {

    try {

        const { user_id } = req.body;

        const { productId } = req.params;

        await pool.query(

            `DELETE FROM User_Cart_Aerodeck
             WHERE user_id = ?
             AND product_id = ?`,

            [

                user_id,

                productId

            ]

        );

        res.json({

            success: true,

            message: "Product removed from cart."

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