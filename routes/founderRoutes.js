const express = require("express");

const router = express.Router();

const {

  createFounder,

  sendFounderOtp,

  verifyFounderOtp,

  sendOwnerOtp,

  verifyOwnerOtp

} = require("../controllers/founderController");

router.post(

  "/send-email-otp",

  sendFounderOtp

);

router.post(

  "/create",

  createFounder

);

router.post(

  "/verify-email-otp",

  verifyFounderOtp

);
router.post(

    "/send-owner-otp",

    sendOwnerOtp

);

router.post(

    "/verify-owner-otp",

    verifyOwnerOtp

);

module.exports = router;