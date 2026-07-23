const pool = require("../../config/db");

// ==============================
// GET USER WISHLIST
// ==============================

exports.getWishlist = async (req, res) => {

    try {

        const { user_id } = req.query;

        const [wishlistRows] = await pool.query(

            `SELECT *
             FROM User_Wishlist_Aerodeck
             WHERE user_id = ?`,

            [user_id]

        );

        const productIds = [];
        const giftIds = [];
        const premiumIds = [];
        const shopIds = [];

        for (const row of wishlistRows) {

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
        let gifts = [];
        let premium = [];
        let shops = [];

        if (productIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
                 FROM Products_Aerodeck
                 WHERE product_id IN (?)`,

                [productIds]

            );

            products = rows;

        }

        if (giftIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
                 FROM Gifts_Aerodeck
                 WHERE gift_id IN (?)`,

                [giftIds]

            );

            gifts = rows;

        }

        if (premiumIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
                 FROM Premium_Aerodeck
                 WHERE premium_id IN (?)`,

                [premiumIds]

            );

            premium = rows;

        }

        if (shopIds.length > 0) {

            const [rows] = await pool.query(

                `SELECT *
                 FROM Shop_Aerodeck
                 WHERE shop_id IN (?)`,

                [shopIds]

            );

            shops = rows;

        }

        const wishlistMap = {};

        wishlistRows.forEach(row => {
            wishlistMap[row.product_id] = row.created_at;
        });

        const wishlist = [];

        // Products
        products.forEach(item => {

            wishlist.push({

                type: "product",
                product_id: item.product_id,
                name: item.product_name,
                description: item.product_description,
                price: item.product_price,
                image: item.product_image1,
                rating: item.product_rating,
                likes: item.product_total_likes,
                saves: item.product_total_saves,
                status: item.product_status,
                created_at: wishlistMap[item.product_id]

            });

        });

        // Gifts
        gifts.forEach(item => {

            wishlist.push({

                type: "gift",
                product_id: item.gift_id,
                name: item.gift_name,
                description: item.gift_description,
                price: item.gift_price,
                image: item.gift_image1,
                rating: item.gift_rating,
                likes: item.gift_total_likes,
                saves: item.gift_total_saves,
                status: item.gift_status,
                created_at: wishlistMap[item.gift_id]

            });

        });

        // Premium
        premium.forEach(item => {

            wishlist.push({

                type: "premium",
                product_id: item.premium_id,
                name: item.premium_name,
                description: item.premium_description,
                price: item.premium_price,
                image: item.premium_image1,
                rating: item.premium_rating,
                likes: item.premium_total_likes,
                saves: item.premium_total_saves,
                status: item.premium_status,
                created_at: wishlistMap[item.premium_id]

            });

        });

        // Shop
        shops.forEach(item => {

            wishlist.push({

                type: "shop",
                product_id: item.shop_id,
                name: item.shop_name,
                description: item.shop_description,
                price: item.shop_price,
                image: item.shop_image1,
                rating: item.shop_rating,
                likes: item.shop_total_likes,
                saves: item.shop_total_saves,
                status: item.shop_status,
                created_at: wishlistMap[item.shop_id]

            });

        });

        // Newest first
        wishlist.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        res.json({

            success: true,

            message: "Wishlist fetched successfully.",

            data: wishlist

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