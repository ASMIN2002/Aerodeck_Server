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

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function notFound(res, message = "Not found") {
    return res.status(404).json({ success: false, message });
}

function calcFinalPrice(demoPrice, discountPercent) {
    return (
        Number(demoPrice) -
        (Number(demoPrice) * Number(discountPercent)) / 100
    ).toFixed(2);
}

async function deleteCloudinaryImages(images, resourceType = "image") {
    for (const url of images) {
        if (!url) continue;
        try {
            const publicId = getPublicId(url);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            }
        } catch (err) {
            console.error("CLOUDINARY DELETE ERROR:", err.message);
        }
    }
}

async function upsertProductDetails(product_id, data) {
    const [result] = await db.query(
        `UPDATE product_details_heepit
         SET category = ?, material = ?, size = ?, printing = ?,
             delivery = ?, return_days = ?, vdo1 = ?, vdo1_url = ?,
             vdo2 = ?, vdo2_url = ?, vdo3 = ?, vdo3_url = ?
         WHERE product_id = ?`,
        [
            data.category || "", data.material || "", data.size || "",
            data.printing || "", data.delivery || "",
            data.return_days === "" ? null : data.return_days,
            data.vdo1 || "", data.vdo1_url || "",
            data.vdo2 || "", data.vdo2_url || "",
            data.vdo3 || "", data.vdo3_url || "",
            String(product_id),
        ]
    );

    if (result.affectedRows === 0) {
        await db.query(
            `INSERT INTO product_details_heepit
             (product_id, category, material, size, printing, delivery,
              return_days, vdo1, vdo1_url, vdo2, vdo2_url, vdo3, vdo3_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(product_id), data.category || "", data.material || "",
                data.size || "", data.printing || "", data.delivery || "",
                data.return_days === "" ? null : data.return_days,
                data.vdo1 || "", data.vdo1_url || "",
                data.vdo2 || "", data.vdo2_url || "",
                data.vdo3 || "", data.vdo3_url || "",
            ]
        );
    }
}

const addProduct = async (req, res) => {
    try {
        const {
            product_name, product_category, product_description,
            product_demo_price, product_discount_percentage, product_highlight_text,
            product_price, product_image1, product_image2, product_image3, product_image4,
            product_status, material, size, printing, delivery, return_days, posted_by,
        } = req.body;

        const [result] = await db.query(
            `INSERT INTO cards_heepit (
                product_name, product_category, product_description,
                product_demo_price, product_discount_percentage, product_highlight_text,
                product_price, product_image1, product_image2, product_image3, product_image4,
                product_total_likes, product_rating, product_status,
                posted_by, updated_by, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, NOW())`,
            [
                product_name, product_category, product_description,
                product_demo_price, product_discount_percentage, product_highlight_text,
                product_price,
                product_image1 || "", product_image2 || "",
                product_image3 || "", product_image4 || "",
                product_status, posted_by || null, posted_by || null,
            ]
        );

        const newProductId = result.insertId;

        await upsertProductDetails(newProductId, {
            category: product_category,
            material, size, printing, delivery, return_days,
        });

        return res.json({
            success: true,
            product_id: newProductId,
            message: "Product Added Successfully",
        });
    } catch (err) {
        return serverError(res, err);
    }
};

const addOffer = async (req, res) => {
    try {
        const {
            offer_name, offer_description, offer_demo_price,
            offer_discount_percentage, offer_highlight_text, offer_price,
            offer_image1, offer_image2, offer_image3,
            offer_status, offer_expired_at,
        } = req.body;

        await db.query(
            `INSERT INTO offers_heepit (
                offer_name, offer_description, offer_demo_price,
                offer_discount_percentage, offer_highlight_text, offer_price,
                offer_image1, offer_image2, offer_image3,
                offer_status, offer_expired_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                offer_name, offer_description, offer_demo_price,
                offer_discount_percentage, offer_highlight_text, offer_price,
                offer_image1 || "", offer_image2 || "", offer_image3 || "",
                offer_status, offer_expired_at,
            ]
        );

        return res.json({ success: true, message: "Offer Added Successfully" });
    } catch (err) {
        return serverError(res, err);
    }
};

