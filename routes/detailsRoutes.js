const express = require("express");

const router = express.Router();

const {
    getDetails
} = require("../controllers/detailsController");


router.get(
    "/details/:type/:id",
    getDetails
);


module.exports = router;