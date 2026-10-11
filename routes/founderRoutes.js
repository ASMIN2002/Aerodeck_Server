const express = require("express");
const router = express.Router();

const {
    createFounder,
    updateProfileImage,
    createAdmin,
    getAllUsers,
    verifyUserField,
    allowAdmin,
    getAllTables,
    getTableData,
    getAllFounders,
    updateFounderPage,
    deleteFounderPage,
    getAllNotificationsForManage,
    insertNotificationManage,
    updateNotificationManage,
    deleteNotificationManage
} = require("../controllers/founderController");

router.post("/create", createFounder);
router.put("/profile-image", updateProfileImage);
router.post("/create-admin", createAdmin);
router.get("/users", getAllUsers);
router.post("/users/verify-field", verifyUserField);
router.post("/allow-admin", allowAdmin);
router.get("/tables", getAllTables);
router.get("/table/:tableName", getTableData);
router.get("/all-founders", getAllFounders);
router.post("/update-page", updateFounderPage);
router.post("/delete-page", deleteFounderPage);
router.get("/notifications", getAllNotificationsForManage);
router.post("/notifications", insertNotificationManage);
router.put("/notifications", updateNotificationManage);
router.delete("/notifications/:id", deleteNotificationManage);

module.exports = router;