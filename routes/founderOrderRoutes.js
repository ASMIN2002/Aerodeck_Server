const express = require("express");
const router = express.Router();

const {
    getOrders,
    getOrdersWithUser,
    updateOrderStatus,
    getCancels,
    updateCancelStatus,
    getAdminCommissions
} = require("../controllers/founderOrderController");

router.get("/", getOrders);
router.get("/with-user", getOrdersWithUser);
router.put("/status", updateOrderStatus);
router.get("/cancels", getCancels);
router.put("/cancel-status", updateCancelStatus);
router.get("/commissions/:admin_id", getAdminCommissions);

module.exports = router;