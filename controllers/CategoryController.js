const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

/* ============================================
   ADD CATEGORY
   ============================================ */
const addCategory = async (req, res) => {

    try {

        const { catname, category } = req.body;

        if (!catname || !category?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Type and Category are required"
            });
        }

        const allowedTypes = ["SHOP", "GIFT", "FOOD", "CARDS", "MEDICAL"];

        if (!allowedTypes.includes(catname)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category type"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Image is required"
            });
        }

        const uploadResult = await new Promise(
            (resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "aerodeck/categories",
                        resource_type: "image"
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            }
        );

        const imageUrl = uploadResult.secure_url;
        const imageId = uploadResult.public_id;

        const [result] = await db.query(
            `INSERT INTO ALL_Category
             (catname, category, image, imageid)
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
                imageid: imageId
            }
        });

    } catch (err) {

        console.error("ADD CATEGORY ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

/* ============================================
   GET CATEGORIES
   ============================================ */
const getCategories = async (req, res) => {

    try {

        const [rows] = await db.query(
            `SELECT catid, catname, category, image, imageid
             FROM ALL_Category
             ORDER BY catid DESC`
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        console.error("GET CATEGORY ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

/* ============================================
   UPDATE CATEGORY — catname + category
   ============================================ */
const updateCategory = async (req, res) => {

    try {

        const { catid } = req.params;
        const { catname, category } = req.body;

        if (!catid) {
            return res.status(400).json({
                success: false,
                message: "Category ID required"
            });
        }

        if (!catname || !category?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Type and Category are required"
            });
        }

        const allowedTypes = ["SHOP", "GIFT", "FOOD", "CARDS", "MEDICAL"];

        if (!allowedTypes.includes(catname)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category type"
            });
        }

        const [check] = await db.query(
            `SELECT catid FROM ALL_Category WHERE catid = ? LIMIT 1`,
            [catid]
        );

        if (check.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        await db.query(
            `UPDATE ALL_Category
             SET catname = ?, category = ?
             WHERE catid = ?`,
            [catname, category.trim(), catid]
        );

        return res.json({
            success: true,
            message: "Category Updated Successfully",
            data: {
                catid: Number(catid),
                catname,
                category: category.trim()
            }
        });

    } catch (err) {

        console.error("UPDATE CATEGORY ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

/* ============================================
   DELETE CATEGORY — row + cloudinary image
   ============================================ */
const deleteCategory = async (req, res) => {

    try {

        const { catid } = req.params;

        if (!catid) {
            return res.status(400).json({
                success: false,
                message: "Category ID required"
            });
        }

        const [rows] = await db.query(
            `SELECT imageid FROM ALL_Category WHERE catid = ? LIMIT 1`,
            [catid]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        const imageId = rows[0].imageid;

        /* Cloudinary se image delete */
        if (imageId) {
            try {
                await cloudinary.uploader.destroy(imageId);
            } catch (cloudErr) {
                console.error("CLOUDINARY DELETE ERROR:", cloudErr);
                /* Continue — DB row delete karo */
            }
        }

        await db.query(
            `DELETE FROM ALL_Category WHERE catid = ?`,
            [catid]
        );

        return res.json({
            success: true,
            message: "Category Deleted Successfully"
        });

    } catch (err) {

        console.error("DELETE CATEGORY ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

module.exports = {
    addCategory,
    getCategories,
    updateCategory,
    deleteCategory
};