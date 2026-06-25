const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({

  service: "gmail",

  auth: {

    user: process.env.MAIL_EMAIL,

    pass: process.env.MAIL_PASSWORD

  }

});

module.exports = transporter;