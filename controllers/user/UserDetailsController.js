const db = require("../../config/db");

const PRODUCT_TABLES = {
    gift: {
        table: "food_heepit",
        idColumn: "gift_id",
        columns: `gift_id, gift_name, gift_description, gift_category, gift_company,
                  gift_price, gift_demo_price, gift_discount_percentage, gift_rating,
                  gift_highlight_text, gift_status,
                  gift_image1, gift_image2, gift_image3, gift_image4,
                  gift_total_likes, gift_total_saves, gift_created_at`,
    },
    medicine: {
        table: "medicine_heepit",
        idColumn: "medicine_id",
        columns: `medicine_id, medicine_name, medicine_description, medicine_category,
              medicine_company, medicine_price, medicine_demo_price,
              medicine_discount_percentage, medicine_rating, medicine_highlight_text,
              medicine_prescription_required, medicine_status,
              medicine_image1, medicine_image2, medicine_image3,
              medicine_created_at`,
    },
    card: {
        table: "cards_heepit",
        idColumn: "product_id",
        columns: `product_id, product_name, product_description, product_category,
                  product_price, product_demo_price, product_discount_percentage,
                  product_rating, product_highlight_text, product_status,
                  product_image1, product_image2, product_image3, product_image4,
                  product_total_likes, product_total_saves, product_created_at`,
    },
    shop: {
        table: "shop_heepit",
        idColumn: "shop_id",
        columns: `shop_id, shop_name, shop_description, shop_category,
                  shop_price, shop_demo_price, shop_discount_percentage,
                  shop_rating, shop_highlight_text, shop_status,
                  shop_image1, shop_image2, shop_image3, shop_image4,
                  shop_total_likes, shop_total_saves, shop_created_at`,
    },
};

const PRODUCT_DETAIL_COLUMNS = `
    product_id, category, material, size, printing, delivery, return_days,
    vdo1, vdo1_url, vdo2, vdo2_url, vdo3, vdo3_url
`;

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

exports.getDetails = async (req, res) => {
    try {
        const { type, id } = req.params;

        if (!type || !id) {
            return res.status(400).json({ success: false, message: "type and id are required." });
        }

        const config = PRODUCT_TABLES[String(type).toLowerCase()];
        if (!config) {
            return res.status(400).json({ success: false, message: "Invalid type" });
        }

        const [rows] = await db.query(
            `SELECT ${config.columns} FROM ${config.table} WHERE ${config.idColumn} = ? LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Data not found" });
        }

        const [detailRows] = await db.query(
            `SELECT ${PRODUCT_DETAIL_COLUMNS}
             FROM product_details_heepit
             WHERE product_id = ?
             LIMIT 1`,
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
        return serverError(res, err, "GET DETAILS ERROR");
    }
};