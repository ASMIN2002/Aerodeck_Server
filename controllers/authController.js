const pool = require("../config/db");
const crypto = require("crypto");
const { sendEmailOtp } = require("../services/emailService");

const pendingOtps = new Map();

function generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}

function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}


exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const otp = generateOtp();
        const otpExpiresAt = Date.now() + (5 * 60 * 1000);

        pendingOtps.set(cleanEmail, {
            email: cleanEmail,
            otp,
            otpExpiresAt
        });

        try {
            await sendEmailOtp(cleanEmail, otp);
        } catch (emailErr) {
            console.error("EMAIL SEND ERROR:", emailErr);
            pendingOtps.delete(cleanEmail);
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP. Please try again."
            });
        }

        return res.json({
            success: true,
            message: "OTP sent to your email."
        });

    } catch (err) {
        console.error("SEND OTP ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const pending = pendingOtps.get(cleanEmail);

        if (!pending) {
            return res.status(400).json({
                success: false,
                message: "OTP not found or expired."
            });
        }

        if (Date.now() > pending.otpExpiresAt) {
            pendingOtps.delete(cleanEmail);
            return res.status(400).json({
                success: false,
                message: "OTP expired. Please try again."
            });
        }

        if (pending.otp !== otp.trim()) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        let [users] = await pool.query(
            `SELECT user_id, full_name, email, mobile_number, whatsapp_number,
                    profile_image, profile_image_id,
                    is_email_verified, is_mobile_verified, is_whatsapp_verified,
                    created_at
             FROM User_Aerodeck
             WHERE email = ? LIMIT 1`,
            [cleanEmail]
        );

        let isNewUser = false;
        let userId;

        if (users.length === 0) {
            isNewUser = true;

            const [result] = await pool.query(
                `INSERT INTO User_Aerodeck
                 (email, is_email_verified)
                 VALUES (?, 1)`,
                [cleanEmail]
            );

            userId = result.insertId;

            const [lastReward] = await pool.query(
                `SELECT promo_code FROM USER_REWARDS
                 WHERE promo_code LIKE 'HE%HY'
                 ORDER BY id DESC LIMIT 1`
            );

            let nextNumber = 1;

            if (lastReward.length > 0 && lastReward[0].promo_code) {
                const match = lastReward[0].promo_code.match(/HE(\d{4})HY/);
                if (match) {
                    nextNumber = parseInt(match[1]) + 1;
                }
            }

            const promo_code = `HE${String(nextNumber).padStart(4, "0")}HY`;

            await pool.query(
                `INSERT INTO USER_REWARDS
                 (user_id, hypo_points, redeemed, promo_code, count)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, 10, 0, promo_code, 0]
            );

            const [versionRows] = await pool.query(
                `SELECT version FROM aerodeck_versions ORDER BY id DESC LIMIT 1`
            );

            const currentVersion = versionRows[0]?.version;

            if (currentVersion) {
                await pool.query(
                    `INSERT INTO DownloadApp (user_id, update_version) VALUES (?, ?)`,
                    [userId, currentVersion]
                );
            }

            const [newUsers] = await pool.query(
                `SELECT user_id, full_name, email, mobile_number, whatsapp_number,
                        profile_image, profile_image_id,
                        is_email_verified, is_mobile_verified, is_whatsapp_verified,
                        created_at
                 FROM User_Aerodeck
                 WHERE user_id = ? LIMIT 1`,
                [userId]
            );

            users = newUsers;

        } else {
            userId = users[0].user_id;
        }

        const user = users[0];

        const sessionToken = generateSessionToken();

        await pool.query(
            `UPDATE User_Session_Aerodeck SET is_active = 0 WHERE user_id = ?`,
            [user.user_id]
        );

        await pool.query(
            `INSERT INTO User_Session_Aerodeck
             (user_id, session_token, is_active, login_at, last_active_at)
             VALUES (?, ?, 1, NOW(), NOW())`,
            [user.user_id, sessionToken]
        );

        pendingOtps.delete(cleanEmail);

        return res.json({
            success: true,
            is_new_user: isNewUser,
            session_token: sessionToken,
            user: user
        });

    } catch (err) {
        console.error("VERIFY OTP ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.checkSession = async (req, res) => {
    try {
        const sessionToken = req.body?.session_token;

        if (!sessionToken) {
            return res.json({
                success: false,
                authenticated: false
            });
        }

        const [sessionRows] = await pool.query(
            `SELECT session_id, user_id
             FROM User_Session_Aerodeck
             WHERE session_token = ?
               AND is_active = 1
             LIMIT 1`,
            [sessionToken]
        );

        if (sessionRows.length === 0) {
            return res.json({
                success: false,
                authenticated: false
            });
        }

        await pool.query(
            `UPDATE User_Session_Aerodeck
             SET last_active_at = CURRENT_TIMESTAMP
             WHERE session_id = ?`,
            [sessionRows[0].session_id]
        );

        const [userRows] = await pool.query(
            `SELECT user_id, full_name, email, mobile_number, whatsapp_number,
                    profile_image, profile_image_id,
                    is_email_verified, is_mobile_verified, is_whatsapp_verified,
                    created_at
             FROM User_Aerodeck
             WHERE user_id = ? LIMIT 1`,
            [sessionRows[0].user_id]
        );

        if (userRows.length === 0) {
            return res.json({
                success: false,
                authenticated: false
            });
        }

        return res.json({
            success: true,
            authenticated: true,
            user: userRows[0]
        });

    } catch (err) {
        console.error("CHECK SESSION ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.logout = async (req, res) => {
    try {
        const { session_token } = req.body;

        if (!session_token) {
            return res.status(400).json({
                success: false,
                message: "Session token is required."
            });
        }

        await pool.query(
            `UPDATE User_Session_Aerodeck SET is_active = 0 WHERE session_token = ?`,
            [session_token]
        );

        return res.json({
            success: true,
            message: "Logout successful."
        });

    } catch (err) {
        console.error("LOGOUT ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};