const express = require("express");

const router = express.Router();

const {
    createFounder,
    updateProfileImage,
    createAdmin
} = require("../controllers/founderController");

router.post(
    "/create",
    createFounder
);

router.put(
    "/profile-image",
    updateProfileImage
);

router.post(
    "/create-admin",
    createAdmin
);

module.exports = router;