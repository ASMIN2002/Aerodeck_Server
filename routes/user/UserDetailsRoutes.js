const express = require("express");
const router = express.Router();

const {
    getDetails
} = require("../../controllers/user/UserDetailsController");

router.get("/:type/:id", getDetails);

module.exports = router;