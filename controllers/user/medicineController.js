const pool = require("../../config/db");
const cloudinary = require("../../config/cloudinary");

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function validateMedicineInput(body, isUpdate = false) {
    const errors = [];
    const { medicine_name, medicine_price, medicine_rating, medicine_discount_percentage } = body;

    if (!isUpdate || medicine_name !== undefined) {
        if (!medicine_name || !String(medicine_name).trim()) errors.push("medicine_name required");
    }
    if (!isUpdate || medicine_price !== undefined) {
        const price = Number(medicine_price);
        if (isNaN(price) || price < 0) errors.push("medicine_price must be >= 0");
    }
    if (medicine_rating !== undefined) {
        const r = Number(medicine_rating);
        if (isNaN(r) || r < 0 || r > 5) errors.push("medicine_rating must be 0-5");
    }
    if (medicine_discount_percentage !== undefined) {
        const d = Number(medicine_discount_percentage);
        if (isNaN(d) || d < 0 || d > 100) errors.push("medicine_discount_percentage must be 0-100");
    }
    return errors;
}

exports.getMedicines = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const [rows] = await pool.query(
            `SELECT
                medicine_id,
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
                medicine_created_at
             FROM medicine_heepit
             ORDER BY medicine_created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return res.json({
            success: true,
            count: rows.length,
            pagination: { limit, offset },
            data: rows,
        });
    } catch (err) {
        return serverError(res, err, "GET MEDICINES ERROR");
    }
};

exports.getMedicineById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT
                medicine_id, medicine_name, medicine_description,
                medicine_category, medicine_company, medicine_price,
                medicine_demo_price, medicine_discount_percentage,
                medicine_rating, medicine_highlight_text,
                medicine_prescription_required, medicine_status,
                medicine_image1, medicine_image2, medicine_image3,
                medicine_created_at
             FROM medicine_heepit WHERE medicine_id = ? LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }

        const [detailRows] = await pool.query(
            `SELECT category, material, size, printing, delivery, return_days,
                    vdo1, vdo1_url, vdo2, vdo2_url, vdo3, vdo3_url
             FROM product_details_heepit WHERE product_id = ? LIMIT 1`,
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
        return serverError(res, err, "GET MEDICINE ERROR");
    }
};

exports.addMedicine = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const body = req.body;
        const errors = validateMedicineInput(body, false);
        if (errors.length > 0) {
            conn.release();
            return res.status(400).json({ success: false, message: errors.join(", ") });
        }

        const {
            medicine_name, medicine_description, medicine_category, medicine_company,
            medicine_price, medicine_demo_price, medicine_discount_percentage,
            medicine_rating, medicine_highlight_text, medicine_prescription_required,
            medicine_status, medicine_image1, medicine_image1_public_id,
            medicine_image2, medicine_image2_public_id,
            medicine_image3, medicine_image3_public_id,
            material, size, printing, delivery, return_days,
            vdo1, vdo1_public_id, vdo2, vdo2_public_id, vdo3, vdo3_public_id,
        } = body;

        await conn.beginTransaction();

        try {
            const [lastRows] = await conn.query(
                `SELECT medicine_id FROM medicine_heepit
                 WHERE medicine_id LIKE 'M%'
                 ORDER BY CAST(SUBSTRING(medicine_id, 2) AS UNSIGNED) DESC
                 LIMIT 1
                 FOR UPDATE`
            );

            let nextNumber = 1;
            if (lastRows.length > 0) {
                const lastId = lastRows[0].medicine_id;
                nextNumber = parseInt(lastId.substring(1), 10) + 1;
            }
            const newMedicineId = `M${nextNumber}`;

            await conn.query(
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
                    newMedicineId, medicine_name,
                    medicine_description || null, medicine_category || null,
                    medicine_company || null, medicine_price,
                    medicine_demo_price || null,
                    medicine_discount_percentage || 0,
                    medicine_rating || 0,
                    medicine_highlight_text || null,
                    medicine_prescription_required ? 1 : 0,
                    medicine_status ? 1 : 0,
                    medicine_image1 || null, medicine_image1_public_id || null,
                    medicine_image2 || null, medicine_image2_public_id || null,
                    medicine_image3 || null, medicine_image3_public_id || null,
                ]
            );

            await conn.query(
                `INSERT INTO product_details_heepit
                 (product_id, category, material, size, printing, delivery, return_days,
                  vdo1, vdo1_url, vdo2, vdo2_url, vdo3, vdo3_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newMedicineId, medicine_category || "",
                    material || "", size || "", printing || "",
                    delivery || "", return_days || null,
                    vdo1 || "", vdo1_public_id || "",
                    vdo2 || "", vdo2_public_id || "",
                    vdo3 || "", vdo3_public_id || "",
                ]
            );

            await conn.commit();
            conn.release();

            return res.json({
                success: true,
                medicine_id: newMedicineId,
                message: "Medicine Added Successfully",
            });
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err, "ADD MEDICINE ERROR");
    }
};

