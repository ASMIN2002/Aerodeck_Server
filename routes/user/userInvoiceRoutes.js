const express = require("express");
const router = express.Router();

const userInvoiceController = require("../../controllers/user/userInvoiceController");

router.get(
    "/:order_id/:product_id",
    userInvoiceController.getInvoice
);

module.exports = router;