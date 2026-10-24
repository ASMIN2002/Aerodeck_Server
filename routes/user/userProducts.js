const express = require("express");
const router = express.Router();

const {
    getProducts,
    getRelatedProducts
} = require("../../controllers/user/userProductsController");


router.get("/products", getProducts);

router.get("/products/related", getRelatedProducts);

module.exports = router;