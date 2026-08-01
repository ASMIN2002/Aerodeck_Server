const express = require("express");
const router = express.Router();

const {

    placeOrder,
    getOrders,
    getOrderDetails,
    updateOrderItemStatus

} = require("../../controllers/user/userOrderController");

router.post("/place-order", placeOrder);
router.get("/", getOrders);
router.get("/:order_id", getOrderDetails);
router.put("/orders/item-status", updateOrderItemStatus);

module.exports = router;