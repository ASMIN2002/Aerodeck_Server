const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

const getDoctors = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM doctor_heepit ORDER BY doctor_id DESC`
        );
        return res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("GET DOCTORS ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const getDoctorById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT * FROM doctor_heepit WHERE doctor_id = ?`,
            [id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Doctor not found" });
        }
        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error("GET DOCTOR ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const addDoctor = async (req, res) => {
    try {
        const {
            doctor_name, specialization, experience,
            starting_at, ending_at, booking_price, seat,
            profile_image, profile_image_public_id,
        } = req.body;

        if (!doctor_name) return res.status(400).json({ success: false, message: "doctor_name required" });

        const [result] = await db.query(
            `INSERT INTO doctor_heepit (
                doctor_name, specialization, experience,
                starting_at, ending_at, booking_price, seat, profile_image, profile_image_public_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                doctor_name, specialization || null, experience || null,
                starting_at || null, ending_at || null, booking_price || null, seat || 0,
                profile_image || null, profile_image_public_id || null,
            ]
        );

        return res.json({ success: true, doctor_id: result.insertId, message: "Doctor Added Successfully" });
    } catch (err) {
        console.error("ADD DOCTOR ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const updateDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            doctor_name, specialization, experience,
            starting_at, ending_at, booking_price, seat,
            profile_image, profile_image_public_id,
        } = req.body;

        const [existing] = await db.query(`SELECT doctor_id FROM doctor_heepit WHERE doctor_id = ?`, [id]);
        if (existing.length === 0) return res.status(404).json({ success: false, message: "Doctor not found" });

        await db.query(
            `UPDATE doctor_heepit SET
                doctor_name = ?, specialization = ?, experience = ?,
                starting_at = ?, ending_at = ?, booking_price = ?, seat = ?,
                profile_image = ?, profile_image_public_id = ?
             WHERE doctor_id = ?`,
            [
                doctor_name, specialization || null, experience || null,
                starting_at || null, ending_at || null, booking_price || null, seat || 0,
                profile_image || null, profile_image_public_id || null, id,
            ]
        );

        return res.json({ success: true, message: "Doctor Updated Successfully" });
    } catch (err) {
        console.error("UPDATE DOCTOR ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const deleteDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`SELECT profile_image_public_id FROM doctor_heepit WHERE doctor_id = ?`, [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Doctor not found" });

        const publicId = rows[0].profile_image_public_id;
        if (publicId) {
            try { await cloudinary.uploader.destroy(publicId); } catch (err) { console.error("CLOUDINARY DELETE ERROR:", err.message); }
        }

        await db.query(`DELETE FROM doctor_heepit WHERE doctor_id = ?`, [id]);
        return res.json({ success: true, message: "Doctor Deleted Successfully" });
    } catch (err) {
        console.error("DELETE DOCTOR ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const getDoctorSlots = async (req, res) => {
    try {
        const { id } = req.params;
        const [doctorRows] = await db.query(`SELECT * FROM doctor_heepit WHERE doctor_id = ?`, [id]);
        if (doctorRows.length === 0) return res.status(404).json({ success: false, message: "Doctor not found" });

        const doctor = doctorRows[0];
        if (!doctor.starting_at || !doctor.ending_at) {
            return res.json({ success: true, slots: [] });
        }

        const [bookedRows] = await db.query(
            `SELECT user_id, time, is_booked FROM booked_doctor WHERE doctor_id = ?`,
            [id]
        );

        const bookedTimes = bookedRows.map(b => {
            const d = new Date(b.time);
            return {
                time: d.toISOString().slice(0, 16),
                isBooked: b.is_booked === 1,
                isProcessing: b.is_booked === 0
            };
        });

        const start = new Date(doctor.starting_at);
        const end = new Date(doctor.ending_at);
        const now = new Date();

        let slots = [];
        let current = new Date(start);

        while (current < end) {
            const slotTimeStr = current.toISOString().slice(0, 16);
            const existingBooking = bookedTimes.find(b => b.time === slotTimeStr);

            const isBooked = existingBooking ? existingBooking.isBooked : false;
            const isProcessing = existingBooking ? existingBooking.isProcessing : false;
            const isPast = current < now;

            slots.push({
                time: slotTimeStr,
                displayTime: current.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                isBooked: isBooked,
                isProcessing: isProcessing,
                isPast: isPast
            });

            current = new Date(current.getTime() + 15 * 60000);
        }

        return res.json({ success: true, doctor, slots });
    } catch (err) {
        console.error("GET SLOTS ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const bookDoctor = async (req, res) => {
    try {
        const { user_id, doctor_id, time } = req.body;
        if (!user_id || !doctor_id || !time) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const [userBookings] = await db.query(
            `SELECT id FROM booked_doctor WHERE user_id = ?`,
            [user_id]
        );
        if (userBookings.length > 0) {
            return res.status(400).json({ success: false, message: "You have already booked or reserved a slot." });
        }

        const [existing] = await db.query(
            `SELECT id FROM booked_doctor WHERE doctor_id = ? AND time = ?`,
            [doctor_id, time]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Slot already taken or waiting" });
        }

        await db.query(
            `INSERT INTO booked_doctor (user_id, doctor_id, time, is_booked) VALUES (?, ?, ?, 0)`,
            [user_id, doctor_id, time]
        );

        const whatsappNumber = "919583282886";
        const message = `USER = #${user_id}HEEPITUSER\nDOCTOR = #${doctor_id}\nTIME = ${time}\n\nPlease confirm my booking.`;

        return res.json({
            success: true,
            message: "Reservation created.",
            whatsapp_url: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
        });
    } catch (err) {
        console.error("BOOK DOCTOR ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const confirmBooking = async (req, res) => {
    try {
        const { user_id, doctor_id, time } = req.body;

        await db.query(
            `UPDATE booked_doctor SET is_booked = 1 WHERE user_id = ? AND doctor_id = ? AND time = ?`,
            [user_id, doctor_id, time]
        );

        return res.json({ success: true, message: "Booking Confirmed!" });
    } catch (err) {
        console.error("CONFIRM BOOKING ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const getMyBookings = async (req, res) => {
    try {
        const { user_id } = req.params;
        const [rows] = await db.query(
            `SELECT doctor_id, time, is_booked, created_at FROM booked_doctor WHERE user_id = ?`,
            [user_id]
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error("GET MY BOOKINGS ERROR:", err.message);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

module.exports = {
    getDoctors,
    getDoctorById,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctorSlots,
    bookDoctor,
    confirmBooking,
    getMyBookings
};