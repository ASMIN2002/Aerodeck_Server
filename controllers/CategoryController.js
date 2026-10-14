const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

const ALLOWED_TYPES = ["SHOP", "GIFT", "FOOD", "CARDS", "MEDICAL"];
const CLOUDINARY_FOLDER = "aerodeck/categories";

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function validateCategoryInput(catname, category) {
    if (!catname || !category?.trim())
        return { error: "Type and Category are required" };

    if (!ALLOWED_TYPES.includes(catname))
        return { error: "Invalid category type" };

    return { valid: true };
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

const addCategory = async (req, res) => {
    try {
        const { catname, category } = req.body;

        const validation = validateCategoryInput(catname, category);
        if (validation.error)
            return res.status(400).json({ success: false, message: validation.error });

        if (!req.file)
            return res.status(400).json({ success: false, message: "Image is required" });

        const uploadResult = await uploadToCloudinary(req.file.buffer);
        const imageUrl = uploadResult.secure_url;
        const imageId = uploadResult.public_id;

        const [result] = await db.query(
            `INSERT INTO all_category (catname, category, image, imageid)
             VALUES (?, ?, ?, ?)`,
            [catname, category.trim(), imageUrl, imageId]
        );

        return res.status(201).json({
            success: true,
            message: "Category Added Successfully",
            data: {
                catid: result.insertId,
                catname,
                category: category.trim(),
                image: imageUrl,
                imageid: imageId,
            },
        });
    } catch (err) {
        return serverError(res, err, "ADD CATEGORY ERROR:");
    }
};

const getCategories = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT catid, catname, category, image, imageid
             FROM all_category
             ORDER BY catid DESC`
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "GET CATEGORY ERROR:");
    }
};

const updateCategory = async (req, res) => {
    try {
        const { catid } = req.params;
        const { catname, category } = req.body;

        if (!catid)
            return res.status(400).json({ success: false, message: "Category ID required" });

        const validation = validateCategoryInput(catname, category);
        if (validation.error)
            return res.status(400).json({ success: false, message: validation.error });

        const [check] = await db.query(
            `SELECT catid FROM all_category WHERE catid = ? LIMIT 1`,
            [catid]
        );

        if (check.length === 0)
            return res.status(404).json({ success: false, message: "Category not found" });

        await db.query(
            `UPDATE all_category SET catname = ?, category = ? WHERE catid = ?`,
            [catname, category.trim(), catid]
        );

        return res.json({
            success: true,
            message: "Category Updated Successfully",
            data: { catid: Number(catid), catname, category: category.trim() },
        });
    } catch (err) {
        return serverError(res, err, "UPDATE CATEGORY ERROR:");
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { catid } = req.params;

        if (!catid)
            return res.status(400).json({ success: false, message: "Category ID required" });

        const [rows] = await db.query(
            `SELECT imageid FROM all_category WHERE catid = ? LIMIT 1`,
            [catid]
        );

        if (rows.length === 0)
            return res.status(404).json({ success: false, message: "Category not found" });

        const imageId = rows[0].imageid;

        if (imageId) {
            try {
                await cloudinary.uploader.destroy(imageId);
            } catch (cloudErr) {
                console.error("CLOUDINARY DELETE ERROR:", cloudErr.message);
            }
        }

        await db.query(`DELETE FROM all_category WHERE catid = ?`, [catid]);

        return res.json({ success: true, message: "Category Deleted Successfully" });
    } catch (err) {
        return serverError(res, err, "DELETE CATEGORY ERROR:");
    }
};

module.exports = {
    addCategory,
    getCategories,
    updateCategory,
    deleteCategory,
};