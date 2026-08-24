const express = require("express");

const router = express.Router();

const upload =
    require("../config/multer");

const {
    getApps,
    createApp,
    deleteApp
} = require("../controllers/heepitAppsController");


router.get(
    "/heepit-apps",
    getApps
);


router.post(
    "/heepit-apps",
    upload.single("image"),
    createApp
);


router.delete(
    "/heepit-apps/:id",
    deleteApp
);


module.exports = router;