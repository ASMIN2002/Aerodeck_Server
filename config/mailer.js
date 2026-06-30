const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({

    service: "gmail",

    auth: {

        user: process.env.MAIL_EMAIL,

        pass: process.env.MAIL_PASSWORD

    }

});

transporter.verify((error, success) => {

    if (error) {

        console.log("SMTP VERIFY ERROR:");

        console.log(error);

    } else {

        console.log("SMTP READY");

    }

});

module.exports = transporter;