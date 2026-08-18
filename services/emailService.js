const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    },

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
});

async function sendEmailOtp(email, otp) {

    console.log("EMAIL SEND START:", email);

    const info = await transporter.sendMail({
        from: `"AERODECK" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "AERODECK Email Verification OTP",

        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">
                <h2>AERODECK Email Verification</h2>

                <p>Your verification OTP is:</p>

                <div style="
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 8px;
                    margin: 20px 0;
                ">
                    ${otp}
                </div>

                <p>This OTP is valid for <b>5 minutes</b>.</p>

                <p style="color: #777;">
                    If you did not request this OTP, please ignore this email.
                </p>
            </div>
        `
    });

    console.log("EMAIL SENT:", info.messageId);

    return info;
}

module.exports = {
    sendEmailOtp
};