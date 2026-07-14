const express = require("express");

const router = express.Router();

const upload =
    require("../config/multer");

const {

    uploadProfile,

    uploadProduct,

    uploadGift,

    uploadPremium,

    uploadShop

} = require("../controllers/uploadController");


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

    "/premium",

    upload.single("image"),

    uploadPremium

);

router.post(

    "/shop",

    upload.single("image"),

    uploadShop

);

router.post(

    "/profile",

    upload.single("image"),

    uploadProfile

);

module.exports = router;