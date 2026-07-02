const express = require("express");
const router = express.Router();

const {
    getProducts,
    getOffers,
    addProduct,
    updateProduct,
    deleteProduct
} = require("../controllers/productsController");

router.get("/products", getProducts);
router.get("/offers", getOffers);
router.post("/products", addProduct);
router.put("/products/update", updateProduct);
router.delete("/products/:id",deleteProduct);

module.exports = router;