const express = require("express");
const router = express.Router();

const userController = require("../../controllers/user/userController");


router.post(
    "/profile",
    userController.getProfile
);


router.put(
    "/update-name",
    userController.updateName
);


router.put(
    "/update-whatsapp",
    userController.updateWhatsapp
);


router.put(
    "/update-mobile",
    userController.updateMobile
);


router.post(
    "/whatsapp-order-data",
    userController.getWhatsAppOrderData
);


router.post(
    "/send-email-otp",
    userController.sendEmailOtp
);


router.post(
    "/verify-email-otp",
    userController.verifyEmailOtp
);


router.get(
    "/notification/count",
    userController.getNotificationCount
);

router.get(
    "/notification/all",
    userController.getAllNotifications
);

router.post(
    "/notification/insert",
    userController.insertNotification
);


router.post(
    "/notification/toggle-status",
    userController.toggleNotificationStatus
);

module.exports = router;