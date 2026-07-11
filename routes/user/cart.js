const express = require("express");

const router = express.Router();

const {

    getCart,

    addToCart,

    updateQuantity,

    removeFromCart

} = require("../../controllers/user/cartController");

router.get("/cart", getCart);

router.post("/cart", addToCart);

router.put("/cart", updateQuantity);

router.delete("/cart/:productId", removeFromCart);

module.exports = router;