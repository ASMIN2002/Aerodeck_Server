const express = require("express");

const router = express.Router();

const {
    createFounder,
    updateProfileImage
} = require("../controllers/founderController");

router.post(
    "/create",
    createFounder
);

router.put(
    "/profile-image",
    updateProfileImage
);

module.exports = router;