const express = require("express");
const router = express.Router();

const {
    getUserRewards,
    updateUserRewards,
    scratchReward,
    useHypoPoints,
    sendRedeemRequest,
    handleRedeemRequest 
} = require("../../controllers/user/userRewardsController");

router.get("/rewards", getUserRewards);
router.post("/rewards", updateUserRewards);
router.post("/rewards/scratch", scratchReward);
router.post("/rewards/use", useHypoPoints);
router.post("/rewards/redeem/send", sendRedeemRequest);
router.post("/rewards/redeem/handle", handleRedeemRequest); 

module.exports = router;