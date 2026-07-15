const express = require("express");

const router = express.Router();

const {

    getPremium

} = require("../../controllers/user/userPremiumController");

router.get("/premium", getPremium);

module.exports = router;