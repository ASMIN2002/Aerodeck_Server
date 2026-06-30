const express = require("express");
const router = express.Router();

const {
    getProducts,
    getOffers,
    addProduct
} = require("../controllers/productsController");

router.get("/products", getProducts);
router.get("/offers", getOffers);
router.post("/products", addProduct);

module.exports = router;