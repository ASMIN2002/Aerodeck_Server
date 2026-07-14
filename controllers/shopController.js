const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

function getPublicId(url) {

    if (!url) return null;

    const parts = url.split("/upload/");

    if (parts.length < 2) return null;

    let publicId = parts[1];

    publicId = publicId.replace(/^v\d+\//, "");

    publicId = publicId.replace(/\.[^/.]+$/, "");

    return publicId;

}

const addShop = async (req, res) => {

    try {

        const {

            shop_name,
            shop_description,
            shop_demo_price,
            shop_discount_percentage,
            shop_highlight_text,
            shop_price,
            shop_image1,
            shop_image2,
            shop_image3,
            shop_image4,
            shop_status

        } = req.body;

        const [result] = await db.query(

            `INSERT INTO Shop_Aerodeck (

                shop_name,
                shop_description,
                shop_demo_price,
                shop_discount_percentage,
                shop_highlight_text,
                shop_price,
                shop_image1,
                shop_image2,
                shop_image3,
                shop_image4,
                shop_total_likes,
                shop_rating,
                shop_status

           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                shop_name,
                shop_description,
                shop_demo_price,
                shop_discount_percentage,
                shop_highlight_text,
                shop_price,
                shop_image1,
                shop_image2,
                shop_image3,
                shop_image4,
                0,
                0,
                shop_status

            ]

        );
        const shopId = `S${result.insertId}`;

        await db.query(

            `UPDATE Shop_Aerodeck
     SET shop_id = ?
     WHERE id = ?`,

            [shopId, result.insertId]

        );

        return res.json({

            success: true,
            message: "Shop Added Successfully"

        });

    }

    catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};


const getShops = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM Shop_Aerodeck ORDER BY shop_id DESC"
        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

const updateShop = async (req, res) => {

    try {

        const {

            shop_id,
            shop_name,
            shop_description,
            shop_demo_price,
            shop_discount_percentage,
            shop_highlight_text,

            shop_image1,
            shop_image2,
            shop_image3,
            shop_image4,

            shop_image1_public_id,
            shop_image2_public_id,
            shop_image3_public_id,
            shop_image4_public_id,

            shop_status

        } = req.body;

        const shop_price = (

            Number(shop_demo_price)

            -

            (

                Number(shop_demo_price)

                *

                Number(shop_discount_percentage)

            ) / 100

        ).toFixed(2);

        await db.query(

            `UPDATE Shop_Aerodeck
SET
    shop_name = ?,
    shop_description = ?,
    shop_demo_price = ?,
    shop_discount_percentage = ?,
    shop_highlight_text = ?,
    shop_price = ?,
    shop_image1 = ?,
shop_image1_public_id = ?,

shop_image2 = ?,
shop_image2_public_id = ?,

shop_image3 = ?,
shop_image3_public_id = ?,

shop_image4 = ?,
shop_image4_public_id = ?,

shop_status = ?
WHERE shop_id = ?`,

            [

                shop_name,
                shop_description,
                shop_demo_price,
                shop_discount_percentage,
                shop_highlight_text,
                shop_price,
                shop_image1,
                shop_image1_public_id,

                shop_image2,
                shop_image2_public_id,

                shop_image3,
                shop_image3_public_id,

                shop_image4,
                shop_image4_public_id,

                shop_status,
                shop_id


            ]

        );

        return res.json({

            success: true,
            message: "Shop Updated Successfully"

        });

    }

    catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

const deleteShop = async (req, res) => {

    try {

        const { id } = req.params;

        const [rows] = await db.query(

            `SELECT
        shop_image1,
        shop_image2,
        shop_image3,
        shop_image4
     FROM Shop_Aerodeck
     WHERE shop_id = ?`,

            [id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Shop Not Found"

            });

        }

        const shop = rows[0];
        if (shop.shop_image1) {

            await cloudinary.uploader.destroy(

                getPublicId(shop.shop_image1)

            );

        }

        if (shop.shop_image2) {

            await cloudinary.uploader.destroy(

                getPublicId(shop.shop_image2)

            );

        }

        if (shop.shop_image3) {

            await cloudinary.uploader.destroy(

                getPublicId(shop.shop_image3)

            );

        }

        if (shop.shop_image4) {

            await cloudinary.uploader.destroy(

                getPublicId(shop.shop_image4)

            );

        }


        await db.query(

            "DELETE FROM Shop_Likes_AERODECK WHERE shop_id = ?",

            [id]

        );

        await db.query(
            "DELETE FROM Shop_Ratings_AERODECK WHERE shop_id = ?",
            [id]
        );

        await db.query(
            "DELETE FROM Shop_Aerodeck WHERE shop_id = ?",
            [id]
        );

        return res.json({

            success: true,

            message: "Shop Deleted"

        });

    }

    catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

module.exports = {
    getShops,
    addShop,
    updateShop,
    deleteShop
};