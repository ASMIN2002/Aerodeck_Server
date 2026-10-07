const db = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

exports.getProfile = async (req, res) => {
    try {
        const { session_token } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const [rows] = await db.query(
            `SELECT * FROM User_Aerodeck WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        return res.json({
            success: true,
            user: rows[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.updateName = async (req, res) => {
    try {
        const { session_token, full_name } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!full_name || full_name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Full name is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        await db.query(
            `UPDATE User_Aerodeck SET full_name = ? WHERE user_id = ?`,
            [full_name.trim(), user_id]
        );

        const [rows] = await db.query(
            `SELECT * FROM User_Aerodeck WHERE user_id = ?`,
            [user_id]
        );

        return res.json({
            success: true,
            message: "Name updated successfully.",
            user: rows[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

exports.updateWhatsapp = async (req, res) => {
    try {
        const { session_token, whatsapp_number } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!whatsapp_number || !/^\d{10}$/.test(whatsapp_number)) {
            return res.status(400).json({
                success: false,
                message: "Valid 10 digit WhatsApp number is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM User_Aerodeck
             WHERE whatsapp_number = ?`,
            [whatsapp_number]
        );

        const existingCount = Number(countRows[0].total || 0);

        if (existingCount >= 4) {
            return res.status(409).json({
                success: false,
                message: "This WhatsApp number is already registered in 4 accounts."
            });
        }

        await db.query(
            `UPDATE User_Aerodeck
             SET whatsapp_number = ?,
                 is_whatsapp_verified = 0
             WHERE user_id = ?`,
            [whatsapp_number, user_id]
        );

        const [rows] = await db.query(
            `SELECT * FROM User_Aerodeck WHERE user_id = ?`,
            [user_id]
        );

        return res.json({
            success: true,
            message: "WhatsApp number saved.",
            user: rows[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


exports.updateMobile = async (req, res) => {
    try {
        const { session_token, mobile_number } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!mobile_number || !/^\d{10}$/.test(mobile_number)) {
            return res.status(400).json({
                success: false,
                message: "Valid 10 digit mobile number is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM User_Aerodeck
             WHERE mobile_number = ?`,
            [mobile_number]
        );

        const existingCount = Number(countRows[0].total || 0);

        if (existingCount >= 4) {
            return res.status(409).json({
                success: false,
                message: "This mobile number is already registered in 4 accounts."
            });
        }

        await db.query(
            `UPDATE User_Aerodeck
             SET mobile_number = ?,
                 is_mobile_verified = 0
             WHERE user_id = ?`,
            [mobile_number, user_id]
        );

        const [rows] = await db.query(
            `SELECT * FROM User_Aerodeck WHERE user_id = ?`,
            [user_id]
        );

        return res.json({
            success: true,
            message: "Mobile number saved.",
            user: rows[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


exports.getWhatsAppOrderData = async (req, res) => {
    try {
        const { session_token, product_id } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        return res.json({
            success: true,
            user_id: user_id,
            product_id: product_id
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};


exports.sendEmailOtp = async (req, res) => {
    try {
        const { session_token, email } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!email || email.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const [existingUsers] = await db.query(
            `SELECT user_id FROM User_Aerodeck
             WHERE email = ? AND user_id != ? LIMIT 1`,
            [cleanEmail, user_id]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const [otpResult] = await db.query(
            `UPDATE User_OTP_Aerodeck
             SET email_otp = ?, email_otp_expires_at = ?
             WHERE user_id = ?`,
            [otp, expiresAt, user_id]
        );

        if (otpResult.affectedRows === 0) {
            await db.query(
                `INSERT INTO User_OTP_Aerodeck
                 (user_id, email_otp, email_otp_expires_at)
                 VALUES (?, ?, ?)`,
                [user_id, otp, expiresAt]
            );
        }

        const { sendEmailOtp } = require("../../services/emailService");

        await sendEmailOtp(cleanEmail, otp);

        return res.json({
            success: true,
            message: "OTP sent successfully."
        });

    } catch (err) {
        console.error("SEND EMAIL OTP ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
            error: err.code || "UNKNOWN_ERROR"
        });
    }
};


exports.verifyEmailOtp = async (req, res) => {
    try {
        const { session_token, email, otp } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const [rows] = await db.query(
            `SELECT email_otp, email_otp_expires_at
             FROM User_OTP_Aerodeck
             WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (!rows.length) {
            return res.status(400).json({
                success: false,
                message: "OTP not found."
            });
        }

        const otpData = rows[0];

        if (!otpData.email_otp || otpData.email_otp !== String(otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        if (
            !otpData.email_otp_expires_at ||
            new Date() > new Date(otpData.email_otp_expires_at)
        ) {
            return res.status(400).json({
                success: false,
                message: "OTP expired."
            });
        }

        await db.query(
            `UPDATE User_Aerodeck
             SET email = ?, is_email_verified = 1
             WHERE user_id = ?`,
            [cleanEmail, user_id]
        );

        const [updatedRows] = await db.query(
            `SELECT * FROM User_Aerodeck WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        return res.json({
            success: true,
            message: "Email verified successfully.",
            user: updatedRows[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Verification failed."
        });
    }
};


exports.getNotificationCount = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT COUNT(*) AS total FROM heepit_notification`
        );

        return res.json({
            success: true,
            count: rows[0].total
        });

    } catch (err) {
        console.error("NOTIF COUNT ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.getAllNotifications = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, notification, status, created_at
             FROM heepit_notification
             ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.error("NOTIF FETCH ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.insertNotification = async (req, res) => {
    try {
        const { notification } = req.body;

        if (!notification || notification.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Notification text is required."
            });
        }

        const cleanText = notification.trim();

        if (cleanText.length > 200) {
            return res.status(400).json({
                success: false,
                message: "Maximum 200 characters allowed."
            });
        }

        const [result] = await db.query(
            `INSERT INTO heepit_notification (notification) VALUES (?)`,
            [cleanText]
        );

        return res.json({
            success: true,
            message: "Notification inserted successfully.",
            id: result.insertId
        });

    } catch (err) {
        console.error("NOTIF INSERT ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.toggleNotificationStatus = async (req, res) => {
    try {
        const { id, status } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Notification ID is required."
            });
        }

        await db.query(
            `UPDATE heepit_notification SET status = ? WHERE id = ?`,
            [status ? 1 : 0, id]
        );

        return res.json({
            success: true,
            message: "Status updated."
        });

    } catch (err) {
        console.error("NOTIF STATUS ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.getUserDetails = async (req, res) => {
    try {
        const { session_token } = req.query;

        if (!session_token) {
            return res.status(400).json({
                success: false,
                message: "Session token required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const [rows] = await db.query(
            `SELECT 
                user_id,
                full_name,
                mobile_number,
                whatsapp_number,
                is_whatsapp_verified,
                is_mobile_verified,
                email,
                is_email_verified,
                profile_image
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

        return res.json({
            success: true,
            data: rows[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};