const getProducts = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM cards_heepit ORDER BY product_id DESC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

const getOffers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM offers_heepit ORDER BY offer_id DESC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

const updateProduct = async (req, res) => {
    try {
        const {
            product_id, product_name, product_category, product_description,
            product_demo_price, product_discount_percentage, product_highlight_text,
            product_image1, product_image2, product_image3, product_image4,
            product_image1_public_id, product_image2_public_id,
            product_image3_public_id, product_image4_public_id,
            product_status, updated_by,
            material, size, printing, delivery, return_days,
            vdo1, vdo1_public_id, vdo2, vdo2_public_id, vdo3, vdo3_public_id,
        } = req.body;

        const product_price = calcFinalPrice(product_demo_price, product_discount_percentage);

        await db.query(
            `UPDATE cards_heepit SET
                product_name = ?, product_category = ?, product_description = ?,
                product_demo_price = ?, product_discount_percentage = ?,
                product_highlight_text = ?, product_price = ?,
                product_image1 = ?, product_image1_public_id = ?,
                product_image2 = ?, product_image2_public_id = ?,
                product_image3 = ?, product_image3_public_id = ?,
                product_image4 = ?, product_image4_public_id = ?,
                product_status = ?, updated_by = ?, updated_at = NOW()
             WHERE product_id = ?`,
            [
                product_name, product_category, product_description,
                product_demo_price, product_discount_percentage,
                product_highlight_text, product_price,
                product_image1 || "", product_image1_public_id || "",
                product_image2 || "", product_image2_public_id || "",
                product_image3 || "", product_image3_public_id || "",
                product_image4 || "", product_image4_public_id || "",
                product_status, updated_by || null, product_id,
            ]
        );

        await upsertProductDetails(product_id, {
            category: product_category,
            material, size, printing, delivery, return_days,
            vdo1, vdo1_url: vdo1_public_id,
            vdo2, vdo2_url: vdo2_public_id,
            vdo3, vdo3_url: vdo3_public_id,
        });

        return res.json({ success: true, message: "Product Updated Successfully" });
    } catch (err) {
        return serverError(res, err);
    }
};

const updateOfferStatus = async (req, res) => {
    try {
        const { offer_id, offer_status } = req.body;

        await db.query(
            `UPDATE offers_heepit SET offer_status = ? WHERE offer_id = ?`,
            [offer_status, offer_id]
        );

        return res.json({ success: true, message: "Offer Status Updated" });
    } catch (err) {
        return serverError(res, err);
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT offer_image1, offer_image2, offer_image3
             FROM offers_heepit WHERE offer_id = ?`,
            [id]
        );

        if (rows.length === 0) return notFound(res, "Offer Not Found");

        const offer = rows[0];

        await deleteCloudinaryImages([
            offer.offer_image1,
            offer.offer_image2,
            offer.offer_image3,
        ]);

        await db.query(`DELETE FROM offers_heepit WHERE offer_id = ?`, [id]);

        return res.json({ success: true, message: "Offer Deleted Successfully" });
    } catch (err) {
        return serverError(res, err);
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT product_image1, product_image2, product_image3, product_image4
             FROM cards_heepit WHERE product_id = ?`,
            [id]
        );

        if (rows.length === 0) return notFound(res, "Product Not Found");

        const product = rows[0];

        const [videoRows] = await db.query(
            `SELECT vdo1_url, vdo2_url, vdo3_url
             FROM product_details_heepit WHERE product_id = ?`,
            [String(id)]
        );

        await deleteCloudinaryImages([
            product.product_image1,
            product.product_image2,
            product.product_image3,
            product.product_image4,
        ]);

        if (videoRows.length > 0) {
            const v = videoRows[0];
            await deleteCloudinaryImages([v.vdo1_url, v.vdo2_url, v.vdo3_url], "video");
        }

        await db.query(`DELETE FROM likes_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM ratings_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM product_details_heepit WHERE product_id = ?`, [String(id)]);
        await db.query(`DELETE FROM cards_heepit WHERE product_id = ?`, [id]);

        return res.json({ success: true, message: "Product Deleted" });
    } catch (err) {
        return serverError(res, err);
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
    deleteOffer,
};