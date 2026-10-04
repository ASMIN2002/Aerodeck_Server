const pool = require("../config/db");

exports.createFounder = async (req, res) => {
    try {

        const {

            full_name,
            age,
            email,
            username,
            password,
            profile_image,
            created_by

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

        if (!created_by) {

            return res.status(400).json({

                success: false,

                message: "Creator ID Missing"

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

        await pool.query(

            `INSERT INTO founder_creation_logs
    (
        founder_id,
        created_by,
        founder_email_verified,
        owner_email_verified,
        created_at
    )
    VALUES
    (
        ?,?,?,?,NOW()
    )`,

            [

                result.insertId,

                created_by,

                1,

                1

            ]

        );

        res.json({

            success: true,

            founderId: result.insertId,

            message: "Founder Created Successfully"

        });

    }

    catch (err) {
        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};
exports.updateProfileImage = async (req, res) => {

    try {

        const { founderId, profile_image } = req.body;
        await pool.query(

            `UPDATE founders
   SET profile_image = ?
   WHERE id = ?`,

            [profile_image, founderId]

        );

        res.json({

            success: true

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

exports.createAdmin = async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({

                success: false,

                message: "Username and password required."

            });

        }

        /* ============================================
           CHECK USERNAME EXISTS
           ============================================ */

        const [existing] = await pool.query(

            `SELECT id FROM heepitadmin WHERE username = ? LIMIT 1`,

            [username]

        );

        if (existing.length > 0) {

            return res.json({

                success: false,

                message: "Username already exists, regenerate."

            });

        }

        /* ============================================
           INSERT INTO heepitadmin
           (only username, password — rest NULL)
           ============================================ */

        const [adminResult] = await pool.query(

            `INSERT INTO heepitadmin
             (username, password)
             VALUES (?, ?)`,

            [username, password]

        );

        const newAdminId = adminResult.insertId;

        /* ============================================
           GET SHORT MONTH NAME (uppercase)
           ============================================ */

        const monthShort = new Date()

            .toLocaleString("en-US", { month: "short" })

            .toUpperCase();

        /* ============================================
           INSERT INTO heepitadmin_stats
           (admin_id, rest defaults, analysh = month)
           ============================================ */

        await pool.query(

            `INSERT INTO heepitadmin_stats
             (
                admin_id,
                likes,
                ratings,
                sells,
                pending,
                delivered,
                commission,
                analysh
             )
             VALUES (?, 0, 0, 0, 0, 0, 0, ?)`,

            [newAdminId, monthShort]

        );

        /* ============================================
           SUCCESS
           ============================================ */

        return res.json({

            success: true,

            admin_id: newAdminId,

            message: "Admin created successfully."

        });

    }

    catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};