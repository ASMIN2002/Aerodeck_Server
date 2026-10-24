const db = require("../../config/db");
const cloudinary = require("../../config/cloudinary");

const getMedicines = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM medicine_heepit ORDER BY medicine_created_at DESC`
        );

        return res.json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (err) {
        console.error("GET MEDICINES ERROR:", err.message);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

const getMedicineById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT * FROM medicine_heepit WHERE medicine_id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medicine not found",
            });
        }

        const [detailRows] = await db.query(
            `SELECT * FROM product_details_heepit WHERE product_id = ? LIMIT 1`,
            [String(id)]
        );

        return res.json({
            success: true,
            data: {
                ...rows[0],
                productDetail: detailRows.length ? detailRows[0] : null,
            },
        });
    } catch (err) {
        console.error("GET MEDICINE ERROR:", err.message);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

const addMedicine = async (req, res) => {
    try {
        const {
            medicine_name,
            medicine_description,
            medicine_category,
            medicine_company,
            medicine_price,
            medicine_demo_price,
            medicine_discount_percentage,
            medicine_rating,
            medicine_highlight_text,
            medicine_prescription_required,
            medicine_status,
            medicine_image1,
            medicine_image1_public_id,
            medicine_image2,
            medicine_image2_public_id,
            medicine_image3,
            medicine_image3_public_id,
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
        } = req.body;

        if (!medicine_name || !medicine_price) {
            return res.status(400).json({
                success: false,
                message: "medicine_name and medicine_price required",
            });
        }

        const [lastRows] = await db.query(
            `SELECT medicine_id FROM medicine_heepit
             WHERE medicine_id LIKE 'M%'
             ORDER BY CAST(SUBSTRING(medicine_id, 2) AS UNSIGNED) DESC
             LIMIT 1`
        );

        let nextNumber = 1;
        if (lastRows.length > 0) {
            const lastId = lastRows[0].medicine_id;
            nextNumber = parseInt(lastId.substring(1), 10) + 1;
        }

        const newMedicineId = `M${nextNumber}`;

        await db.query(
            `INSERT INTO medicine_heepit (
                medicine_id, medicine_name, medicine_description,
                medicine_category, medicine_company,
                medicine_price, medicine_demo_price,
                medicine_discount_percentage, medicine_rating,
                medicine_highlight_text, medicine_prescription_required,
                medicine_status,
                medicine_image1, medicine_image1_public_id,
                medicine_image2, medicine_image2_public_id,
                medicine_image3, medicine_image3_public_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newMedicineId,
                medicine_name,
                medicine_description || null,
                medicine_category || null,
                medicine_company || null,
                medicine_price,
                medicine_demo_price || null,
                medicine_discount_percentage || 0,
                medicine_rating || 0,
                medicine_highlight_text || null,
                medicine_prescription_required ? 1 : 0,
                medicine_status ? 1 : 0,
                medicine_image1 || null,
                medicine_image1_public_id || null,
                medicine_image2 || null,
                medicine_image2_public_id || null,
                medicine_image3 || null,
                medicine_image3_public_id || null,
            ]
        );

        await db.query(
            `INSERT INTO product_details_heepit
             (product_id, category, material, size, printing, delivery, return_days,
              vdo1, vdo1_url, vdo2, vdo2_url, vdo3, vdo3_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                newMedicineId,
                medicine_category || "",
                material || "",
                size || "",
                printing || "",
                delivery || "",
                return_days || null,
                vdo1 || "",
                vdo1_public_id || "",
                vdo2 || "",
                vdo2_public_id || "",
                vdo3 || "",
                vdo3_public_id || "",
            ]
        );

        return res.json({
            success: true,
            medicine_id: newMedicineId,
            message: "Medicine Added Successfully",
        });
    } catch (err) {
        console.error("ADD MEDICINE ERROR:", err.message);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

const updateMedicine = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            medicine_name,
            medicine_description,
            medicine_category,
            medicine_company,
            medicine_price,
            medicine_demo_price,
            medicine_discount_percentage,
            medicine_rating,
            medicine_highlight_text,
            medicine_prescription_required,
            medicine_status,
            medicine_image1,
            medicine_image1_public_id,
            medicine_image2,
            medicine_image2_public_id,
            medicine_image3,
            medicine_image3_public_id,
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
        } = req.body;

        const [existing] = await db.query(
            `SELECT medicine_id FROM medicine_heepit WHERE medicine_id = ?`,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medicine not found",
            });
        }

        await db.query(
            `UPDATE medicine_heepit SET
                medicine_name = ?,
                medicine_description = ?,
                medicine_category = ?,
                medicine_company = ?,
                medicine_price = ?,
                medicine_demo_price = ?,
                medicine_discount_percentage = ?,
                medicine_rating = ?,
                medicine_highlight_text = ?,
                medicine_prescription_required = ?,
                medicine_status = ?,
                medicine_image1 = ?,
                medicine_image1_public_id = ?,
                medicine_image2 = ?,
                medicine_image2_public_id = ?,
                medicine_image3 = ?,
                medicine_image3_public_id = ?
             WHERE medicine_id = ?`,
            [
                medicine_name,
                medicine_description || null,
                medicine_category || null,
                medicine_company || null,
                medicine_price,
                medicine_demo_price || null,
                medicine_discount_percentage || 0,
                medicine_rating || 0,
                medicine_highlight_text || null,
                medicine_prescription_required ? 1 : 0,
                medicine_status ? 1 : 0,
                medicine_image1 || null,
                medicine_image1_public_id || null,
                medicine_image2 || null,
                medicine_image2_public_id || null,
                medicine_image3 || null,
                medicine_image3_public_id || null,
                id,
            ]
        );

        const [detailExists] = await db.query(
            `SELECT id FROM product_details_heepit WHERE product_id = ? LIMIT 1`,
            [String(id)]
        );

        if (detailExists.length > 0) {
            await db.query(
                `UPDATE product_details_heepit SET
                    category = ?, material = ?, size = ?, printing = ?,
                    delivery = ?, return_days = ?,
                    vdo1 = ?, vdo1_url = ?, vdo2 = ?, vdo2_url = ?,
                    vdo3 = ?, vdo3_url = ?
                 WHERE product_id = ?`,
                [
                    medicine_category || "",
                    material || "",
                    size || "",
                    printing || "",
                    delivery || "",
                    return_days || null,
                    vdo1 || "",
                    vdo1_public_id || "",
                    vdo2 || "",
                    vdo2_public_id || "",
                    vdo3 || "",
                    vdo3_public_id || "",
                    String(id),
                ]
            );
        } else {
            await db.query(
                `INSERT INTO product_details_heepit
                 (product_id, category, material, size, printing, delivery, return_days,
                  vdo1, vdo1_url, vdo2, vdo2_url, vdo3, vdo3_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    String(id),
                    medicine_category || "",
                    material || "",
                    size || "",
                    printing || "",
                    delivery || "",
                    return_days || null,
                    vdo1 || "",
                    vdo1_public_id || "",
                    vdo2 || "",
                    vdo2_public_id || "",
                    vdo3 || "",
                    vdo3_public_id || "",
                ]
            );
        }

        return res.json({
            success: true,
            message: "Medicine Updated Successfully",
        });
    } catch (err) {
        console.error("UPDATE MEDICINE ERROR:", err.message);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

const deleteMedicine = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT medicine_image1_public_id,
                    medicine_image2_public_id,
                    medicine_image3_public_id
             FROM medicine_heepit WHERE medicine_id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Medicine not found",
            });
        }

        const med = rows[0];
        const publicIds = [
            med.medicine_image1_public_id,
            med.medicine_image2_public_id,
            med.medicine_image3_public_id,
        ].filter(Boolean);

        for (const publicId of publicIds) {
            try {
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error("CLOUDINARY DELETE ERROR:", err.message);
            }
        }

        const [videoRows] = await db.query(
            `SELECT vdo1_url, vdo2_url, vdo3_url
             FROM product_details_heepit WHERE product_id = ?`,
            [String(id)]
        );

        if (videoRows.length > 0) {
            const vids = [
                videoRows[0].vdo1_url,
                videoRows[0].vdo2_url,
                videoRows[0].vdo3_url,
            ].filter(Boolean);

            for (const vid of vids) {
                try {
                    await cloudinary.uploader.destroy(vid, { resource_type: "video" });
                } catch (err) {
                    console.error("CLOUDINARY VIDEO DELETE ERROR:", err.message);
                }
            }
        }

        await db.query(
            `DELETE FROM product_details_heepit WHERE product_id = ?`,
            [String(id)]
        );

        await db.query(
            `DELETE FROM medicine_heepit WHERE medicine_id = ?`,
            [id]
        );

        return res.json({
            success: true,
            message: "Medicine Deleted Successfully",
        });
    } catch (err) {
        console.error("DELETE MEDICINE ERROR:", err.message);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};

module.exports = {
    getMedicines,
    getMedicineById,
    addMedicine,
    updateMedicine,
    deleteMedicine,
};