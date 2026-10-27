const crypto = require("crypto");
const db = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const SAFE_USER_FIELDS = `
    user_id,
    full_name,
    mobile_number,
    whatsapp_number,
    is_whatsapp_verified,
    is_mobile_verified,
    email,
    is_email_verified,
    profile_image,
    created_at
`;

const MAX_ACCOUNTS_PER_NUMBER = 4;

async function authenticate(session_token) {
    if (!session_token) return { error: "Session token is required.", status: 401 };
    const user_id = await getUserIdFromSession(session_token);
    if (!user_id) return { error: "Invalid or expired session.", status: 401 };
    return { user_id };
}

async function getSafeUser(user_id) {
    const [rows] = await db.query(
        `SELECT ${SAFE_USER_FIELDS} FROM users_heepit WHERE user_id = ? LIMIT 1`,
        [user_id]
    );
    return rows[0] || null;
}

function serverError(res, err, context = "Server error.") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function getSessionToken(req) {
    return req.body?.session_token || req.query?.session_token || null;
}

exports.getProfile = async (req, res) => {
    try {
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, user });
    } catch (err) {
        return serverError(res, err, "Profile fetch failed.");
    }
};

exports.updateName = async (req, res) => {
    try {
        const { full_name } = req.body;
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!full_name || !String(full_name).trim())
            return res.status(400).json({ success: false, message: "Full name is required." });

        await db.query(
            `UPDATE users_heepit SET full_name = ? WHERE user_id = ?`,
            [String(full_name).trim(), auth.user_id]
        );

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "Name updated successfully.", user });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateWhatsapp = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { whatsapp_number } = req.body;
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) {
            conn.release();
            return res.status(auth.status).json({ success: false, message: auth.error });
        }

        if (!whatsapp_number || !/^\d{10}$/.test(String(whatsapp_number))) {
            conn.release();
            return res.status(400).json({ success: false, message: "Valid 10 digit WhatsApp number is required." });
        }

        await conn.beginTransaction();
        try {
            const [countRows] = await conn.query(
                `SELECT COUNT(*) AS total FROM users_heepit WHERE whatsapp_number = ? FOR UPDATE`,
                [whatsapp_number]
            );

            if (Number(countRows[0].total || 0) >= MAX_ACCOUNTS_PER_NUMBER) {
                await conn.rollback();
                conn.release();
                return res.status(409).json({
                    success: false,
                    message: `This WhatsApp number is already registered in ${MAX_ACCOUNTS_PER_NUMBER} accounts.`,
                });
            }

            await conn.query(
                `UPDATE users_heepit SET whatsapp_number = ?, is_whatsapp_verified = 0 WHERE user_id = ?`,
                [whatsapp_number, auth.user_id]
            );

            await conn.commit();
            conn.release();
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "WhatsApp number saved.", user });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};

exports.updateMobile = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { mobile_number } = req.body;
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) {
            conn.release();
            return res.status(auth.status).json({ success: false, message: auth.error });
        }

        if (!mobile_number || !/^\d{10}$/.test(String(mobile_number))) {
            conn.release();
            return res.status(400).json({ success: false, message: "Valid 10 digit mobile number is required." });
        }

        await conn.beginTransaction();
        try {
            const [countRows] = await conn.query(
                `SELECT COUNT(*) AS total FROM users_heepit WHERE mobile_number = ? FOR UPDATE`,
                [mobile_number]
            );

            if (Number(countRows[0].total || 0) >= MAX_ACCOUNTS_PER_NUMBER) {
                await conn.rollback();
                conn.release();
                return res.status(409).json({
                    success: false,
                    message: `This mobile number is already registered in ${MAX_ACCOUNTS_PER_NUMBER} accounts.`,
                });
            }

            await conn.query(
                `UPDATE users_heepit SET mobile_number = ?, is_mobile_verified = 0 WHERE user_id = ?`,
                [mobile_number, auth.user_id]
            );

            await conn.commit();
            conn.release();
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "Mobile number saved.", user });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};

exports.getWhatsAppOrderData = async (req, res) => {
    try {
        const { product_id } = req.body;
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!product_id)
            return res.status(400).json({ success: false, message: "Product ID is required." });

        return res.json({ success: true, user_id: auth.user_id, product_id });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.sendEmailOtp = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { email } = req.body;
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) {
            conn.release();
            return res.status(auth.status).json({ success: false, message: auth.error });
        }

        if (!email || !String(email).trim()) {
            conn.release();
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            conn.release();
            return res.status(400).json({ success: false, message: "Invalid email format." });
        }

        const [existing] = await conn.query(
            `SELECT user_id FROM users_heepit WHERE email = ? AND user_id != ? LIMIT 1`,
            [cleanEmail, auth.user_id]
        );

        if (existing.length > 0) {
            conn.release();
            return res.status(409).json({ success: false, message: "This email is already registered." });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await conn.query(
            `INSERT INTO user_otp_heepit (user_id, email, email_otp, email_otp_expires_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                email_otp = VALUES(email_otp),
                email_otp_expires_at = VALUES(email_otp_expires_at)`,
            [auth.user_id, cleanEmail, otp, expiresAt]
        );

        conn.release();

        const { sendEmailOtp } = require("../../services/emailService");
        await sendEmailOtp(cleanEmail, otp);

        return res.json({ success: true, message: "OTP sent successfully." });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err, "Failed to send OTP.");
    }
};

