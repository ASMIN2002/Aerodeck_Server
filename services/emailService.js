const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmailOtp(email, otp) {

    console.log("RESEND EMAIL START");

    try {

        const { data, error } = await resend.emails.send({
            from: "HEEPIT <onboarding@resend.dev>",
            to: [email],
            subject: "HEEPIT Email Verification OTP",

            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px;">

                    <h2 style="margin-bottom: 10px;">
                        HEEPIT Email Verification
                    </h2>

                    <p>
                        Your verification OTP is:
                    </p>

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
            `
        });

        if (error) {
            console.error("RESEND ERROR:", error);
            throw new Error(error.message);
        }

        console.log("RESEND EMAIL SENT:", data?.id);

        return data;

    } catch (err) {

        console.error("EMAIL SEND ERROR:", err);

        throw err;

    }
}

module.exports = {
    sendEmailOtp
};