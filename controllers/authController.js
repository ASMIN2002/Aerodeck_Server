const pool = require("../config/db");
const crypto = require("crypto");
const { sendEmailOtp } = require("../services/emailService");

const pendingOtps = new Map();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const NEW_USER_HYPO_POINTS = 10;

const USER_FIELDS = `
    user_id, full_name, email, mobile_number, whatsapp_number,
    profile_image, profile_image_id,
    is_email_verified, is_mobile_verified, is_whatsapp_verified,
    created_at
`;

function generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}

function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

async function getUserById(user_id) {
    const [rows] = await pool.query(
        `SELECT ${USER_FIELDS} FROM users_heepit WHERE user_id = ? LIMIT 1`,
        [user_id]
    );
    return rows[0] || null;
}

async function generatePromoCode() {
    const [lastReward] = await pool.query(
        `SELECT promo_code FROM user_rewards_heepit
         WHERE promo_code LIKE 'HE%HY'
         ORDER BY id DESC LIMIT 1`
    );

    let nextNumber = 1;

    if (lastReward.length > 0 && lastReward[0].promo_code) {
        const match = lastReward[0].promo_code.match(/HE(\d{4})HY/);
        if (match) nextNumber = parseInt(match[1]) + 1;
    }

    return `HE${String(nextNumber).padStart(4, "0")}HY`;
}

async function createNewUser(cleanEmail) {
    const [result] = await pool.query(
        `INSERT INTO users_heepit (email, is_email_verified) VALUES (?, 1)`,
        [cleanEmail]
    );

    const userId = result.insertId;

    const promo_code = await generatePromoCode();

    await pool.query(
        `INSERT INTO user_rewards_heepit
         (user_id, hypo_points, redeemed, promo_code, count)
         VALUES (?, ?, 0, ?, 0)`,
        [userId, NEW_USER_HYPO_POINTS, promo_code]
    );

    const [versionRows] = await pool.query(
        `SELECT version FROM heepit_versions ORDER BY id DESC LIMIT 1`
    );

    const currentVersion = versionRows[0]?.version;

    if (currentVersion) {
        await pool.query(
            `INSERT INTO download_app_users (user_id, update_version) VALUES (?, ?)`,
            [userId, currentVersion]
        );
    }

    return userId;
}

exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email)
            return res.status(400).json({ success: false, message: "Email is required." });

        const cleanEmail = email.trim().toLowerCase();

        if (!EMAIL_REGEX.test(cleanEmail))
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });

        const otp = generateOtp();
        const otpExpiresAt = Date.now() + OTP_EXPIRY_MS;

        pendingOtps.set(cleanEmail, { email: cleanEmail, otp, otpExpiresAt });

        try {
            await sendEmailOtp(cleanEmail, otp);
        } catch (emailErr) {
            console.error("EMAIL SEND ERROR:", emailErr.message);
            pendingOtps.delete(cleanEmail);
            return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
        }

        return res.json({ success: true, message: "OTP sent to your email." });
    } catch (err) {
        return serverError(res, err, "SEND OTP ERROR:");
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp)
            return res.status(400).json({ success: false, message: "Email and OTP are required." });

        const cleanEmail = email.trim().toLowerCase();
        const pending = pendingOtps.get(cleanEmail);

        if (!pending)
            return res.status(400).json({ success: false, message: "OTP not found or expired." });

        if (Date.now() > pending.otpExpiresAt) {
            pendingOtps.delete(cleanEmail);
            return res.status(400).json({ success: false, message: "OTP expired. Please try again." });
        }

        if (pending.otp !== otp.trim())
            return res.status(400).json({ success: false, message: "Invalid OTP." });

        const [users] = await pool.query(
            `SELECT ${USER_FIELDS} FROM users_heepit WHERE email = ? LIMIT 1`,
            [cleanEmail]
        );

        let isNewUser = false;
        let user;

        if (users.length === 0) {
            isNewUser = true;
            const userId = await createNewUser(cleanEmail);
            user = await getUserById(userId);
        } else {
            user = users[0];
        }

        const sessionToken = generateSessionToken();

        await pool.query(
            `UPDATE user_session_heepit SET is_active = 0 WHERE user_id = ?`,
            [user.user_id]
        );

        await pool.query(
            `INSERT INTO user_session_heepit
             (user_id, session_token, is_active, login_at, last_active_at)
             VALUES (?, ?, 1, NOW(), NOW())`,
            [user.user_id, sessionToken]
        );

        pendingOtps.delete(cleanEmail);

        return res.json({
            success: true,
            is_new_user: isNewUser,
            session_token: sessionToken,
            user,
        });
    } catch (err) {
        return serverError(res, err, "VERIFY OTP ERROR:");
    }
};

exports.checkSession = async (req, res) => {
    try {
        const sessionToken = req.body?.session_token;

        if (!sessionToken)
            return res.json({ success: false, authenticated: false });

        const [sessionRows] = await pool.query(
            `SELECT session_id, user_id FROM user_session_heepit
             WHERE session_token = ? AND is_active = 1 LIMIT 1`,
            [sessionToken]
        );

        if (sessionRows.length === 0)
            return res.json({ success: false, authenticated: false });

        await pool.query(
            `UPDATE user_session_heepit
             SET last_active_at = CURRENT_TIMESTAMP
             WHERE session_id = ?`,
            [sessionRows[0].session_id]
        );

        const user = await getUserById(sessionRows[0].user_id);

        if (!user)
            return res.json({ success: false, authenticated: false });

        return res.json({ success: true, authenticated: true, user });
    } catch (err) {
        return serverError(res, err, "CHECK SESSION ERROR:");
    }
};

exports.logout = async (req, res) => {
    try {
        const { session_token } = req.body;

        if (!session_token)
            return res.status(400).json({ success: false, message: "Session token is required." });

        await pool.query(
            `UPDATE user_session_heepit SET is_active = 0 WHERE session_token = ?`,
            [session_token]
        );

        return res.json({ success: true, message: "Logout successful." });
    } catch (err) {
        return serverError(res, err, "LOGOUT ERROR:");
    }
};