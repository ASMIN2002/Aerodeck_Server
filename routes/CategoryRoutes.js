const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory
} = require("../controllers/CategoryController");


const upload = multer({
    storage: multer.memoryStorage()
});


// GET ALL CATEGORIES
router.get("/", getCategories);


// ADD CATEGORY
router.post(
    "/",
    upload.single("image"),
    addCategory
);


// UPDATE CATEGORY — catname + category
router.put(
    "/:catid",
    updateCategory
);


// DELETE CATEGORY — row + cloudinary image
router.delete(
    "/:catid",
    deleteCategory
);


module.exports = router;