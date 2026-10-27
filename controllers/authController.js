const pool = require("../config/db");
const crypto = require("crypto");
const { sendEmailOtp } = require("../services/emailService");

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

async function getUserById(conn, user_id) {
    const [rows] = await conn.query(
        `SELECT ${USER_FIELDS} FROM users_heepit WHERE user_id = ? LIMIT 1`,
        [user_id]
    );
    return rows[0] || null;
}

async function generatePromoCode(conn) {
    const [lastReward] = await conn.query(
        `SELECT promo_code FROM user_rewards_heepit
         WHERE promo_code LIKE 'HE%HY'
         ORDER BY id DESC LIMIT 1`
    );

    let nextNumber = 1;

    if (lastReward.length > 0 && lastReward[0].promo_code) {
        const match = lastReward[0].promo_code.match(/HE(\d+)HY/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
    }

    return `HE${String(nextNumber).padStart(4, "0")}HY`;
}

async function createNewUser(conn, cleanEmail) {
    const [result] = await conn.query(
        `INSERT INTO users_heepit (email, is_email_verified) VALUES (?, 1)`,
        [cleanEmail]
    );

    const userId = result.insertId;

    const promo_code = await generatePromoCode(conn);

    await conn.query(
        `INSERT INTO user_rewards_heepit
         (user_id, hypo_points, redeemed, promo_code, count)
         VALUES (?, ?, 0, ?, 0)`,
        [userId, NEW_USER_HYPO_POINTS, promo_code]
    );

    const [versionRows] = await conn.query(
        `SELECT version FROM heepit_versions ORDER BY id DESC LIMIT 1`
    );

    const currentVersion = versionRows[0]?.version;

    if (currentVersion) {
        await conn.query(
            `INSERT INTO download_app_users (user_id, update_version) VALUES (?, ?)`,
            [userId, currentVersion]
        );
    }

    return userId;
}

async function saveOtp(conn, email, otp, expiresAt) {
    await conn.query(
        `INSERT INTO user_otp_heepit (email, email_otp, email_otp_expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
            email_otp = VALUES(email_otp),
            email_otp_expires_at = VALUES(email_otp_expires_at)`,
        [email, otp, expiresAt]
    );
}

async function getOtp(conn, email) {
    const [rows] = await conn.query(
        `SELECT email_otp, email_otp_expires_at FROM user_otp_heepit
         WHERE email = ? LIMIT 1`,
        [email]
    );
    return rows[0] || null;
}

async function deleteOtp(conn, email) {
    await conn.query(`DELETE FROM user_otp_heepit WHERE email = ?`, [email]);
}

exports.sendOtp = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { email } = req.body;

        if (!email) {
            conn.release();
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        if (!EMAIL_REGEX.test(cleanEmail)) {
            conn.release();
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        const otp = generateOtp();
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

        await saveOtp(conn, cleanEmail, otp, otpExpiresAt);

        conn.release();

        try {
            await sendEmailOtp(cleanEmail, otp);
        } catch (emailErr) {
            console.error("EMAIL SEND ERROR:", emailErr.message);
            try {
                await pool.query(`DELETE FROM user_otp_heepit WHERE email = ?`, [cleanEmail]);
            } catch (delErr) {
                console.error("OTP CLEANUP ERROR:", delErr.message);
            }
            return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
        }

        return res.json({ success: true, message: "OTP sent to your email." });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err, "SEND OTP ERROR");
    }
};

exports.verifyOtp = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            conn.release();
            return res.status(400).json({ success: false, message: "Email and OTP are required." });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const cleanOtp = String(otp).trim();

        const pending = await getOtp(conn, cleanEmail);

        if (!pending) {
            conn.release();
            return res.status(400).json({ success: false, message: "OTP not found or expired." });
        }

        if (new Date() > new Date(pending.email_otp_expires_at)) {
            await deleteOtp(conn, cleanEmail);
            conn.release();
            return res.status(400).json({ success: false, message: "OTP expired. Please try again." });
        }

        if (pending.email_otp !== cleanOtp) {
            conn.release();
            return res.status(400).json({ success: false, message: "Invalid OTP." });
        }

        const [users] = await conn.query(
            `SELECT ${USER_FIELDS} FROM users_heepit WHERE email = ? LIMIT 1`,
            [cleanEmail]
        );

        let isNewUser = false;
        let user;

        await conn.beginTransaction();
        try {
            if (users.length === 0) {
                isNewUser = true;
                const userId = await createNewUser(conn, cleanEmail);
                user = await getUserById(conn, userId);
            } else {
                user = users[0];
            }

            const sessionToken = generateSessionToken();

            await conn.query(
                `INSERT INTO user_session_heepit
                 (user_id, session_token, is_active, login_at, last_active_at)
                 VALUES (?, ?, 1, NOW(), NOW())`,
                [user.user_id, sessionToken]
            );

            await deleteOtp(conn, cleanEmail);

            await conn.commit();
            conn.release();

            return res.json({
                success: true,
                is_new_user: isNewUser,
                session_token: sessionToken,
                user,
            });
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err, "VERIFY OTP ERROR");
    }
};

exports.checkSession = async (req, res) => {
    try {
        const sessionToken = req.body?.session_token;

        if (!sessionToken)
            return res.json({ success: false, authenticated: false });

        const [sessionRows] = await pool.query(
            `SELECT session_id, user_id, last_active_at FROM user_session_heepit
             WHERE session_token = ? AND is_active = 1 LIMIT 1`,
            [sessionToken]
        );

        if (sessionRows.length === 0)
            return res.json({ success: false, authenticated: false });

        const session = sessionRows[0];

        const lastActive = new Date(session.last_active_at).getTime();
        const now = Date.now();

        if (now - lastActive > 5 * 60 * 1000) {
            await pool.query(
                `UPDATE user_session_heepit
                 SET last_active_at = CURRENT_TIMESTAMP
                 WHERE session_id = ?`,
                [session.session_id]
            );
        }

        const user = await getUserById(pool, session.user_id);

        if (!user)
            return res.json({ success: false, authenticated: false });

        return res.json({ success: true, authenticated: true, user });
    } catch (err) {
        return serverError(res, err, "CHECK SESSION ERROR");
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
        return serverError(res, err, "LOGOUT ERROR");
    }
};