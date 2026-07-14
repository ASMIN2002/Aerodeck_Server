const express = require("express");

const router = express.Router();

const {
    getPremiums,
    addPremium,
    updatePremium,
    deletePremium
} = require("../controllers/premiumController");

router.get("/", getPremiums);

router.post("/", addPremium);

router.put("/", updatePremium);

router.delete("/:id", deletePremium);

module.exports = router;