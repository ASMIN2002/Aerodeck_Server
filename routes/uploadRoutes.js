const express = require("express");

const router = express.Router();

const upload =
    require("../config/multer");

const {

    uploadProfile,

    uploadProduct

} =

    require("../controllers/uploadController");
router.post(

    "/product",

    upload.single("image"),

    uploadProduct

);
router.post(

    "/profile",

    upload.single("image"),

    uploadProfile

);

module.exports = router;