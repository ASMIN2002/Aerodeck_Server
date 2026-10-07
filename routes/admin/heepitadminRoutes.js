const express = require("express");
const router = express.Router();
const heepitadminController = require("../../controllers/admin/heepitadminController");

router.post("/login", heepitadminController.adminLogin);
router.post("/profile", heepitadminController.getProfileByToken);
router.post("/set-section", heepitadminController.setSection);
router.post("/update-name", heepitadminController.updateName);
router.get("/categories", heepitadminController.getCategoriesByType);
router.post("/update-section", heepitadminController.updateSection);
router.get("/stats/:admin_id", heepitadminController.getAdminStats);
router.get("/stats-realtime/:admin_id", heepitadminController.getAdminStatsRealtime);

module.exports = router;