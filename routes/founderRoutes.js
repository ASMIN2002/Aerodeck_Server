const express = require("express");

const router = express.Router();

const {

  createFounder

} = require("../controllers/founderController");

router.post(

  "/create",

  createFounder

);

module.exports = router;