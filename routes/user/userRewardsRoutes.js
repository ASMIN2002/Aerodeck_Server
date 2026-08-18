const express = require("express");

const router = express.Router();


const {
    getUserRewards,
    checkUserRewards,
    spinReward
} = require("../../controllers/user/userRewardsController");


router.get(
    "/",
    getUserRewards
);


router.post(
    "/check",
    checkUserRewards
);

router.post(
    "/spin",
    spinReward
);

module.exports = router;