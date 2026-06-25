const express = require("express");

const router = express.Router();

const {
  requestVerify,
  verifyStatus
} = require("../controllers/verifyController");

router.post(
  "/request",
  requestVerify
);

router.get(
  "/status",
  verifyStatus
);

module.exports = router;