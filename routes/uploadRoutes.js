const express = require("express");

const router = express.Router();

const upload =
    require("../config/multer");

const {
    uploadProfile,
    uploadUserProfile,
    removeUserProfile,
    uploadProduct,
    uploadGift,
    uploadPremium,
    uploadShop,
    uploadReviewImage,
    deleteReviewImage,
    uploadPaymentProof,
    createProcessingOrder
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

router.post(

    "/user-profile",

    upload.single("image"),

    uploadUserProfile
);

router.post(

    "/remove-user-profile",

    removeUserProfile
);

router.post(
    "/review",
    upload.single("image"),
    uploadReviewImage
);

router.post(
    "/payment-proof",
    upload.single("payment_screenshot"),
    uploadPaymentProof
);

router.delete(

    "/review/:media_id",

    deleteReviewImage

);

router.post(
    "/processing-order",
    createProcessingOrder
);

module.exports = router;