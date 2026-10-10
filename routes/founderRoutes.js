const express = require("express");
const router = express.Router();

const {
    createFounder,
    updateProfileImage,
    createAdmin,
    getAllUsers,
    verifyUserField,
    allowAdmin,
    getAllTables,
    getTableData,
    getAllFounders,
    updateFounderPage,
    deleteFounderPage
} = require("../controllers/founderController");

router.post("/create", createFounder);
router.put("/profile-image", updateProfileImage);
router.post("/create-admin", createAdmin);
router.get("/users", getAllUsers);
router.post("/users/verify-field", verifyUserField);
router.post("/allow-admin", allowAdmin);
router.get("/tables", getAllTables);
router.get("/table/:tableName", getTableData);
router.get("/all-founders", getAllFounders);
router.post("/update-page", updateFounderPage);
router.post("/delete-page", deleteFounderPage);

module.exports = router;