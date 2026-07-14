const express = require("express");
const router = express.Router();

const {
    getProducts
} = require("../../controllers/user/productsController");

const {
    getOffers
} = require("../../controllers/user/offerController");


router.get("/products", getProducts);

router.get("/offers", getOffers);

module.exports = router;