exports.verifyEmailOtp = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { email, otp } = req.body;
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) {
            conn.release();
            return res.status(auth.status).json({ success: false, message: auth.error });
        }

        if (!email || !otp) {
            conn.release();
            return res.status(400).json({ success: false, message: "Email and OTP are required." });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const [rows] = await conn.query(
            `SELECT email, email_otp, email_otp_expires_at
             FROM user_otp_heepit WHERE user_id = ? LIMIT 1`,
            [auth.user_id]
        );

        if (!rows.length) {
            conn.release();
            return res.status(400).json({ success: false, message: "OTP not found." });
        }

        const otpData = rows[0];

        if (!otpData.email_otp || otpData.email_otp !== String(otp)) {
            conn.release();
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        if (String(otpData.email).toLowerCase() !== cleanEmail) {
            conn.release();
            return res.status(400).json({ success: false, message: "Email does not match the OTP request." });
        }

        if (!otpData.email_otp_expires_at || new Date() > new Date(otpData.email_otp_expires_at)) {
            conn.release();
            return res.status(400).json({ success: false, message: "OTP expired." });
        }

        await conn.beginTransaction();
        try {
            await conn.query(
                `UPDATE users_heepit SET email = ?, is_email_verified = 1 WHERE user_id = ?`,
                [cleanEmail, auth.user_id]
            );

            await conn.query(
                `UPDATE user_otp_heepit
                 SET email_otp = NULL, email_otp_expires_at = NULL
                 WHERE user_id = ?`,
                [auth.user_id]
            );

            await conn.commit();
            conn.release();
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "Email verified successfully.", user });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err, "Verification failed.");
    }
};

exports.getNotificationCount = async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT COUNT(*) AS total FROM heepit_notification`);
        return res.json({ success: true, count: rows[0].total });
    } catch (err) {
        return serverError(res, err, "Notification count failed.");
    }
};

exports.getAllNotifications = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const [rows] = await db.query(
            `SELECT id, notification, status, created_at
             FROM heepit_notification
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        return res.json({ success: true, data: rows, pagination: { limit, offset } });
    } catch (err) {
        return serverError(res, err, "Notifications fetch failed.");
    }
};

exports.insertNotification = async (req, res) => {
    try {
        const { notification } = req.body;

        if (!notification || !String(notification).trim())
            return res.status(400).json({ success: false, message: "Notification text is required." });

        const cleanText = String(notification).trim();

        if (cleanText.length > 200)
            return res.status(400).json({ success: false, message: "Maximum 200 characters allowed." });

        const [result] = await db.query(
            `INSERT INTO heepit_notification (notification) VALUES (?)`,
            [cleanText]
        );

        return res.json({ success: true, message: "Notification inserted successfully.", id: result.insertId });
    } catch (err) {
        return serverError(res, err, "Notification insert failed.");
    }
};

exports.toggleNotificationStatus = async (req, res) => {
    try {
        const { id, status } = req.body;

        if (!id)
            return res.status(400).json({ success: false, message: "Notification ID is required." });

        const [result] = await db.query(
            `UPDATE heepit_notification SET status = ? WHERE id = ?`,
            [status ? 1 : 0, id]
        );

        if (result.affectedRows === 0)
            return res.status(404).json({ success: false, message: "Notification not found." });

        return res.json({ success: true, message: "Status updated." });
    } catch (err) {
        return serverError(res, err, "Status update failed.");
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        const user = await getSafeUser(auth.user_id);

        if (!user)
            return res.status(404).json({ success: false, message: "User not found." });

        return res.json({ success: true, data: user });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getAdminNotifications = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, notification, status, created_at
             FROM heepit_notification
             WHERE status = 0
             ORDER BY created_at DESC
             LIMIT 100`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "Admin notifications fetch failed.");
    }
};

exports.getProcessingUpdate = async (req, res) => {
    try {
        const { item_id } = req.params;

        if (!item_id)
            return res.status(400).json({ success: false, message: "item_id required." });

        const [rows] = await db.query(
            `SELECT id, item_id, processing_update
             FROM processing_updates WHERE item_id = ? LIMIT 1`,
            [item_id]
        );

        return res.json({ success: true, data: rows[0] || null });
    } catch (err) {
        return serverError(res, err, "Processing update fetch failed.");
    }
};

exports.saveFcmToken = async (req, res) => {
    try {
        const { fcm_token } = req.body;
        const auth = await authenticate(getSessionToken(req));
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!fcm_token || !String(fcm_token).trim())
            return res.status(400).json({ success: false, message: "FCM token required." });

        const cleanToken = String(fcm_token).trim();

        await db.query(
            `UPDATE users_heepit SET fcm_token = NULL WHERE fcm_token = ? AND user_id != ?`,
            [cleanToken, auth.user_id]
        );

        await db.query(
            `UPDATE users_heepit SET fcm_token = ? WHERE user_id = ?`,
            [cleanToken, auth.user_id]
        );

        return res.json({ success: true, message: "FCM token saved." });
    } catch (err) {
        return serverError(res, err, "Failed to save FCM token.");
    }
};