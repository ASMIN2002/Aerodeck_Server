const express = require("express");
const router = express.Router();

const {
    getActiveVideos,       // ✅ ADD THIS
    getAllVideos,
    createVideo,
    toggleStatus,
    deleteVideo
} = require("../controllers/videoheroController");

/* ============================================
   PUBLIC ROUTE (User App)
   ============================================ */

router.get("/active", getActiveVideos);   // ✅ ADD THIS

/* ============================================
   FOUNDER ROUTES
   ============================================ */

router.get("/", getAllVideos);

router.post("/", createVideo);

router.put("/status/:id", toggleStatus);

router.delete("/:id", deleteVideo);

module.exports = router;