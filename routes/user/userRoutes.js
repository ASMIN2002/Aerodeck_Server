const express = require("express");
const router = express.Router();

const userController = require("../../controllers/user/userController");

// ===============================
// GET PROFILE
// ===============================
router.post(
    "/profile",
    userController.getProfile
);

// ===============================
// UPDATE USER NAME
// ===============================
router.put(
    "/update-name",
    userController.updateName
);

// ===============================
// GET WHATSAPP ORDER DATA
// ===============================
router.post(
    "/whatsapp-order-data",
    userController.getWhatsAppOrderData
);

// ===============================
// SEND EMAIL OTP
// ===============================
router.post(
    "/send-email-otp",
    userController.sendEmailOtp
);


// ===============================
// VERIFY EMAIL OTP
// ===============================
router.post(
    "/verify-email-otp",
    userController.verifyEmailOtp
);

module.exports = router;