const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
);

async function sendEmailOtp(email, otp) {

    console.log("BREVO EMAIL SEND START:", email);

    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = "HEEPIT Email Verification OTP";

    sendSmtpEmail.sender = {
        name: "HEEPIT",
        email: "heepit.official@gmail.com"
    };

    sendSmtpEmail.to = [
        {
            email: email
        }
    ];

    sendSmtpEmail.htmlContent = `
        <div style="
            font-family: Arial, sans-serif;
            max-width: 500px;
            margin: auto;
            padding: 20px;
        ">

            <h2>HEEPIT Email Verification</h2>

            <p>Your verification OTP is:</p>

            <div style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                margin: 20px 0;
            ">
                ${otp}
            </div>

            <p>
                This OTP is valid for <b>5 minutes</b>.
            </p>

            <p style="color: #777;">
                If you did not request this OTP, please ignore this email.
            </p>

        </div>
    `;

    try {

        const result = await apiInstance.sendTransacEmail(
            sendSmtpEmail
        );

        console.log("BREVO EMAIL SENT:", result);

        return result;

    } catch (err) {

        console.error("BREVO EMAIL ERROR:", err);

        throw err;

    }
}

module.exports = {
    sendEmailOtp
};