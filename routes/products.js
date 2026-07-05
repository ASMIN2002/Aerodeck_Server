const express = require("express");
const router = express.Router();

const {
    getProducts,
    getOffers,
    addProduct,
    addOffer,
    updateProduct,
    deleteProduct,
    updateOfferStatus,
    deleteOffer
} = require("../controllers/productsController");

router.get("/products", getProducts);
router.get("/offers", getOffers);
router.post("/products", addProduct);
router.post("/offers", addOffer);
router.put("/products/update", updateProduct);
router.delete("/products/:id", deleteProduct);
router.put("/offers/status", updateOfferStatus);
router.delete("/offers/:id", deleteOffer);

module.exports = router;