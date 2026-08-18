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
            `
            SELECT *
            FROM User_Aerodeck
            WHERE user_id = ?
            LIMIT 1
            `,
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

// ===============================
// UPDATE USER NAME
// ===============================
exports.updateName = async (req, res) => {

    try {

        const {
            session_token,
            full_name
        } = req.body;

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

        await db.query(
            `
    UPDATE User_Aerodeck
    SET full_name = ?
    WHERE user_id = ?
    `,
            [
                full_name.trim(),
                user_id
            ]
        );

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }




        // Return updated user
        const [rows] = await db.query(
            `
            SELECT *
            FROM User_Aerodeck
            WHERE user_id = ?
            `,
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
// ===============================
// GET WHATSAPP ORDER DATA
// ===============================
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

// ===============================
// SEND EMAIL OTP
// ===============================
exports.sendEmailOtp = async (req, res) => {

    try {

        const {
            session_token,
            email
        } = req.body;

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

        // Check whether this email already belongs to another user
        const [existingUsers] = await db.query(
            `
            SELECT user_id
            FROM User_Aerodeck
            WHERE email = ?
            AND user_id != ?
            LIMIT 1
            `,
            [cleanEmail, user_id]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "This email is already registered."
            });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // OTP expires after 5 minutes
        const expiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );

        // Save OTP
        await db.query(
            `
            UPDATE User_OTP_Aerodeck
            SET email_otp = ?,
                email_otp_expires_at = ?
            WHERE user_id = ?
            `,
            [
                otp,
                expiresAt,
                user_id
            ]
        );

        // Send email
        const { sendEmailOtp } = require("../../services/emailService");

        await sendEmailOtp(
            cleanEmail,
            otp
        );

        return res.json({
            success: true,
            message: "OTP sent successfully."
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP."
        });

    }

};


// ===============================
// VERIFY EMAIL OTP
// ===============================
exports.verifyEmailOtp = async (req, res) => {

    try {

        const {
            session_token,
            email,
            otp
        } = req.body;

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
            `
            SELECT email_otp,
                   email_otp_expires_at
            FROM User_OTP_Aerodeck
            WHERE user_id = ?
            LIMIT 1
            `,
            [user_id]
        );

        if (!rows.length) {
            return res.status(400).json({
                success: false,
                message: "OTP not found."
            });
        }

        const otpData = rows[0];

        // Check OTP
        if (
            !otpData.email_otp ||
            otpData.email_otp !== String(otp)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        // Check expiry
        if (
            !otpData.email_otp_expires_at ||
            new Date() > new Date(otpData.email_otp_expires_at)
        ) {
            return res.status(400).json({
                success: false,
                message: "OTP expired."
            });
        }

        // Update user email and verification
        await db.query(
            `
            UPDATE User_Aerodeck
            SET email = ?,
                is_email_verified = 1
            WHERE user_id = ?
            `,
            [
                cleanEmail,
                user_id
            ]
        );

        // Clear OTP
        await db.query(
            `
            UPDATE User_OTP_Aerodeck
            SET email_otp = NULL,
                email_otp_expires_at = NULL
            WHERE user_id = ?
            `,
            [user_id]
        );

        // Return updated profile
        const [updatedRows] = await db.query(
            `
            SELECT *
            FROM User_Aerodeck
            WHERE user_id = ?
            LIMIT 1
            `,
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