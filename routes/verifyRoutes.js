const express = require("express");

const router = express.Router();

const {

  requestVerify,

  verifyOTP,

  verifyStatus

} = require("../controllers/verifyController");

router.post(
  "/request",
  requestVerify
);
router.post(
  "/otp",
  verifyOTP
);
router.get(
  "/status",
  verifyStatus
);

module.exports = router;