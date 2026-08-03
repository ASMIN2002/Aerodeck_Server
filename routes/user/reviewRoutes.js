const express = require("express");
const router = express.Router();

const reviewController = require("../../controllers/user/reviewController");

router.post("/", reviewController.submitReview);

router.get("/:product_id", reviewController.getReview);

module.exports = router;