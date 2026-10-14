const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

const CLOUDINARY_FOLDER = "aerodeck/open_offers";

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function notFound(res, message = "Not found") {
    return res.status(404).json({ success: false, message });
}

async function uploadToCloudinary(fileBuffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: CLOUDINARY_FOLDER, resource_type: "image" },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(fileBuffer);
    });
}

async function deleteFromCloudinary(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error("Cloudinary delete error:", err.message);
    }
}

async function getOfferPublicId(id) {
    const [rows] = await db.query(
        `SELECT image_public_id FROM open_offer_heepit WHERE id = ?`,
        [id]
    );
    return rows.length ? rows[0].image_public_id : null;
}

const createOffer = async (req, res) => {
    try {
        const {
            shop_name, category, offer_percent, description,
            price, rating, customer_count, valid_at,
        } = req.body;

        if (!shop_name || !category || !offer_percent || !price || !valid_at)
            return res.status(400).json({ success: false, message: "Required fields missing" });

        let imageUrl = null;
        let imageId = null;

        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file.buffer);
            imageUrl = uploadResult.secure_url;
            imageId = uploadResult.public_id;
        }

        const [result] = await db.query(
            `INSERT INTO open_offer_heepit
             (shop_name, category, offer_percent, description, price, rating,
              customer_count, valid_at, image_url, image_public_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shop_name, category, offer_percent, description || null,
                price, rating || null, customer_count || 0,
                valid_at, imageUrl, imageId,
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Open Offer created successfully",
            data: {
                id: result.insertId,
                shop_name, category, offer_percent, description, price, rating,
                customer_count: customer_count || 0, valid_at,
                image_url: imageUrl, image_public_id: imageId,
            },
        });
    } catch (err) {
        return serverError(res, err, "CREATE OPEN OFFER ERROR:");
    }
};

const getAllOffers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM open_offer_heepit ORDER BY created_at DESC`
        );
        return res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        return serverError(res, err, "GET OPEN OFFERS ERROR:");
    }
};

const getActiveOffers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM open_offer_heepit
             WHERE valid_at > NOW()
             ORDER BY created_at DESC`
        );
        return res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        return serverError(res, err, "GET ACTIVE OPEN OFFERS ERROR:");
    }
};

const countOffers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT COUNT(*) AS totalOffers FROM open_offer_heepit`
        );
        return res.json({ success: true, totalOffers: rows[0].totalOffers });
    } catch (err) {
        return serverError(res, err, "COUNT OPEN OFFERS ERROR:");
    }
};

const incrementCustomerCount = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            `UPDATE open_offer_heepit
             SET customer_count = customer_count + 1
             WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0)
            return notFound(res, "Open Offer not found");

        const [rows] = await db.query(
            `SELECT customer_count FROM open_offer_heepit WHERE id = ?`,
            [id]
        );

        return res.json({
            success: true,
            message: "Customer count updated",
            customer_count: rows[0].customer_count,
        });
    } catch (err) {
        return serverError(res, err, "INCREMENT COUNT ERROR:");
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const publicId = await getOfferPublicId(id);

        if (publicId === null)
            return notFound(res, "Open Offer not found");

        await deleteFromCloudinary(publicId);
        await db.query(`DELETE FROM open_offer_heepit WHERE id = ?`, [id]);

        return res.json({ success: true, message: "Open Offer deleted successfully" });
    } catch (err) {
        return serverError(res, err, "DELETE OPEN OFFER ERROR:");
    }
};

const updateOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            shop_name, category, offer_percent, description,
            price, rating, customer_count, valid_at,
        } = req.body;

        const oldPublicId = await getOfferPublicId(id);

        if (oldPublicId === null)
            return notFound(res, "Open Offer not found");

        let imageUrl = null;
        let imageId = null;
        let imageChanged = false;

        if (req.file) {
            await deleteFromCloudinary(oldPublicId);

            const uploadResult = await uploadToCloudinary(req.file.buffer);
            imageUrl = uploadResult.secure_url;
            imageId = uploadResult.public_id;
            imageChanged = true;
        }

        let sql = `
            UPDATE open_offer_heepit SET
                shop_name = ?, category = ?, offer_percent = ?,
                description = ?, price = ?, rating = ?,
                customer_count = ?, valid_at = ?
        `;

        const values = [
            shop_name, category, offer_percent, description || null,
            price, rating || null, customer_count || 0, valid_at,
        ];

        if (imageChanged) {
            sql += `, image_url = ?, image_public_id = ?`;
            values.push(imageUrl, imageId);
        }

        sql += ` WHERE id = ?`;
        values.push(id);

        await db.query(sql, values);

        return res.json({
            success: true,
            message: "Open Offer updated successfully",
            data: {
                id, shop_name, category, offer_percent, description, price, rating,
                customer_count: customer_count || 0, valid_at,
                ...(imageChanged && { image_url: imageUrl, image_public_id: imageId }),
            },
        });
    } catch (err) {
        return serverError(res, err, "UPDATE OPEN OFFER ERROR:");
    }
};

module.exports = {
    createopen_offer_heepit: createOffer,
    getAllopen_offer_heepits: getAllOffers,
    getActiveopen_offer_heepits: getActiveOffers,
    countopen_offer_heepits: countOffers,
    incrementCustomerCount,
    deleteopen_offer_heepit: deleteOffer,
    updateopen_offer_heepit: updateOffer,
};