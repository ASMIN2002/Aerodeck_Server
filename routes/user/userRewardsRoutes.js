const express = require("express");
const router = express.Router();

const {
    getUserRewards,
    updateUserRewards,
    scratchReward,
    useHypoPoints
} = require("../../controllers/user/userRewardsController");

router.get("/rewards", getUserRewards);
router.post("/rewards", updateUserRewards);
router.post("/rewards/scratch", scratchReward);
router.post("/rewards/use", useHypoPoints);

module.exports = router;