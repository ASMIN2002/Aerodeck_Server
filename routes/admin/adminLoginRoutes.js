// server/routes/admin/adminLoginRoutes.js
const express = require("express");
const router = express.Router();
const adminLoginController = require("../../controllers/admin/adminLoginController");

router.post("/login", adminLoginController.adminLogin);
router.post("/set-section", adminLoginController.setSection);

module.exports = router;