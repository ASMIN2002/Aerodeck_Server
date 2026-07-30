const express = require("express");

const router = express.Router();

const {
    register,
    verifyRegisterOtp,
    login,
    verifyLoginOtp,
    checkSession,
    logout
} = require("../controllers/authController");

router.post(
    "/register",
    register
);

router.post(
    "/verify-register-otp",
    verifyRegisterOtp
);

router.post(
    "/login",
    login
);

router.post(
    "/verify-login-otp",
    verifyLoginOtp
);

router.post(
    "/check-session",
    checkSession
);

router.post(
    "/logout",
    logout
);

module.exports = router;