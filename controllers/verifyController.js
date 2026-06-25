const pool = require("../config/db");
const transporter = require("../config/mailer");

const VERIFY_MODE = true;

exports.requestVerify = async (req, res) => {
  console.log("BODY =", req.body);
  try {

    const { founderId } = req.body;

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

    // await transporter.sendMail({

    //   from: process.env.MAIL_EMAIL,

    //   to: "asminkuldeep6@gmail.com",

    //   subject: "AERODECK Founder Verification OTP",

    //   html: `
    //     <h2>Your OTP</h2>
    //     <h1>${otp}</h1>
    //     <p>Do not share this OTP.</p>
    //   `

    // });

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

exports.verifyStatus = async (req, res) => {

  try {

    const { founderId } = req.query;

    const [rows] = await pool.query(

      `SELECT is_verified
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

      verified: rows[0].is_verified

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: "Status Failed"

    });

  }

};