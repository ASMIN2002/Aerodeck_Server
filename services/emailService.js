const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

async function sendEmailOtp(email, otp) {

    await transporter.sendMail({
        from: `"HEEPIT" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "HEEPIT Email Verification OTP",

        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">

                <h2 style="margin-bottom: 10px;">
                    HEEPIT Email Verification
                </h2>

                <p>
                    Your verification OTP is:
                </p>

                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
                    ${otp}
                </div>

                <p>
                    This OTP is valid for <b>5 minutes</b>.
                </p>

                <p style="color: #777;">
                    If you did not request this OTP, please ignore this email.
                </p>

            </div>
        `
    });
}

module.exports = {
    sendEmailOtp
};