const pool = require("../config/db");
const crypto = require("crypto");
const pendingRegistrations = new Map();

exports.register = async (req, res) => {

    try {

        const {
            full_name,
            mobile_number
        } = req.body;

        if (!full_name || !mobile_number) {

            return res.json({
                success: false,
                message: "Full name and mobile number are required."
            });

        }

        if (!/^[A-Za-z ]+$/.test(full_name)) {

            return res.json({
                success: false,
                message: "Full name must contain only letters."
            });

        }

        if (!/^\d{10}$/.test(mobile_number)) {

            return res.json({
                success: false,
                message: "Mobile number must be exactly 10 digits."
            });

        }

        // Check if mobile number is already registered
        const [existingUser] = await pool.query(
            `SELECT
                user_id,
                is_mobile_verified
             FROM User_Aerodeck
             WHERE mobile_number = ?
             LIMIT 1`,
            [mobile_number]
        );

        if (existingUser.length > 0) {

            return res.json({
                success: false,
                message: "This mobile number is already registered."
            });

        }

        // Generate OTP
        const otp =
            crypto.randomInt(100000, 1000000).toString();

        const otpExpiresAt =
            Date.now() + (5 * 60 * 1000);

        // Store registration temporarily in server memory
        pendingRegistrations.set(
            mobile_number,
            {
                full_name,
                mobile_number,
                otp,
                otpExpiresAt
            }
        );

        // Send OTP through Founder SMS device
        const io = req.app.get("io");

        console.log("REGISTER OTP SMS COMMAND:", {
            phoneNumber: mobile_number,
            otp: otp,
            message: `Your AERODECK OTP is ${otp}`
        });

        if (io) {

            io.emit(
                "send_otp_to_primary_device",
                {
                    phoneNumber: mobile_number,
                    message: `Your AERODECK OTP is ${otp}`
                }
            );

        }

        return res.json({
            success: true,
            message: "OTP sent successfully."
        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};
exports.verifyRegisterOtp = async (req, res) => {

    try {

        const {
            mobile_number,
            otp
        } = req.body;

        if (!mobile_number || !otp) {

            return res.json({
                success: false,
                message: "Mobile number and OTP are required."
            });

        }

        // Get pending registration from server memory
        const pending =
            pendingRegistrations.get(mobile_number);

        if (!pending) {

            return res.json({
                success: false,
                message: "Registration OTP not found or expired."
            });

        }

        // Check OTP expiry
        if (Date.now() > pending.otpExpiresAt) {

            pendingRegistrations.delete(mobile_number);

            return res.json({
                success: false,
                message: "OTP expired. Please register again."
            });

        }

        // Check OTP
        if (pending.otp !== otp) {

            return res.json({
                success: false,
                message: "Invalid OTP."
            });

        }

        // Final check: make sure mobile is still not registered
        const [existingUser] = await pool.query(
            `SELECT user_id
             FROM User_Aerodeck
             WHERE mobile_number = ?
             LIMIT 1`,
            [mobile_number]
        );

        if (existingUser.length > 0) {

            pendingRegistrations.delete(mobile_number);

            return res.json({
                success: false,
                message: "This mobile number is already registered."
            });

        }

        // OTP verified successfully
        // NOW create the user
        const [result] = await pool.query(
            `INSERT INTO User_Aerodeck
            (
                full_name,
                mobile_number,
                email,
                is_mobile_verified,
                is_email_verified
            )
            VALUES
            (
                ?,
                ?,
                NULL,
                1,
                0
            )`,
            [
                pending.full_name,
                pending.mobile_number
            ]
        );

        const userId = result.insertId;

        // Remove pending OTP after successful registration
        pendingRegistrations.delete(mobile_number);

        // Create session
        const sessionToken =
            crypto.randomBytes(32).toString("hex");

        await pool.query(
            `INSERT INTO User_Session_Aerodeck
            (
                user_id,
                session_token,
                is_active
            )
            VALUES
            (
                ?,
                ?,
                1
            )`,
            [
                userId,
                sessionToken
            ]
        );

        return res.json({

            success: true,

            session_token: sessionToken,

            user: {
                user_id: userId,
                full_name: pending.full_name,
                mobile_number: pending.mobile_number,
                email: null,
                is_mobile_verified: 1,
                is_email_verified: 0
            }

        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

exports.login = async (req, res) => {
    try {

        const { mobile_number } = req.body;

        if (!mobile_number) {

            return res.json({

                success: false,

                message: "Mobile number is required."

            });

        }

        if (!/^\d{10}$/.test(mobile_number)) {

            return res.json({

                success: false,

                message: "Invalid mobile number."

            });

        }

        const [users] = await pool.query(

            `SELECT
                user_id,
                full_name,
                mobile_number,
                is_mobile_verified
             FROM User_Aerodeck
             WHERE mobile_number = ?`,

            [mobile_number]

        );

        if (users.length === 0) {

            return res.json({

                success: false,

                message: "Account does not exist."

            });

        }

        const user = users[0];

        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const io = req.app.get("io");

        console.log("OTP SMS COMMAND:", {
            phoneNumber: mobile_number,
            otp: otp,
            message: `Your AERODECK OTP is ${otp}`
        });

        if (io) {

            io.emit("send_otp_to_primary_device", {
                phoneNumber: mobile_number,
                message: `Your AERODECK OTP is ${otp}`
            });
        }

        await pool.query(

            `UPDATE User_OTP_Aerodeck
SET login_otp = ?,
    otp_expires_at = ?
WHERE user_id = ?`,
            [
                otp,
                otpExpiresAt,
                user.user_id
            ]

        );
        return res.json({
            success: true,
            message: "OTP sent successfully."
        });

    }

    catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

exports.verifyLoginOtp = async (req, res) => {

    try {

        const { mobile_number, otp } = req.body;

        if (!mobile_number || !otp) {

            return res.json({

                success: false,

                message: "Mobile number and OTP are required."

            });

        }

        const [users] = await pool.query(

            `SELECT
    user_id,
    full_name,
    mobile_number,
    email,
    profile_image,
    profile_image_id,
    is_mobile_verified,
    is_email_verified
FROM User_Aerodeck
WHERE mobile_number = ?`,

            [mobile_number]

        );

        if (users.length === 0) {

            return res.json({

                success: false,

                message: "Account not found."

            });

        }

        const user = users[0];

        const [otpRows] = await pool.query(
            `SELECT
        login_otp,
        otp_expires_at
     FROM User_OTP_Aerodeck
     WHERE user_id = ?`,
            [user.user_id]
        );

        if (otpRows.length === 0) {
            return res.json({
                success: false,
                message: "OTP not found."
            });
        }

        if (
            !otpRows[0].otp_expires_at ||
            new Date() > new Date(otpRows[0].otp_expires_at)
        ) {
            return res.json({
                success: false,
                message: "OTP expired."
            });
        }
        // const sessionToken = crypto.randomBytes(32).toString("hex");

        if (otpRows[0].login_otp !== otp) {



            return res.json({

                success: false,

                message: "Invalid OTP."

            });

        }
        const sessionToken = crypto.randomBytes(32).toString("hex");
        await pool.query(
            `UPDATE User_OTP_Aerodeck
     SET login_otp = NULL,
         otp_expires_at = NULL
     WHERE user_id = ?`,
            [user.user_id]
        );

        await pool.query(
            `UPDATE User_Session_Aerodeck
     SET is_active = 0
     WHERE user_id = ?`,
            [user.user_id]
        );

        const [sessionRows] = await pool.query(
            `SELECT session_id
     FROM User_Session_Aerodeck
     WHERE user_id = ?
     LIMIT 1`,
            [user.user_id]
        );

        if (sessionRows.length > 0) {

            await pool.query(
                `UPDATE User_Session_Aerodeck
         SET
             session_token = ?,
             login_at = CURRENT_TIMESTAMP,
             last_active_at = CURRENT_TIMESTAMP,
             is_active = 1
         WHERE user_id = ?`,
                [
                    sessionToken,
                    user.user_id
                ]
            );

        } else {

            await pool.query(
                `INSERT INTO User_Session_Aerodeck
        (
            user_id,
            session_token,
            is_active
        )
        VALUES
        (
            ?,
            ?,
            1
        )`,
                [
                    user.user_id,
                    sessionToken
                ]
            );

        }
        return res.json({
            success: true,
            session_token: sessionToken,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                mobile_number: user.mobile_number,
                email: user.email,
                profile_image: user.profile_image,
                profile_image_id: user.profile_image_id,
                is_mobile_verified: user.is_mobile_verified,
                is_email_verified: user.is_email_verified
            }
        });

    }

    catch (err) {

        console.error(err);

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
            `SELECT user_id
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

        const [userRows] = await pool.query(
            `SELECT *
             FROM User_Aerodeck
             WHERE user_id = ?
             LIMIT 1`,
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

        console.error(err);

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

            return res.json({

                success: false,

                message: "Session token is required."

            });

        }
        if (session_token) {

            await pool.query(
                `UPDATE User_Session_Aerodeck
     SET is_active = 0
     WHERE session_token = ?`,
                [session_token]
            );

        }

        return res.json({

            success: true,

            message: "Logout successful."

        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};
