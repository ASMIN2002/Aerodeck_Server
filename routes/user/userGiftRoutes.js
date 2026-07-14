const express = require("express");
const router = express.Router();

const {
    getGifts
} = require("../../controllers/user/userGiftController");
router.get("/gifts", getGifts);

module.exports = router;