const express = require("express");

const router = express.Router();

const {
    getShops,
    addShop,
    updateShop,
    deleteShop
} = require("../controllers/shopController");

router.get("/", getShops);

router.post("/", addShop);

router.put("/", updateShop);

router.delete("/:id", deleteShop);

module.exports = router;