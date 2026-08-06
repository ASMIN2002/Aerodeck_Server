const express = require("express");
const router = express.Router();

const {

    getOrders,
    updateOrderStatus

} = require("../controllers/founderOrderController");

router.get("/", getOrders);
router.put("/status", updateOrderStatus);

module.exports = router;