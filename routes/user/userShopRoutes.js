const express = require("express");

const router = express.Router();

const {

    getShops

} = require("../../controllers/user/userShopController");

router.get("/shop", getShops);

module.exports = router;