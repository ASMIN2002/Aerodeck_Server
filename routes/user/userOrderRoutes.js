const express = require("express");
const router = express.Router();

const {

    placeOrder,
    getOrders,
    getOrderDetails,
    updateOrderItemStatus,
    cancelOrder,
    getCancelStatus,
    updateReturnDate,
    returnProduct,
    cancelWholeOrder,
    getUserInfoForAdmin,
    adminPlaceOrder

} = require("../../controllers/user/userOrderController");

router.post("/place-order", placeOrder);
router.get("/", getOrders);
router.get("/cancel-status", getCancelStatus);
router.get("/:order_id", getOrderDetails);
router.put("/orders/item-status", updateOrderItemStatus);
router.post("/cancel-order", cancelOrder);
router.post("/update-return-date", updateReturnDate);
router.post("/return-product", returnProduct);
router.post("/cancel-whole-order", cancelWholeOrder);
router.get("/admin/user-info/:user_id", getUserInfoForAdmin);
router.post("/admin/place-order", adminPlaceOrder);

module.exports = router;