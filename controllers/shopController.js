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

/* ============================================
   ADD SHOP
   ============================================ */

const addShop = async (req, res) => {

    try {

        const {

            shop_name,
            shop_category,
            shop_description,
            shop_demo_price,
            shop_discount_percentage,
            shop_highlight_text,
            shop_price,
            shop_image1,
            shop_image2,
            shop_image3,
            shop_image4,
            shop_status,
            material,
            size,
            printing,
            delivery,
            return_days
        } = req.body;


        const [result] = await db.query(

            `INSERT INTO Shop_Aerodeck (

                shop_name,
                shop_category,
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

            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                shop_name,
                shop_category,
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


        /* ✅ Videos empty string se save honge — updateShop se baad mein bharenge */

        await db.query(

            `INSERT INTO User_Product_Detail (
                product_id,
                category,
                material,
                size,
                printing,
                delivery,
                return_days,
                vdo1,
                vdo1_url,
                vdo2,
                vdo2_url,
                vdo3,
                vdo3_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                shopId,
                shop_category,
                material,
                size,
                printing,
                delivery,
                return_days,
                "",
                "",
                "",
                "",
                "",
                ""
            ]

        );


        return res.json({

            success: true,
            shop_id: shopId,
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


/* ============================================
   GET SHOPS
   ============================================ */

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


/* ============================================
   UPDATE SHOP
   ============================================ */

const updateShop = async (req, res) => {

    try {

        const {

            shop_id,
            shop_name,
            shop_category,
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
            material,
            size,
            printing,
            delivery,
            return_days,
            vdo1,
            vdo1_public_id,
            vdo2,
            vdo2_public_id,
            vdo3,
            vdo3_public_id,
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
                shop_category = ?,
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
                shop_category,
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


        /* ✅ YAHAN DHYAAN DO — variable `vdo1_public_id`, column `vdo1_url` */

        const [detailResult] = await db.query(

            `UPDATE User_Product_Detail
             SET
                category = ?,
                material = ?,
                size = ?,
                printing = ?,
                delivery = ?,
                return_days = ?,
                vdo1 = ?,
                vdo1_url = ?,
                vdo2 = ?,
                vdo2_url = ?,
                vdo3 = ?,
                vdo3_url = ?
             WHERE product_id = ?`,

            [

                shop_category || "",
                material || "",
                size || "",
                printing || "",
                delivery || "",
                return_days === "" ? null : return_days,
                vdo1 || "",
                vdo1_public_id || "",
                vdo2 || "",
                vdo2_public_id || "",
                vdo3 || "",
                vdo3_public_id || "",
                String(shop_id)

            ]

        );


        if (detailResult.affectedRows === 0) {

            await db.query(

                `INSERT INTO User_Product_Detail
                (
                    product_id,
                    category,
                    material,
                    size,
                    printing,
                    delivery,
                    return_days,
                    vdo1,
                    vdo1_url,
                    vdo2,
                    vdo2_url,
                    vdo3,
                    vdo3_url
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

                [

                    String(shop_id),
                    shop_category || "",
                    material || "",
                    size || "",
                    printing || "",
                    delivery || "",
                    return_days === "" ? null : return_days,
                    vdo1 || "",
                    vdo1_public_id || "",
                    vdo2 || "",
                    vdo2_public_id || "",
                    vdo3 || "",
                    vdo3_public_id || ""

                ]

            );

        }


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


/* ============================================
   DELETE SHOP
   ============================================ */

const deleteShop = async (req, res) => {

    try {

        const { id } = req.params;


        /* ✅ Shop images fetch */
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


        /* ✅ Videos fetch karo Cloudinary delete ke liye */
        const [videoRows] = await db.query(

            `SELECT
                vdo1_url,
                vdo2_url,
                vdo3_url
             FROM User_Product_Detail
             WHERE product_id = ?`,

            [id]

        );


        /* ✅ Images Cloudinary se delete */
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


        /* ✅ Videos Cloudinary se delete */
        if (videoRows.length > 0) {

            const v = videoRows[0];

            if (v.vdo1_url) {
                try {
                    await cloudinary.uploader.destroy(
                        v.vdo1_url,
                        { resource_type: "video" }
                    );
                    console.log("vdo1 deleted:", v.vdo1_url);
                } catch (err) { console.log("vdo1 delete error:", err); }
            }

            if (v.vdo2_url) {
                try {
                    await cloudinary.uploader.destroy(
                        v.vdo2_url,
                        { resource_type: "video" }
                    );
                    console.log("vdo2 deleted:", v.vdo2_url);
                } catch (err) { console.log("vdo2 delete error:", err); }
            }

            if (v.vdo3_url) {
                try {
                    await cloudinary.uploader.destroy(
                        v.vdo3_url,
                        { resource_type: "video" }
                    );
                    console.log("vdo3 deleted:", v.vdo3_url);
                } catch (err) { console.log("vdo3 delete error:", err); }
            }

        }


        /* ✅ DB se delete */
        await db.query(
            "DELETE FROM Product_Likes_AERODECK WHERE product_id = ?",
            [id]
        );

        await db.query(
            "DELETE FROM Product_Ratings_AERODECK WHERE product_id = ?",
            [id]
        );

        await db.query(
            "DELETE FROM User_Product_Detail WHERE product_id = ?",
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