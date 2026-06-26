const pool = require("../config/db");

exports.createFounder = async (req, res) => {

    try {

        const {

            full_name,
            age,
            email,
            username,
            password,
            profile_image

        } = req.body;

        if (

            !full_name ||
            !age ||
            !email ||
            !username ||
            !password ||
            !profile_image

        ) {

            return res.status(400).json({

                success: false,

                message: "All Fields Required"

            });

        }

        const [user] = await pool.query(

            "SELECT id FROM founders WHERE username = ?",

            [username]

        );

        if (user.length > 0) {

            return res.json({

                success: false,

                message: "Username Already Exists"

            });

        }

        const [mail] = await pool.query(

            "SELECT id FROM founders WHERE email = ?",

            [email]

        );

        if (mail.length > 0) {

            return res.json({

                success: false,

                message: "Email Already Exists"

            });

        }

        const [result] = await pool.query(

            `INSERT INTO founders
      (
        full_name,
        age,
        email,
        username,
        password,
        profile_image,
        created_at
      )
      VALUES
      (
        ?,?,?,?,?,?,NOW()
      )`,

            [

                full_name,
                age,
                email,
                username,
                password,
                profile_image

            ]

        );

        res.json({

            success: true,

            founderId: result.insertId,

            message: "Founder Created Successfully"

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};