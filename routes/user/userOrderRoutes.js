const express = require("express");
const router = express.Router();

const {

    placeOrder,
    getOrders,
    getOrderDetails,
    updateOrderItemStatus,
    cancelOrder,
    getCancelStatus

} = require("../../controllers/user/userOrderController");

router.post("/place-order", placeOrder);
router.get("/", getOrders);
router.get("/cancel-status", getCancelStatus);
router.get("/:order_id", getOrderDetails);
router.put("/orders/item-status", updateOrderItemStatus);
router.post("/cancel-order", cancelOrder);

module.exports = router;