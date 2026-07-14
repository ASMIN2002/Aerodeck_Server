const express = require("express");

const router = express.Router();

const upload =
    require("../config/multer");

const {

    uploadProfile,

    uploadProduct,

    uploadGift
} =

    require("../controllers/uploadController");
router.post(

    "/product",

    upload.single("image"),

    uploadProduct

);

router.post(

    "/gift",

    upload.single("image"),

    uploadGift

);

router.post(

    "/profile",

    upload.single("image"),

    uploadProfile

);

module.exports = router;