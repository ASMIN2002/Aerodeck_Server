const pool = require("../../config/db");

// ==============================
// GET SHOPS
// ==============================

exports.getShops = async (req, res) => {

    try {

        const [rows] = await pool.query(

            `SELECT *
             FROM Shop_Aerodeck
             ORDER BY shop_id DESC`

        );

        res.json({

            success: true,

            data: rows

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};