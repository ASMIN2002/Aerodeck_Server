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

async function deleteCloudinaryImages(images) {
    for (const url of images) {
        if (!url) continue;
        try {
            const publicId = getPublicId(url);
            if (publicId) await cloudinary.uploader.destroy(publicId);
        } catch (err) {
            console.error("CLOUDINARY DELETE ERROR:", err.message);
        }
    }
}

async function upsertProductDetails(product_id, category, details) {
    const [result] = await db.query(
        `UPDATE product_details_heepit
         SET material = ?, size = ?, printing = ?, delivery = ?,
             return_days = ?, video_link = ?
         WHERE product_id = ?`,
        [
            details.material || "",
            details.size || "",
            details.printing || "",
            details.delivery || "",
            details.return_days === "" ? null : details.return_days,
            details.video_link || "",
            product_id,
        ]
    );

    if (result.affectedRows === 0) {
        await db.query(
            `INSERT INTO product_details_heepit
             (product_id, category, material, size, printing, delivery, return_days, video_link)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                product_id,
                category || "",
                details.material || "",
                details.size || "",
                details.printing || "",
                details.delivery || "",
                details.return_days === "" ? null : details.return_days,
                details.video_link || "",
            ]
        );
    }
}

const addGift = async (req, res) => {
    try {
        const {
            gift_name, gift_category, gift_description,
            gift_demo_price, gift_discount_percentage, gift_highlight_text,
            gift_price, gift_image1, gift_image2, gift_image3, gift_image4,
            gift_status, material, size, printing, delivery, return_days, video_link,
        } = req.body;

        const [result] = await db.query(
            `INSERT INTO food_heepit (
                gift_name, gift_category, gift_description,
                gift_demo_price, gift_discount_percentage, gift_highlight_text,
                gift_price, gift_image1, gift_image2, gift_image3, gift_image4,
                gift_total_likes, gift_rating, gift_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
            [
                gift_name, gift_category, gift_description,
                gift_demo_price, gift_discount_percentage, gift_highlight_text,
                gift_price, gift_image1, gift_image2, gift_image3, gift_image4,
                gift_status,
            ]
        );

        const giftId = `G${result.insertId}`;

        await db.query(
            `UPDATE food_heepit SET gift_id = ? WHERE id = ?`,
            [giftId, result.insertId]
        );

        await db.query(
            `INSERT INTO product_details_heepit
             (product_id, category, material, size, printing, delivery, return_days, video_link)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                giftId, gift_category,
                material || "", size || "", printing || "",
                delivery || "", return_days || null, video_link || "",
            ]
        );

        return res.json({ success: true, message: "Gift Added Successfully" });
    } catch (err) {
        return serverError(res, err);
    }
};

const getGifts = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM food_heepit ORDER BY gift_id DESC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

const updateGift = async (req, res) => {
    try {
        const {
            gift_id, gift_name, gift_category, gift_description,
            gift_demo_price, gift_discount_percentage, gift_highlight_text,
            gift_image1, gift_image2, gift_image3, gift_image4,
            gift_image1_public_id, gift_image2_public_id,
            gift_image3_public_id, gift_image4_public_id,
            material, size, printing, delivery, return_days, video_link,
            gift_status,
        } = req.body;

        const gift_price = (
            Number(gift_demo_price) -
            (Number(gift_demo_price) * Number(gift_discount_percentage)) / 100
        ).toFixed(2);

        await db.query(
            `UPDATE food_heepit SET
                gift_name = ?, gift_category = ?, gift_description = ?,
                gift_demo_price = ?, gift_discount_percentage = ?, gift_highlight_text = ?,
                gift_price = ?,
                gift_image1 = ?, gift_image1_public_id = ?,
                gift_image2 = ?, gift_image2_public_id = ?,
                gift_image3 = ?, gift_image3_public_id = ?,
                gift_image4 = ?, gift_image4_public_id = ?,
                gift_status = ?
             WHERE gift_id = ?`,
            [
                gift_name, gift_category, gift_description,
                gift_demo_price, gift_discount_percentage, gift_highlight_text,
                gift_price,
                gift_image1, gift_image1_public_id,
                gift_image2, gift_image2_public_id,
                gift_image3, gift_image3_public_id,
                gift_image4, gift_image4_public_id,
                gift_status, gift_id,
            ]
        );

        await upsertProductDetails(String(gift_id), gift_category, {
            material, size, printing, delivery, return_days, video_link,
        });

        return res.json({ success: true, message: "Gift Updated Successfully" });
    } catch (err) {
        return serverError(res, err);
    }
};

const deleteGift = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT gift_image1, gift_image2, gift_image3, gift_image4
             FROM food_heepit WHERE gift_id = ?`,
            [id]
        );

        if (rows.length === 0)
            return res.status(404).json({ success: false, message: "Gift Not Found" });

        const gift = rows[0];

        await deleteCloudinaryImages([
            gift.gift_image1,
            gift.gift_image2,
            gift.gift_image3,
            gift.gift_image4,
        ]);

        await db.query(`DELETE FROM likes_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM ratings_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM product_details_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM food_heepit WHERE gift_id = ?`, [id]);

        return res.json({ success: true, message: "Gift Deleted" });
    } catch (err) {
        return serverError(res, err);
    }
};

module.exports = {
    getGifts,
    addGift,
    updateGift,
    deleteGift,
};