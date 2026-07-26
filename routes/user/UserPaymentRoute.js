const express = require("express");

const router = express.Router();

const paymentController = require("../../controllers/user/UserPaymentController");

router.get("/config", paymentController.getPaymentConfig);

router.post("/create-order", paymentController.createOrder);

router.post("/verify", paymentController.verifyPayment);

module.exports = router;