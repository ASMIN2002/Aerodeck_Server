const express = require("express");

const router = express.Router();

const {

    getWishlist,

    saveProduct,

    removeProduct

} = require("../../controllers/user/wishlistController");

router.get("/wishlist", getWishlist);

router.post("/wishlist", saveProduct);

router.delete("/wishlist/:productId", removeProduct);

module.exports = router;