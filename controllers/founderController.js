const pool = require("../config/db");
const transporter = require("../config/mailer");
const crypto = require("crypto");
const founderOtpStore = new Map();
const ownerOtpStore = new Map();
exports.sendFounderOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
           return res.json({
                success: false,
                message: "Email Required"
            });
        }
        const otp = crypto.randomInt(100000, 999999).toString();
        founderOtpStore.set(email, {
            otp,
            expiresAt: Date.now() + (5 * 60 * 1000)
        });
        await transporter.sendMail({
            from: process.env.MAIL_EMAIL,
            to: email,
            subject: "AERODECK Founder Verification",
            html: `
                <h2>AERODECK</h2>
                <p>Your Founder Verification OTP is</p>
                <h1>${otp}</h1>
                <p>This OTP expires in 5 minutes.</p>
            `
        });
        res.json({
            success: true,
            message: "OTP Sent Successfully"
        });
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.verifyFounderOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.json({
                success: false,
                message: "Email and OTP Required"
            });
        }
        const stored = founderOtpStore.get(email);
        if (!stored) {
            return res.json({
                success: false,
                message: "OTP Not Found"
            });
        }
        if (Date.now() > stored.expiresAt) {
            founderOtpStore.delete(email);
            return res.json({
                success: false,
                message: "OTP Expired"
            });
        }
        if (stored.otp !== otp) {
            return res.json({
                success: false,
                message: "Invalid OTP"
            });
        }
        founderOtpStore.delete(email);
        return res.json({
            success: true,
            message: "Founder Email Verified"
        });
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: "Verification Failed"
        });
    }
};
exports.sendOwnerOtp = async (req, res) => {
    try {
        const ownerEmail = process.env.OWNER_EMAIL;
        const otp = crypto.randomInt(100000, 999999).toString();
        ownerOtpStore.set(ownerEmail, {

            otp,

            expiresAt: Date.now() + (5 * 60 * 1000)

        });

        await transporter.sendMail({

            from: process.env.MAIL_EMAIL,

            to: ownerEmail,

            subject: "AERODECK Owner Authorization",

            html: `

                <h2>AERODECK</h2>

                <p>Your Owner Authorization OTP is</p>

                <h1>${otp}</h1>

                <p>This OTP expires in 5 minutes.</p>

            `

        });

        return res.json({

            success: true,

            message: "Owner OTP Sent Successfully"

        });
    }

    catch (err) {
        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

exports.verifyOwnerOtp = async (req, res) => {

    try {

        const { otp } = req.body;

        const ownerEmail = process.env.OWNER_EMAIL;

        const stored = ownerOtpStore.get(ownerEmail);

        if (!stored) {

            return res.json({

                success: false,

                message: "OTP Not Found"

            });

        }

        if (Date.now() > stored.expiresAt) {

            ownerOtpStore.delete(ownerEmail);

            return res.json({

                success: false,

                message: "OTP Expired"

            });

        }

        if (stored.otp !== otp) {

            return res.json({

                success: false,

                message: "Invalid OTP"

            });

        }

        ownerOtpStore.delete(ownerEmail);

        return res.json({

            success: true,

            message: "Owner Authorized"

        });

    }

    catch (err) {
        return res.status(500).json({

            success: false,

            message: "Verification Failed"

        });

    }

};

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