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

async function resolveNames(usernames) {
    const unique = [...new Set(usernames.filter(Boolean))];
    if (unique.length === 0) return {};

    const [founders] = await db.query(
        `SELECT username, full_name FROM founders WHERE username IN (?)`,
        [unique]
    );

    const [admins] = await db.query(
        `SELECT username, name FROM heepitadmin WHERE username IN (?)`,
        [unique]
    );

    const nameMap = {};

    for (const f of founders) {
        if (f.full_name) nameMap[f.username] = f.full_name;
    }

    for (const a of admins) {
        if (!nameMap[a.username] && a.name) nameMap[a.username] = a.name;
    }

    for (const u of unique) {
        if (!nameMap[u]) nameMap[u] = u;
    }

    return nameMap;
}

const addShop = async (req, res) => {
    try {
        const {
            shop_name, shop_category, shop_description,
            shop_demo_price, shop_discount_percentage, shop_highlight_text,
            shop_price, shop_image1, shop_image2, shop_image3, shop_image4,
            shop_status, material, size, printing, delivery, return_days, posted_by,
        } = req.body;

        const [result] = await db.query(
            `INSERT INTO shop_heepit (
                shop_name, shop_category, shop_description,
                shop_demo_price, shop_discount_percentage, shop_highlight_text,
                shop_price, shop_image1, shop_image2, shop_image3, shop_image4,
                shop_total_likes, shop_rating, shop_status,
                posted_by, updated_by, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, NOW())`,
            [
                shop_name, shop_category, shop_description,
                shop_demo_price, shop_discount_percentage, shop_highlight_text,
                shop_price,
                shop_image1 || "", shop_image2 || "",
                shop_image3 || "", shop_image4 || "",
                shop_status, posted_by || null, posted_by || null,
            ]
        );

        const shopId = `S${result.insertId}`;

        await db.query(
            `UPDATE shop_heepit SET shop_id = ? WHERE id = ?`,
            [shopId, result.insertId]
        );

        await upsertProductDetails(shopId, {
            category: shop_category,
            material, size, printing, delivery, return_days,
        });

        return res.json({
            success: true,
            shop_id: shopId,
            message: "Shop Added Successfully",
        });
    } catch (err) {
        return serverError(res, err);
    }
};

const getShops = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM shop_heepit ORDER BY shop_id DESC`
        );

        if (!rows.length) {
            return res.json({ success: true, data: [] });
        }

        const usernames = [];
        for (const shop of rows) {
            if (shop.posted_by) usernames.push(shop.posted_by);
            if (shop.updated_by) usernames.push(shop.updated_by);
        }

        const nameMap = await resolveNames(usernames);

        const result = rows.map((shop) => ({
            ...shop,
            posted_by_name: shop.posted_by ? nameMap[shop.posted_by] : null,
            updated_by_name: shop.updated_by ? nameMap[shop.updated_by] : null,
        }));

        return res.json({ success: true, data: result });
    } catch (err) {
        return serverError(res, err);
    }
};

const updateShop = async (req, res) => {
    try {
        const {
            shop_id, shop_name, shop_category, shop_description,
            shop_demo_price, shop_discount_percentage, shop_highlight_text,
            shop_image1, shop_image2, shop_image3, shop_image4,
            shop_image1_public_id, shop_image2_public_id,
            shop_image3_public_id, shop_image4_public_id,
            material, size, printing, delivery, return_days,
            vdo1, vdo1_public_id, vdo2, vdo2_public_id, vdo3, vdo3_public_id,
            shop_status, updated_by,
        } = req.body;

        const shop_price = calcFinalPrice(shop_demo_price, shop_discount_percentage);

        await db.query(
            `UPDATE shop_heepit SET
                shop_name = ?, shop_category = ?, shop_description = ?,
                shop_demo_price = ?, shop_discount_percentage = ?,
                shop_highlight_text = ?, shop_price = ?,
                shop_image1 = ?, shop_image1_public_id = ?,
                shop_image2 = ?, shop_image2_public_id = ?,
                shop_image3 = ?, shop_image3_public_id = ?,
                shop_image4 = ?, shop_image4_public_id = ?,
                shop_status = ?, updated_by = ?, updated_at = NOW()
             WHERE shop_id = ?`,
            [
                shop_name, shop_category, shop_description,
                shop_demo_price, shop_discount_percentage,
                shop_highlight_text, shop_price,
                shop_image1 || "", shop_image1_public_id || "",
                shop_image2 || "", shop_image2_public_id || "",
                shop_image3 || "", shop_image3_public_id || "",
                shop_image4 || "", shop_image4_public_id || "",
                shop_status, updated_by || null, shop_id,
            ]
        );

        await upsertProductDetails(shop_id, {
            category: shop_category,
            material, size, printing, delivery, return_days,
            vdo1, vdo1_url: vdo1_public_id,
            vdo2, vdo2_url: vdo2_public_id,
            vdo3, vdo3_url: vdo3_public_id,
        });

        return res.json({ success: true, message: "Shop Updated Successfully" });
    } catch (err) {
        return serverError(res, err);
    }
};

const deleteShop = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT shop_image1, shop_image2, shop_image3, shop_image4
             FROM shop_heepit WHERE shop_id = ?`,
            [id]
        );

        if (rows.length === 0) return notFound(res, "Shop Not Found");

        const shop = rows[0];

        const [videoRows] = await db.query(
            `SELECT vdo1_url, vdo2_url, vdo3_url
             FROM product_details_heepit WHERE product_id = ?`,
            [id]
        );

        await deleteCloudinaryImages([
            shop.shop_image1,
            shop.shop_image2,
            shop.shop_image3,
            shop.shop_image4,
        ]);

        if (videoRows.length > 0) {
            const v = videoRows[0];
            await deleteCloudinaryImages([v.vdo1_url, v.vdo2_url, v.vdo3_url], "video");
        }

        await db.query(`DELETE FROM likes_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM ratings_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM product_details_heepit WHERE product_id = ?`, [id]);
        await db.query(`DELETE FROM shop_heepit WHERE shop_id = ?`, [id]);

        return res.json({ success: true, message: "Shop Deleted" });
    } catch (err) {
        return serverError(res, err);
    }
};

module.exports = {
    getShops,
    addShop,
    updateShop,
    deleteShop,
};