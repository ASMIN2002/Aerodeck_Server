const express = require("express");
const router = express.Router();

const {
    createFounder,
    updateProfileImage,
    createAdmin,
    getAllUsers,
    verifyUserField
} = require("../controllers/founderController");

router.post("/create", createFounder);
router.put("/profile-image", updateProfileImage);
router.post("/create-admin", createAdmin);
router.get("/users", getAllUsers);
router.post("/users/verify-field", verifyUserField);

module.exports = router;