const express = require("express");
const router = express.Router();

const {
   getActiveVideos,
   getAllVideos,
   createVideo,
   updateVideo,
   toggleStatus,
   deleteVideo,
} = require("../controllers/videoheroController");

router.get("/active", getActiveVideos);
router.get("/", getAllVideos);
router.post("/", createVideo);
router.put("/status/:id", toggleStatus);
router.put("/:id", updateVideo);
router.delete("/:id", deleteVideo);

module.exports = router;