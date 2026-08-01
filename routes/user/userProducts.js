const express = require("express");
const router = express.Router();

const {
    getProducts,
    getRelatedProducts
} = require("../../controllers/user/userProductsController");

const {
    getOffers
} = require("../../controllers/user/offerController");


router.get("/products", getProducts);

router.get("/offers", getOffers);

router.get("/products/related", getRelatedProducts);

module.exports = router;