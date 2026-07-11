const express = require("express");

const router = express.Router();

const {

    getLikes,

    likeProduct,

    unlikeProduct

} = require("../../controllers/user/likesController");

router.get("/likes", getLikes);

router.post("/likes", likeProduct);

router.delete("/likes/:productId", unlikeProduct);

module.exports = router;