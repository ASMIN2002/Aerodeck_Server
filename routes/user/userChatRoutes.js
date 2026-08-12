const express = require("express");

const router = express.Router();

const userChatController =
    require("../../controllers/user/userChatController");


router.post(
    "/",
    userChatController.createChat
);

router.get(
    "/",
    userChatController.getChats
);

router.post(
    "/:chat_id/message",
    userChatController.addMessage
);


router.get(
    "/:chat_id/messages",
    userChatController.getMessages
);


router.post(
    "/details",
    userChatController.saveCardDetails
);
router.put(
    "/details",
    userChatController.updateCardDetails
);

router.post(
    "/cancel",
    userChatController.cancelChat
);

router.get(
    "/details/check",
    userChatController.checkCardDetails
);

module.exports = router;