const db = require("../config/db");

const getDetails = async (req, res) => {

    try {

        const { type, id } = req.params;

        let table = "";
        let idColumn = "";

        switch (type.toLowerCase()) {

            case "card":
                table = "Products_Aerodeck";
                idColumn = "product_id";
                break;

            case "gift":
                table = "Gifts_Aerodeck";
                idColumn = "gift_id";
                break;

            case "shop":
                table = "Shop_Aerodeck";
                idColumn = "shop_id";
                break;

            case "premium":
                table = "Premium_Aerodeck";
                idColumn = "premium_id";
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid type"
                });

        }


        const [rows] = await db.query(

            `SELECT * FROM ${table} 
             WHERE ${idColumn} = ? 
             LIMIT 1`,

            [id]

        );


        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Data not found"
            });

        }


        const [detailRows] = await db.query(

            `SELECT * FROM User_Product_Detail
             WHERE product_id = ?
             LIMIT 1`,

            [String(id)]

        );


        return res.json({

            success: true,

            data: {

                ...rows[0],

                productDetail:
                    detailRows.length
                        ? detailRows[0]
                        : null

            }

        });

    }

    catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,
            message: "Server Error"

        });

    }

};


module.exports = {
    getDetails
};