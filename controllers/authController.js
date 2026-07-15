const pool = require("../config/db");
const jwt = require("jsonwebtoken");


exports.register = async (req, res) => {
    try {
        const { full_name, mobile_number } = req.body;
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

        const [existingUser] = await pool.query(

            `SELECT user_id
             FROM User_Aerodeck
             WHERE mobile_number = ?`,

            [mobile_number]

        );

        if (existingUser.length > 0) {

            return res.json({

                success: false,

                message: "This mobile number is already registered."

            });

        }

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
                0,
                0
            )`,

            [
                full_name,
                mobile_number
            ]

        );

        const userId = result.insertId;

        const otp = Math.floor(

            100000 + Math.random() * 900000

        ).toString();

        await pool.query(

            `INSERT INTO User_OTP_Aerodeck
    (
        user_id,
        mobile_otp
    )
    VALUES
    (
        ?,
        ?
    )`,

            [
                userId,
                otp
            ]

        );

        console.log("REGISTER OTP :", otp);

        return res.json({

            success: true,

            message: "OTP generated successfully.",

            demoOtp: otp

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
                is_mobile_verified
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
                otp_id,
                mobile_otp
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

        if (otpRows[0].mobile_otp !== otp) {

            return res.json({

                success: false,

                message: "Invalid OTP."

            });

        }

        await pool.query(

            `UPDATE User_Aerodeck
             SET is_mobile_verified = 1
             WHERE user_id = ?`,

            [user.user_id]

        );


        return res.json({

            success: true,

            user: {

                user_id: user.user_id,

                full_name: user.full_name,

                mobile_number: user.mobile_number,

                email: user.email,

                is_mobile_verified: 1

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

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const [otpRows] = await pool.query(

            `SELECT otp_id
             FROM User_OTP_Aerodeck
             WHERE user_id = ?`,

            [user.user_id]

        );

        if (otpRows.length > 0) {

            await pool.query(

                `UPDATE User_OTP_Aerodeck
                 SET
                    mobile_otp = ?,
                    created_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,

                [
                    otp,
                    user.user_id
                ]

            );

        } else {

            await pool.query(

                `INSERT INTO User_OTP_Aerodeck
                (
                    user_id,
                    mobile_otp
                )
                VALUES
                (
                    ?,
                    ?
                )`,

                [
                    user.user_id,
                    otp
                ]

            );

        }

        console.log("LOGIN OTP :", otp);

        return res.json({

            success: true,

            message: "OTP generated successfully.",

            demoOtp: otp

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
                otp_id,
                mobile_otp
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

        if (otpRows[0].mobile_otp !== otp) {

            return res.json({

                success: false,

                message: "Invalid OTP."

            });

        }
        console.log("JWT_SECRET =", process.env.JWT_SECRET);

        const token = jwt.sign(
            {
                user_id: user.user_id
            },
            process.env.JWT_SECRET,
            {

                expiresIn: "30d"

            }

        );

        return res.json({

            success: true,

            token,

            user: {

                user_id: user.user_id,

                full_name: user.full_name,

                mobile_number: user.mobile_number,

                email: user.email,

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