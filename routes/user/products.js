const express = require("express");
const router = express.Router();

const {
    getProducts
} = require("../../controllers/user/productsController");

router.get("/products", getProducts);

module.exports = router;