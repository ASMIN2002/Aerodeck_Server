const express = require("express");

const router = express.Router();

const upload =
require("../config/multer");

const {

uploadProfile

} =
require("../controllers/uploadController");

router.post(

"/profile",

upload.single("image"),

uploadProfile

);

module.exports = router;