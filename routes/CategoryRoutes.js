const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
    getCategories,
    addCategory
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


module.exports = router;