const db = require("../../config/db");

const getDetails = async (req, res) => {

    try {

        const { type, id } = req.params;

        let table = "";
        let idColumn = "";

        switch (type.toLowerCase()) {

            case "gift":
                table = "Gifts_Aerodeck";
                idColumn = "gift_id";
                break;

            case "premium":
                table = "Premium_Aerodeck";
                idColumn = "premium_id";
                break;

            case "card":
                table = "Products_Aerodeck";
                idColumn = "product_id";
                break;

            case "shop":
                table = "Shop_Aerodeck";
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

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Data not found"
            });

        }

        res.json({
            success: true,
            data: rows[0]
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