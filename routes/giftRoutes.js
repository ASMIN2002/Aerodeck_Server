const express = require("express");

const router = express.Router();

const {
    getGifts,
    addGift,
    updateGift,
    deleteGift
} = require("../controllers/giftController");

router.get("/", getGifts);

router.post("/", addGift);

router.put("/", updateGift);

router.delete("/:id", deleteGift);

module.exports = router;