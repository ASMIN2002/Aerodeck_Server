const express = require("express");
const router = express.Router();

const {
    sendOtp,
    verifyOtp,
    checkSession,
    logout
} = require("../controllers/authController");

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/check-session", checkSession);
router.post("/logout", logout);

module.exports = router;