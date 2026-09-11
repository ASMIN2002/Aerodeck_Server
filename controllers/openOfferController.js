const db = require("../config/db");
const cloudinary = require("../config/cloudinary");


// =====================================
// CREATE OPEN OFFER
// =====================================

const createOpenOffer = async (req, res) => {
    try {
        const {
            shop_name,
            category,
            offer_percent,
            description,
            price,
            rating,
            customer_count,
            valid_at
        } = req.body;

        // -----------------------------
        // VALIDATION
        // -----------------------------

        if (!shop_name || !category || !offer_percent || !price || !valid_at) {
            return res.status(400).json({
                success: false,
                message: "Required fields missing"
            });
        }

        let imageUrl = null;
        let imageId = null;

        // -----------------------------
        // CLOUDINARY UPLOAD (agar image hai)
        // -----------------------------

        if (req.file) {
            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "aerodeck/open_offers",
                        resource_type: "image"
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );

                stream.end(req.file.buffer);
            });

            imageUrl = uploadResult.secure_url;
            imageId = uploadResult.public_id;
        }

        // -----------------------------
        // DATABASE INSERT
        // -----------------------------

        const [result] = await db.query(
            `INSERT INTO OpenOffer
       (shop_name, category, offer_percent, description, price, rating, customer_count, valid_at, image_url, image_public_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shop_name,
                category,
                offer_percent,
                description || null,
                price,
                rating || null,
                customer_count || 0,
                valid_at,
                imageUrl,
                imageId
            ]
        );

        // -----------------------------
        // SUCCESS
        // -----------------------------

        return res.status(201).json({
            success: true,
            message: "Open Offer created successfully",
            data: {
                id: result.insertId,
                shop_name,
                category,
                offer_percent,
                description,
                price,
                rating,
                customer_count: customer_count || 0,
                valid_at,
                image_url: imageUrl,
                image_public_id: imageId
            }
        });

    } catch (err) {
        console.error("CREATE OPEN OFFER ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// =====================================
// GET ALL OPEN OFFERS (Founder)
// =====================================

const getAllOpenOffers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM OpenOffer ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (err) {
        console.error("GET OPEN OFFERS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// =====================================
// GET ACTIVE OPEN OFFERS (User App)
// =====================================

const getActiveOpenOffers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM OpenOffer
       WHERE valid_at > NOW()
       ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (err) {
        console.error("GET ACTIVE OPEN OFFERS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// =====================================
// COUNT OPEN OFFERS
// =====================================

const countOpenOffers = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT COUNT(*) AS totalOffers FROM OpenOffer`
        );

        return res.json({
            success: true,
            totalOffers: rows[0].totalOffers
        });

    } catch (err) {
        console.error("COUNT OPEN OFFERS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// =====================================
// INCREMENT CUSTOMER COUNT (User app)
// =====================================

const incrementCustomerCount = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            `UPDATE OpenOffer
       SET customer_count = customer_count + 1
       WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Open Offer not found"
            });
        }

        const [rows] = await db.query(
            `SELECT customer_count FROM OpenOffer WHERE id = ?`,
            [id]
        );

        return res.json({
            success: true,
            message: "Customer count updated",
            customer_count: rows[0].customer_count
        });

    } catch (err) {
        console.error("INCREMENT COUNT ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


// =====================================
// DELETE OPEN OFFER
// =====================================

const deleteOpenOffer = async (req, res) => {
    try {
        const { id } = req.params;

        // Pehle public_id nikalo
        const [rows] = await db.query(
            `SELECT image_public_id FROM OpenOffer WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Open Offer not found"
            });
        }

        const publicId = rows[0].image_public_id;

        // Cloudinary se delete
        if (publicId) {
            try {
                await cloudinary.uploader.destroy(publicId);
            } catch (cErr) {
                console.error("Cloudinary delete error:", cErr);
            }
        }

        // DB se delete
        await db.query(`DELETE FROM OpenOffer WHERE id = ?`, [id]);

        return res.json({
            success: true,
            message: "Open Offer deleted successfully"
        });

    } catch (err) {
        console.error("DELETE OPEN OFFER ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
// =====================================
// UPDATE OPEN OFFER
// =====================================

const updateOpenOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            shop_name,
            category,
            offer_percent,
            description,
            price,
            rating,
            customer_count,
            valid_at
        } = req.body;

        // Purani row nikalo
        const [rows] = await db.query(
            `SELECT image_public_id FROM OpenOffer WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Open Offer not found"
            });
        }

        const oldPublicId = rows[0].image_public_id;

        let imageUrl = null;
        let imageId = null;
        let imageChanged = false;

        // Agar nayi image aayi
        if (req.file) {
            // Purani image delete karo
            if (oldPublicId) {
                try {
                    await cloudinary.uploader.destroy(oldPublicId);
                } catch (cErr) {
                    console.error("Cloudinary old delete error:", cErr);
                }
            }

            // Nayi upload karo
            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "aerodeck/open_offers",
                        resource_type: "image"
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });

            imageUrl = uploadResult.secure_url;
            imageId = uploadResult.public_id;
            imageChanged = true;
        }

        // Build UPDATE query
        let sql = `
      UPDATE OpenOffer SET
        shop_name = ?,
        category = ?,
        offer_percent = ?,
        description = ?,
        price = ?,
        rating = ?,
        customer_count = ?,
        valid_at = ?
    `;

        const values = [
            shop_name,
            category,
            offer_percent,
            description || null,
            price,
            rating || null,
            customer_count || 0,
            valid_at
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
                id,
                shop_name,
                category,
                offer_percent,
                description,
                price,
                rating,
                customer_count: customer_count || 0,
                valid_at,
                ...(imageChanged && {
                    image_url: imageUrl,
                    image_public_id: imageId
                })
            }
        });

    } catch (err) {
        console.error("UPDATE OPEN OFFER ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


module.exports = {
    createOpenOffer,
    getAllOpenOffers,
    getActiveOpenOffers,
    countOpenOffers,
    incrementCustomerCount,
    deleteOpenOffer,
    updateOpenOffer
};