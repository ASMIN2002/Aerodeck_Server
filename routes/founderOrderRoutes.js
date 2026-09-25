const express = require("express");
const router = express.Router();

const {
    getOrders,
    updateOrderStatus,
    getCancels,              // 👈 YEH HONA CHAHIYE
    updateCancelStatus       // 👈 YEH BHI
} = require("../controllers/founderOrderController");

router.get("/", getOrders);
router.put("/status", updateOrderStatus);
router.get("/cancels", getCancels);                    // 👈 YEH
router.put("/cancel-status", updateCancelStatus);      // 👈 YEH

module.exports = router;