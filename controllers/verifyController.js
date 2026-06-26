const pool = require("../config/db");
const transporter = require("../config/mailer");

const VERIFY_MODE = true;

exports.requestVerify = async (req, res) => {
  try {

    const { founderId } = req.body;
    console.log(
      "Founder ID Received =",
      founderId
    );

    if (!founderId) {

      return res.status(400).json({
        success: false,
        message: "Founder ID Required"
      });

    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    await pool.query(

      `UPDATE founders_verify
       SET
       otp = ?,
       is_verified = false,
       verified_at = NULL,
       expires_at = NULL,
       created_at = NOW()
       WHERE founder_id = ?`,

      [
        otp,
        founderId
      ]

    );

    await transporter.sendMail({

      from: process.env.MAIL_EMAIL,

      to: "asminkuldeep6@gmail.com",

      subject: "AERODECK Founder Verification OTP",

      html: `
        <h2>Your OTP</h2>
        <h1>${otp}</h1>
        <p>Do not share this OTP.</p>
      `

    });

    return res.json({

      success: true,

      message: "OTP Sent Successfully"

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: err.message

    });

  }

};
exports.verifyOTP = async (req, res) => {

  try {

    const {

      founderId,

      otp

    } = req.body;

    const [rows] = await pool.query(

      `SELECT otp
       FROM founders_verify
       WHERE founder_id = ?`,

      [

        founderId

      ]

    );

    if (

      rows.length === 0

    ) {

      return res.json({

        success: false,

        message: "Founder Not Found"

      });

    }

    if (

      rows[0].otp !== otp

    ) {

      return res.json({

        success: false,

        message: "Invalid OTP"

      });

    }

    await pool.query(

      `UPDATE founders_verify
SET
is_verified = true,

verified_at = DATE_ADD(
UTC_TIMESTAMP(),
INTERVAL 330 MINUTE
),

expires_at = DATE_ADD(
DATE_ADD(
UTC_TIMESTAMP(),
INTERVAL 330 MINUTE
),
INTERVAL 24 HOUR
)

WHERE founder_id = ?`,

      [

        founderId

      ]

    );

    return res.json({

      success: true,

      verified: rows[0].is_verified,

      expiresAt: rows[0].expires_at

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

exports.verifyStatus = async (req, res) => {

  try {

    const { founderId } = req.query;

    const [rows] = await pool.query(

      `SELECT
   is_verified,
   expires_at
   FROM founders_verify
   WHERE founder_id = ?`,

      [founderId]

    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        verified: false

      });

    }

    return res.json({
      success: true,
      verified: rows[0].is_verified,
      expiresAt: rows[0].expires_at

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Status Failed"

    });

  }

};