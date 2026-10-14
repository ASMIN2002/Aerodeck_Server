const express = require("express");
const router = express.Router();
const multer = require("multer");

const openOfferController = require("../controllers/openOfferController");


// =====================================
// MULTER — MEMORY STORAGE (Category jaisa)
// =====================================

const upload = multer({
    storage: multer.memoryStorage()
});


// =====================================
// ROUTES
// =====================================

// CREATE
router.post(
    "/",
    upload.single("image"),
    openOfferController.createopen_offer_heepit
);

// GET ALL (Founder)
router.get("/", openOfferController.getAllopen_offer_heepits);

// GET ACTIVE (User)
router.get("/active", openOfferController.getActiveopen_offer_heepits);

// COUNT
router.get("/count", openOfferController.countopen_offer_heepits);

// CLAIM (customer_count +1)
router.put("/:id/claim", openOfferController.incrementCustomerCount);

// DELETE
router.delete("/:id", openOfferController.deleteopen_offer_heepit);

// UPDATE (with optional image)
router.put(
    "/:id",
    upload.single("image"),
    openOfferController.updateopen_offer_heepit
);


module.exports = router;