const db = require("../../config/db");

const getDetails = async (req, res) => {

    try {

        const { type, id } = req.params;

        let table = "";
        let idColumn = "";

        switch (type.toLowerCase()) {

            case "gift":
                table = "food_heepit";
                idColumn = "gift_id";
                break;

            case "premium":
                table = "medical_heepit";
                idColumn = "premium_id";
                break;

            case "card":
                table = "cards_heepit";
                idColumn = "product_id";
                break;

            case "shop":
                table = "shop_heepit";
                idColumn = "shop_id";
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid type"
                });

        }

        const [rows] = await db.query(

            `SELECT * FROM ${table} WHERE ${idColumn} = ? LIMIT 1`,
            [id]

        );
        let productDetail = null;

        if (
            type.toLowerCase() === "card" ||
            type.toLowerCase() === "gift" ||
            type.toLowerCase() === "shop"
        ) {

            const [detailRows] = await db.query(
                `SELECT * FROM product_details_heepit
         WHERE product_id = ?
         LIMIT 1`,
                [id]
            );

            productDetail = detailRows.length
                ? detailRows[0]
                : null;
        }
        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Data not found"
            });

        }

        res.json({
            success: true,
            data: {
                ...rows[0],
                productDetail
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

module.exports = {
    getDetails
};