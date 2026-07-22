const express = require("express");

const {
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setPrimaryAddress
} = require("../../controllers/user/userAddressController");

const router = express.Router();

router.get("/address/:user_id", getAddresses);

router.post("/address", addAddress);

router.put("/address/:address_id", updateAddress);

router.put("/address/primary/:address_id", setPrimaryAddress);

router.delete("/address/:address_id", deleteAddress);

module.exports = router;