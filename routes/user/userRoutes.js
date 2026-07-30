const express = require("express");
const router = express.Router();

const userController = require("../../controllers/user/userController");

// ===============================
// USER
// ===============================

router.put(
    "/update-name",
    userController.updateName
);

module.exports = router;