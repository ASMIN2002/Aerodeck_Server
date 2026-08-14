const express = require("express");

const router = express.Router();

router.get("/status", (req, res) => {

    res.json({
        success: true,
        message: "SMS service route is working"
    });

});

router.post("/register-device", async (req, res) => {

    try {

        const pool = require("../config/db");
        const crypto = require("crypto");

        const {
            device_name,
            device_phone
        } = req.body;

        if (!device_name || !device_phone) {

            return res.status(400).json({
                success: false,
                message: "Device name and phone are required."
            });

        }

        const device_token =
            crypto.randomBytes(32).toString("hex");

        await pool.query(
            `UPDATE SMS_Device_Aerodeck
             SET is_primary = 0`
        );

        const [result] = await pool.query(
            `INSERT INTO SMS_Device_Aerodeck
             (
                 device_name,
                 device_phone,
                 device_token,
                 is_primary,
                 is_active
             )
             VALUES (?, ?, ?, 1, 1)`,
            [
                device_name,
                device_phone,
                device_token
            ]
        );

        return res.json({
            success: true,
            message: "SMS device registered successfully.",
            device_id: result.insertId,
            device_token
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Failed to register SMS device."
        });

    }

});
router.post("/heartbeat", async (req, res) => {

    try {

        const pool = require("../config/db");

        const {
            device_id,
            device_token
        } = req.body;

        if (!device_id || !device_token) {

            return res.status(400).json({
                success: false,
                message: "Device credentials are required."
            });

        }

        const [rows] = await pool.query(
            `SELECT
                device_id,
                is_primary,
                is_active
             FROM SMS_Device_Aerodeck
             WHERE device_id = ?
               AND device_token = ?
             LIMIT 1`,
            [
                device_id,
                device_token
            ]
        );

        if (rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Invalid SMS device."
            });

        }

        if (rows[0].is_active !== 1) {

            return res.status(403).json({
                success: false,
                message: "SMS device is inactive."
            });

        }

        await pool.query(
            `UPDATE SMS_Device_Aerodeck
             SET last_seen_at = NOW()
             WHERE device_id = ?`,
            [device_id]
        );

        return res.json({
            success: true,
            is_primary: rows[0].is_primary === 1
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Heartbeat failed."
        });

    }

});

module.exports = router;