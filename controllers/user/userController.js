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
    profile_image
`;

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

exports.getProfile = async (req, res) => {
    try {
        const auth = await authenticate(req.body.session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, user });
    } catch (err) {
        return serverError(res, err, "Profile fetch failed.");
    }
};

exports.updateName = async (req, res) => {
    try {
        const { session_token, full_name } = req.body;

        const auth = await authenticate(session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!full_name || !full_name.trim())
            return res.status(400).json({ success: false, message: "Full name is required." });

        await db.query(
            `UPDATE users_heepit SET full_name = ? WHERE user_id = ?`,
            [full_name.trim(), auth.user_id]
        );

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "Name updated successfully.", user });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateWhatsapp = async (req, res) => {
    try {
        const { session_token, whatsapp_number } = req.body;

        const auth = await authenticate(session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!whatsapp_number || !/^\d{10}$/.test(whatsapp_number))
            return res.status(400).json({ success: false, message: "Valid 10 digit WhatsApp number is required." });

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total FROM users_heepit WHERE whatsapp_number = ?`,
            [whatsapp_number]
        );

        if (Number(countRows[0].total || 0) >= 4)
            return res.status(409).json({ success: false, message: "This WhatsApp number is already registered in 4 accounts." });

        await db.query(
            `UPDATE users_heepit SET whatsapp_number = ?, is_whatsapp_verified = 0 WHERE user_id = ?`,
            [whatsapp_number, auth.user_id]
        );

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "WhatsApp number saved.", user });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateMobile = async (req, res) => {
    try {
        const { session_token, mobile_number } = req.body;

        const auth = await authenticate(session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!mobile_number || !/^\d{10}$/.test(mobile_number))
            return res.status(400).json({ success: false, message: "Valid 10 digit mobile number is required." });

        const [countRows] = await db.query(
            `SELECT COUNT(*) AS total FROM users_heepit WHERE mobile_number = ?`,
            [mobile_number]
        );

        if (Number(countRows[0].total || 0) >= 4)
            return res.status(409).json({ success: false, message: "This mobile number is already registered in 4 accounts." });

        await db.query(
            `UPDATE users_heepit SET mobile_number = ?, is_mobile_verified = 0 WHERE user_id = ?`,
            [mobile_number, auth.user_id]
        );

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "Mobile number saved.", user });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getWhatsAppOrderData = async (req, res) => {
    try {
        const { session_token, product_id } = req.body;

        const auth = await authenticate(session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!product_id)
            return res.status(400).json({ success: false, message: "Product ID is required." });

        return res.json({ success: true, user_id: auth.user_id, product_id });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.sendEmailOtp = async (req, res) => {
    try {
        const { session_token, email } = req.body;

        const auth = await authenticate(session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!email || !email.trim())
            return res.status(400).json({ success: false, message: "Email is required." });

        const cleanEmail = email.trim().toLowerCase();

        const [existing] = await db.query(
            `SELECT user_id FROM users_heepit WHERE email = ? AND user_id != ? LIMIT 1`,
            [cleanEmail, auth.user_id]
        );

        if (existing.length > 0)
            return res.status(409).json({ success: false, message: "This email is already registered." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const [result] = await db.query(
            `UPDATE user_otp_heepit SET email_otp = ?, email_otp_expires_at = ? WHERE user_id = ?`,
            [otp, expiresAt, auth.user_id]
        );

        if (result.affectedRows === 0) {
            await db.query(
                `INSERT INTO user_otp_heepit (user_id, email_otp, email_otp_expires_at) VALUES (?, ?, ?)`,
                [auth.user_id, otp, expiresAt]
            );
        }

        const { sendEmailOtp } = require("../../services/emailService");
        await sendEmailOtp(cleanEmail, otp);

        return res.json({ success: true, message: "OTP sent successfully." });
    } catch (err) {
        return serverError(res, err, "Failed to send OTP.");
    }
};

exports.verifyEmailOtp = async (req, res) => {
    try {
        const { session_token, email, otp } = req.body;

        const auth = await authenticate(session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!email || !otp)
            return res.status(400).json({ success: false, message: "Email and OTP are required." });

        const cleanEmail = email.trim().toLowerCase();

        const [rows] = await db.query(
            `SELECT email_otp, email_otp_expires_at FROM user_otp_heepit WHERE user_id = ? LIMIT 1`,
            [auth.user_id]
        );

        if (!rows.length)
            return res.status(400).json({ success: false, message: "OTP not found." });

        const otpData = rows[0];

        if (!otpData.email_otp || otpData.email_otp !== String(otp))
            return res.status(400).json({ success: false, message: "Invalid OTP." });

        if (!otpData.email_otp_expires_at || new Date() > new Date(otpData.email_otp_expires_at))
            return res.status(400).json({ success: false, message: "OTP expired." });

        await db.query(
            `UPDATE users_heepit SET email = ?, is_email_verified = 1 WHERE user_id = ?`,
            [cleanEmail, auth.user_id]
        );

        const user = await getSafeUser(auth.user_id);
        return res.json({ success: true, message: "Email verified successfully.", user });
    } catch (err) {
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
        const [rows] = await db.query(
            `SELECT id, notification, status, created_at FROM heepit_notification ORDER BY created_at DESC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "Notifications fetch failed.");
    }
};

exports.insertNotification = async (req, res) => {
    try {
        const { notification } = req.body;

        if (!notification || !notification.trim())
            return res.status(400).json({ success: false, message: "Notification text is required." });

        const cleanText = notification.trim();

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

        await db.query(
            `UPDATE heepit_notification SET status = ? WHERE id = ?`,
            [status ? 1 : 0, id]
        );

        return res.json({ success: true, message: "Status updated." });
    } catch (err) {
        return serverError(res, err, "Status update failed.");
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const auth = await authenticate(req.query.session_token);
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
            `SELECT id, notification, status, created_at FROM heepit_notification WHERE status = 0 ORDER BY created_at DESC`
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

        const [[row]] = await db.query(
            `SELECT id, item_id, processing_update FROM processing_updates WHERE item_id = ? LIMIT 1`,
            [item_id]
        );

        return res.json({ success: true, data: row || null });
    } catch (err) {
        return serverError(res, err, "Processing update fetch failed.");
    }
};

exports.saveFcmToken = async (req, res) => {
    try {
        const { session_token, fcm_token } = req.body;

        const auth = await authenticate(session_token);
        if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

        if (!fcm_token || !fcm_token.trim())
            return res.status(400).json({ success: false, message: "FCM token required." });

        const cleanToken = fcm_token.trim();

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