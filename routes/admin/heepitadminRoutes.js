// server/routes/admin/heepitadminRoutes.js
const express = require("express");
const router = express.Router();
const heepitadminController = require("../../controllers/admin/heepitadminController");

router.post("/login", heepitadminController.adminLogin);
router.post("/set-section", heepitadminController.setSection);
router.post("/update-name", heepitadminController.updateName);
router.get("/categories", heepitadminController.getCategoriesByType);
router.post("/update-section", heepitadminController.updateSection);

module.exports = router;