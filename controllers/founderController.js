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

    } catch (err) {
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

    } catch (err) {
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

        const [adminResult] = await pool.query(
            `INSERT INTO heepitadmin
             (username, password)
             VALUES (?, ?)`,
            [username, password]
        );

        const newAdminId = adminResult.insertId;

        const monthShort = new Date()
            .toLocaleString("en-US", { month: "short" })
            .toUpperCase();

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

        return res.json({
            success: true,
            admin_id: newAdminId,
            message: "Admin created successfully."
        });

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                user_id,
                full_name,
                mobile_number,
                whatsapp_number,
                is_mobile_verified,
                is_whatsapp_verified,
                email,
                is_email_verified,
                created_at,
                profile_image,
                profile_image_id
            FROM User_Aerodeck
            ORDER BY user_id DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

exports.verifyUserField = async (req, res) => {
    try {
        const { user_id, field, action } = req.body;

        if (!user_id || !field || !action) {
            return res.status(400).json({
                success: false,
                message: "user_id, field and action are required."
            });
        }

        if (!["whatsapp", "mobile"].includes(field)) {
            return res.status(400).json({
                success: false,
                message: "Invalid field."
            });
        }

        if (!["verify", "ignore"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid action."
            });
        }

        const [rows] = await pool.query(
            `SELECT user_id, whatsapp_number, mobile_number,
                    is_whatsapp_verified, is_mobile_verified
             FROM User_Aerodeck
             WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const user = rows[0];

        if (field === "whatsapp") {

            if (!user.whatsapp_number) {
                return res.status(400).json({
                    success: false,
                    message: "No WhatsApp number to verify."
                });
            }

            if (action === "verify") {
                await pool.query(
                    `UPDATE User_Aerodeck
                     SET is_whatsapp_verified = 1
                     WHERE user_id = ?`,
                    [user_id]
                );
            } else {
                await pool.query(
                    `UPDATE User_Aerodeck
                     SET whatsapp_number = NULL,
                         is_whatsapp_verified = 0
                     WHERE user_id = ?`,
                    [user_id]
                );
            }

        } else {

            if (!user.mobile_number) {
                return res.status(400).json({
                    success: false,
                    message: "No mobile number to verify."
                });
            }

            if (action === "verify") {
                await pool.query(
                    `UPDATE User_Aerodeck
                     SET is_mobile_verified = 1
                     WHERE user_id = ?`,
                    [user_id]
                );
            } else {
                await pool.query(
                    `UPDATE User_Aerodeck
                     SET mobile_number = NULL,
                         is_mobile_verified = 0
                     WHERE user_id = ?`,
                    [user_id]
                );
            }

        }

        const [updated] = await pool.query(
            `SELECT * FROM User_Aerodeck WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        return res.json({
            success: true,
            message: `${field} ${action}ed successfully.`,
            user: updated[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};