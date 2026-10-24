const express = require("express");
const router = express.Router();

const {
    getDoctors,
    getDoctorById,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctorSlots,
    bookDoctor,
    getMyBookings
} = require("../controllers/doctorController");

router.get("/", getDoctors);
router.get("/:id", getDoctorById);
router.post("/", addDoctor);
router.put("/:id", updateDoctor);
router.delete("/:id", deleteDoctor);

router.get("/:id/slots", getDoctorSlots);
router.post("/book", bookDoctor);
router.get("/my-bookings/:user_id", getMyBookings);

module.exports = router;