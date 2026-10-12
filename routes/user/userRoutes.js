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

router.get(
    "/details",
    userController.getUserDetails
);

router.get(
    "/notification/admin",
    userController.getAdminNotifications
);

router.get(
    "/processing/:item_id",
    userController.getProcessingUpdate
);
router.post(
    "/save-fcm-token",
    userController.saveFcmToken
);

router.get("/test-fcm/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;
        const { sendNotificationToUser } = require("../../utils/sendNotification");

        const result = await sendNotificationToUser(
            Number(user_id),
            "Test Notification",
            "Ye test hai - app band hone pe bhi aani chahiye"
        );

        res.json(result);
    } catch (err) {
        console.error("TEST FCM ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;