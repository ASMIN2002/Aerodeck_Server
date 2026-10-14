const pool = require("../../config/db");

exports.getPremium = async (req, res) => {

    try {

        const [rows] = await pool.query(

            `SELECT *
             FROM medical_heepit
             ORDER BY premium_id DESC`

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