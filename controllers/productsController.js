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

const addProduct = async (req, res) => {

    try {

        const {

            product_name,
            product_category,
            product_description,
            product_demo_price,
            product_discount_percentage,
            product_highlight_text,
            product_price,
            product_image1,
            product_image2,
            product_image3,
            product_status

        } = req.body;

        await db.query(

            `INSERT INTO Products_Aerodeck (

                product_name,
                product_category,
                product_description,
                product_demo_price,
                product_discount_percentage,
                product_highlight_text,
                product_price,
                product_image1,
                product_image2,
                product_image3,
                product_total_likes,
                product_rating,
                product_status

            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                product_name,
                product_category,
                product_description,
                product_demo_price,
                product_discount_percentage,
                product_highlight_text,
                product_price,
                product_image1,
                product_image2,
                product_image3,
                0,
                0,
                product_status

            ]

        );

        return res.json({

            success: true,
            message: "Product Added Successfully"

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
const addOffer = async (req, res) => {

    try {

        const {

            offer_name,
            offer_description,
            offer_demo_price,
            offer_discount_percentage,
            offer_highlight_text,
            offer_price,
            offer_image1,
            offer_image2,
            offer_image3,
            offer_status,
            offer_expired_at

        } = req.body;

        await db.query(

            `INSERT INTO Products_Offer_Aerodeck (

                offer_name,
                offer_description,
                offer_demo_price,
                offer_discount_percentage,
                offer_highlight_text,
                offer_price,
                offer_image1,
                offer_image2,
                offer_image3,
                offer_status,
                offer_expired_at

            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                offer_name,
                offer_description,
                offer_demo_price,
                offer_discount_percentage,
                offer_highlight_text,
                offer_price,
                offer_image1,
                offer_image2,
                offer_image3,
                offer_status,
                offer_expired_at

            ]

        );

        return res.json({

            success: true,

            message: "Offer Added Successfully"

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

const getProducts = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM Products_Aerodeck ORDER BY product_id DESC"
        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

const getOffers = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM Products_Offer_Aerodeck ORDER BY offer_id DESC"
        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

const updateProduct = async (req, res) => {

    try {

        const {

            product_id,
            product_name,
            product_category,
            product_description,
            product_demo_price,
            product_discount_percentage,
            product_highlight_text,

            product_image1,
            product_image2,
            product_image3,

            product_image1_public_id,
            product_image2_public_id,
            product_image3_public_id,

            product_status

        } = req.body;

        const product_price = (

            Number(product_demo_price)

            -

            (

                Number(product_demo_price)

                *

                Number(product_discount_percentage)

            ) / 100

        ).toFixed(2);

        await db.query(

            `UPDATE Products_Aerodeck
SET
    product_name = ?,
    product_category = ?,
    product_description = ?,
    product_demo_price = ?,
    product_discount_percentage = ?,
    product_highlight_text = ?,
    product_price = ?,
    product_image1 = ?,
product_image1_public_id = ?,

product_image2 = ?,
product_image2_public_id = ?,

product_image3 = ?,
product_image3_public_id = ?,

product_status = ?
WHERE product_id = ?`,

            [

                product_name,
                product_category,
                product_description,
                product_demo_price,
                product_discount_percentage,
                product_highlight_text,
                product_price,
                product_image1,
                product_image1_public_id,

                product_image2,
                product_image2_public_id,

                product_image3,
                product_image3_public_id,

                product_status,
                product_id


            ]

        );

        return res.json({

            success: true,
            message: "Product Updated Successfully"

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
const updateOfferStatus = async (req, res) => {

    try {

        const {

            offer_id,

            offer_status

        } = req.body;

        await db.query(

            `UPDATE Products_Offer_Aerodeck

             SET offer_status = ?

             WHERE offer_id = ?`,

            [

                offer_status,

                offer_id

            ]

        );

        return res.json({

            success: true,

            message: "Offer Status Updated"

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
const deleteOffer = async (req, res) => {

    try {

        const { id } = req.params;

        const [rows] = await db.query(

            `SELECT

                offer_image1,
                offer_image2,
                offer_image3

            FROM Products_Offer_Aerodeck

            WHERE offer_id = ?`,

            [id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Offer Not Found"

            });

        }

        const offer = rows[0];

        if (offer.offer_image1) {

            await cloudinary.uploader.destroy(

                getPublicId(

                    offer.offer_image1

                )

            );

        }

        if (offer.offer_image2) {

            await cloudinary.uploader.destroy(

                getPublicId(

                    offer.offer_image2

                )

            );

        }

        if (offer.offer_image3) {

            await cloudinary.uploader.destroy(

                getPublicId(

                    offer.offer_image3

                )

            );

        }

        await db.query(

            `DELETE FROM Products_Offer_Aerodeck

             WHERE offer_id = ?`,

            [id]

        );

        return res.json({

            success: true,

            message: "Offer Deleted Successfully"

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

const deleteProduct = async (req, res) => {

    try {

        const { id } = req.params;

        const [rows] = await db.query(

            `SELECT
        product_image1,
        product_image2,
        product_image3
     FROM Products_Aerodeck
     WHERE product_id = ?`,

            [id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Product Not Found"

            });

        }

        const product = rows[0];
        if (product.product_image1) {

            await cloudinary.uploader.destroy(

                getPublicId(product.product_image1)

            );

        }

        if (product.product_image2) {

            await cloudinary.uploader.destroy(

                getPublicId(product.product_image2)

            );

        }

        if (product.product_image3) {

            await cloudinary.uploader.destroy(

                getPublicId(product.product_image3)

            );

        }
        await db.query(

            "DELETE FROM Product_Likes_AERODECK WHERE product_id = ?",

            [id]

        );

        await db.query(
            "DELETE FROM Product_Ratings_AERODECK WHERE product_id = ?",
            [id]
        );

        await db.query(
            "DELETE FROM Products_Aerodeck WHERE product_id = ?",
            [id]
        );

        return res.json({

            success: true,

            message: "Product Deleted"

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
    getProducts,
    getOffers,
    addProduct,
    addOffer,
    updateProduct,
    deleteProduct,
    updateOfferStatus,
    deleteOffer
};