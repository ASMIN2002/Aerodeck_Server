const express = require("express");
const router = express.Router();

const reviewController = require("../../controllers/user/reviewController");
router.post("/", reviewController.submitReview);
router.get("/top/:product_id", reviewController.getTopReviews);
router.get("/all/:product_id", reviewController.getAllReviews);
router.get("/my-images/:product_id",reviewController.getMyReviewImages);
router.get("/media/:product_id", reviewController.getReviewMedia);
router.get("/:product_id", reviewController.getReview);


module.exports = router;