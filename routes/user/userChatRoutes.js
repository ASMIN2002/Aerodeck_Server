const express = require("express");

const router = express.Router();

const userChatController =
    require("../../controllers/user/userChatController");


// ==============================
// CREATE CHAT
// ==============================

router.post(
    "/",
    userChatController.createChat
);


// ==============================
// GET USER CHATS
// ==============================

router.get(
    "/",
    userChatController.getChats
);


// ==============================
// ADD MESSAGE
// ==============================

router.post(
    "/:chat_id/message",
    userChatController.addMessage
);


// ==============================
// GET CHAT MESSAGES
// ==============================

router.get(
    "/:chat_id/messages",
    userChatController.getMessages
);

// ==============================
// SAVE CARD DETAILS
// ==============================

router.post(
    "/details",
    userChatController.saveCardDetails
);


// ==============================
// CANCEL CHAT
// ==============================

router.post(
    "/cancel",
    userChatController.cancelChat
);

module.exports = router;