exports.updateMedicine = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const body = req.body;
        const errors = validateMedicineInput(body, true);
        if (errors.length > 0) {
            conn.release();
            return res.status(400).json({ success: false, message: errors.join(", ") });
        }

        const {
            medicine_name, medicine_description, medicine_category, medicine_company,
            medicine_price, medicine_demo_price, medicine_discount_percentage,
            medicine_rating, medicine_highlight_text, medicine_prescription_required,
            medicine_status, medicine_image1, medicine_image1_public_id,
            medicine_image2, medicine_image2_public_id,
            medicine_image3, medicine_image3_public_id,
            material, size, printing, delivery, return_days,
            vdo1, vdo1_public_id, vdo2, vdo2_public_id, vdo3, vdo3_public_id,
        } = body;

        const [existing] = await conn.query(
            `SELECT medicine_id FROM medicine_heepit WHERE medicine_id = ? LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            conn.release();
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }

        await conn.beginTransaction();

        try {
            await conn.query(
                `UPDATE medicine_heepit SET
                    medicine_name = ?, medicine_description = ?,
                    medicine_category = ?, medicine_company = ?,
                    medicine_price = ?, medicine_demo_price = ?,
                    medicine_discount_percentage = ?, medicine_rating = ?,
                    medicine_highlight_text = ?, medicine_prescription_required = ?,
                    medicine_status = ?,
                    medicine_image1 = ?, medicine_image1_public_id = ?,
                    medicine_image2 = ?, medicine_image2_public_id = ?,
                    medicine_image3 = ?, medicine_image3_public_id = ?
                 WHERE medicine_id = ?`,
                [
                    medicine_name, medicine_description || null,
                    medicine_category || null, medicine_company || null,
                    medicine_price, medicine_demo_price || null,
                    medicine_discount_percentage || 0,
                    medicine_rating || 0, medicine_highlight_text || null,
                    medicine_prescription_required ? 1 : 0,
                    medicine_status ? 1 : 0,
                    medicine_image1 || null, medicine_image1_public_id || null,
                    medicine_image2 || null, medicine_image2_public_id || null,
                    medicine_image3 || null, medicine_image3_public_id || null,
                    id,
                ]
            );

            const [detailExists] = await conn.query(
                `SELECT id FROM product_details_heepit WHERE product_id = ? LIMIT 1`,
                [String(id)]
            );

            if (detailExists.length > 0) {
                await conn.query(
                    `UPDATE product_details_heepit SET
                        category = ?, material = ?, size = ?, printing = ?,
                        delivery = ?, return_days = ?,
                        vdo1 = ?, vdo1_url = ?, vdo2 = ?, vdo2_url = ?,
                        vdo3 = ?, vdo3_url = ?
                     WHERE product_id = ?`,
                    [
                        medicine_category || "", material || "",
                        size || "", printing || "", delivery || "",
                        return_days || null,
                        vdo1 || "", vdo1_public_id || "",
                        vdo2 || "", vdo2_public_id || "",
                        vdo3 || "", vdo3_public_id || "",
                        String(id),
                    ]
                );
            } else {
                await conn.query(
                    `INSERT INTO product_details_heepit
                     (product_id, category, material, size, printing, delivery, return_days,
                      vdo1, vdo1_url, vdo2, vdo2_url, vdo3, vdo3_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        String(id), medicine_category || "",
                        material || "", size || "", printing || "",
                        delivery || "", return_days || null,
                        vdo1 || "", vdo1_public_id || "",
                        vdo2 || "", vdo2_public_id || "",
                        vdo3 || "", vdo3_public_id || "",
                    ]
                );
            }

            await conn.commit();
            conn.release();

            return res.json({ success: true, message: "Medicine Updated Successfully" });
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err, "UPDATE MEDICINE ERROR");
    }
};

exports.deleteMedicine = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;

        const [rows] = await conn.query(
            `SELECT medicine_image1_public_id,
                    medicine_image2_public_id,
                    medicine_image3_public_id
             FROM medicine_heepit WHERE medicine_id = ? LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            conn.release();
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }

        const med = rows[0];
        const publicIds = [
            med.medicine_image1_public_id,
            med.medicine_image2_public_id,
            med.medicine_image3_public_id,
        ].filter(Boolean);

        const [videoRows] = await conn.query(
            `SELECT vdo1_url, vdo2_url, vdo3_url
             FROM product_details_heepit WHERE product_id = ?`,
            [String(id)]
        );
        const videoIds = videoRows.length
            ? [videoRows[0].vdo1_url, videoRows[0].vdo2_url, videoRows[0].vdo3_url].filter(Boolean)
            : [];

        await conn.beginTransaction();

        try {
            await conn.query(
                `DELETE FROM product_details_heepit WHERE product_id = ?`,
                [String(id)]
            );
            await conn.query(
                `DELETE FROM medicine_heepit WHERE medicine_id = ?`,
                [id]
            );
            await conn.commit();
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }

        conn.release();

        for (const publicId of publicIds) {
            cloudinary.uploader.destroy(publicId)
                .catch((err) => console.error("CLOUDINARY DELETE ERROR:", err.message));
        }
        for (const vid of videoIds) {
            cloudinary.uploader.destroy(vid, { resource_type: "video" })
                .catch((err) => console.error("CLOUDINARY VIDEO DELETE ERROR:", err.message));
        }

        return res.json({ success: true, message: "Medicine Deleted Successfully" });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err, "DELETE MEDICINE ERROR");
    }
};