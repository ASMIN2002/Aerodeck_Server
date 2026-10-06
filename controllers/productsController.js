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
            product_image4,
            product_status,
            material,
            size,
            printing,
            delivery,
            return_days,
            posted_by
        } = req.body;

        const [result] = await db.query(

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
                product_image4,
                product_total_likes,
                product_rating,
                product_status,
                posted_by,
                updated_by,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,

            [
                product_name,
                product_category,
                product_description,
                product_demo_price,
                product_discount_percentage,
                product_highlight_text,
                product_price,
                product_image1 || "",
                product_image2 || "",
                product_image3 || "",
                product_image4 || "",
                0,
                0,
                product_status,
                posted_by || null,
                posted_by || null
            ]

        );

        const newProductId = result.insertId;

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
                String(newProductId),
                product_category || "",
                material || "",
                size || "",
                printing || "",
                delivery || "",
                return_days === "" ? null : return_days,
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
            product_id: newProductId,
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
                offer_image1 || "",
                offer_image2 || "",
                offer_image3 || "",
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
            product_image4,

            product_image1_public_id,
            product_image2_public_id,
            product_image3_public_id,
            product_image4_public_id,

            product_status,
            updated_by,

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
            vdo3_public_id

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

                product_image4 = ?,
                product_image4_public_id = ?,

                product_status = ?,
                updated_by = ?,
                updated_at = NOW()

             WHERE product_id = ?`,

            [
                product_name,
                product_category,
                product_description,
                product_demo_price,
                product_discount_percentage,
                product_highlight_text,
                product_price,

                product_image1 || "",
                product_image1_public_id || "",

                product_image2 || "",
                product_image2_public_id || "",

                product_image3 || "",
                product_image3_public_id || "",

                product_image4 || "",
                product_image4_public_id || "",

                product_status,
                updated_by || null,
                product_id
            ]

        );

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
                product_category || "",
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
                String(product_id)
            ]

        );

        if (detailResult.affectedRows === 0) {

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
                    String(product_id),
                    product_category || "",
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

            [offer_status, offer_id]

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
            await cloudinary.uploader.destroy(getPublicId(offer.offer_image1));
        }

        if (offer.offer_image2) {
            await cloudinary.uploader.destroy(getPublicId(offer.offer_image2));
        }

        if (offer.offer_image3) {
            await cloudinary.uploader.destroy(getPublicId(offer.offer_image3));
        }

        await db.query(
            "DELETE FROM Products_Offer_Aerodeck WHERE offer_id = ?",
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
                product_image3,
                product_image4
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

        const [videoRows] = await db.query(

            `SELECT
                vdo1_url,
                vdo2_url,
                vdo3_url
             FROM User_Product_Detail
             WHERE product_id = ?`,

            [String(id)]

        );

        if (product.product_image1) {
            await cloudinary.uploader.destroy(getPublicId(product.product_image1));
        }

        if (product.product_image2) {
            await cloudinary.uploader.destroy(getPublicId(product.product_image2));
        }

        if (product.product_image3) {
            await cloudinary.uploader.destroy(getPublicId(product.product_image3));
        }

        if (product.product_image4) {
            await cloudinary.uploader.destroy(getPublicId(product.product_image4));
        }

        if (videoRows.length > 0) {

            const v = videoRows[0];

            if (v.vdo1_url) {
                try {
                    await cloudinary.uploader.destroy(
                        v.vdo1_url,
                        { resource_type: "video" }
                    );
                } catch (err) {
                    console.log("vdo1 delete error:", err);
                }
            }

            if (v.vdo2_url) {
                try {
                    await cloudinary.uploader.destroy(
                        v.vdo2_url,
                        { resource_type: "video" }
                    );
                } catch (err) {
                    console.log("vdo2 delete error:", err);
                }
            }

            if (v.vdo3_url) {
                try {
                    await cloudinary.uploader.destroy(
                        v.vdo3_url,
                        { resource_type: "video" }
                    );
                } catch (err) {
                    console.log("vdo3 delete error:", err);
                }
            }

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
            "DELETE FROM User_Product_Detail WHERE product_id = ?",
            [String(id)]
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