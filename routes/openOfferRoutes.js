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
    openOfferController.createOpenOffer
);

// GET ALL (Founder)
router.get("/", openOfferController.getAllOpenOffers);

// GET ACTIVE (User)
router.get("/active", openOfferController.getActiveOpenOffers);

// COUNT
router.get("/count", openOfferController.countOpenOffers);

// CLAIM (customer_count +1)
router.put("/:id/claim", openOfferController.incrementCustomerCount);

// DELETE
router.delete("/:id", openOfferController.deleteOpenOffer);

// UPDATE (with optional image)
router.put(
    "/:id",
    upload.single("image"),
    openOfferController.updateOpenOffer
);


module.exports = router;