const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

exports.getActiveVideos = async (req, res) => {
    try {

        const [rows] = await db.query(
            `SELECT
                id,
                name,
                frontview,
                video_url,
                created_at
             FROM videohero
             WHERE status = 1
             ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        console.error("Fetch active videos error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};


exports.getAllVideos = async (req, res) => {
    try {

        const [rows] = await db.query(
            `SELECT * FROM videohero
             ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        console.error("Fetch videos error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.createVideo = async (req, res) => {
    try {

        const {
            name,
            frontview,
            video_url,
            public_id,
            status
        } = req.body;

        if (!name || !frontview || !video_url || !public_id) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO videohero
                (name, frontview, video_url, public_id, status)
             VALUES (?, ?, ?, ?, ?)`,
            [
                name,
                frontview,
                video_url,
                public_id,
                status !== undefined ? status : 1
            ]
        );

        return res.json({
            success: true,
            message: "Video saved successfully",
            id: result.insertId
        });

    } catch (err) {

        console.error("Create video error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

/* ============================================
   TOGGLE STATUS
   ============================================ */

exports.toggleStatus = async (req, res) => {
    try {

        const { id } = req.params;
        const { status } = req.body;

        await db.query(
            `UPDATE videohero SET status = ? WHERE id = ?`,
            [status, id]
        );

        return res.json({
            success: true,
            message: "Status updated"
        });

    } catch (err) {

        console.error("Toggle status error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

/* ============================================
   DELETE VIDEO
   ============================================ */

exports.deleteVideo = async (req, res) => {
    try {

        const { id } = req.params;

        /* Get public_id first */

        const [rows] = await db.query(
            `SELECT public_id FROM videohero WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Video not found"
            });
        }

        /* Delete from Cloudinary */

        if (rows[0].public_id) {
            try {
                await cloudinary.uploader.destroy(
                    rows[0].public_id,
                    { resource_type: "video" }
                );
                console.log("CLOUDINARY VIDEO DELETED:", rows[0].public_id);
            } catch (err) {
                console.error("Cloudinary delete error:", err);
                /* Continue even if Cloudinary delete fails */
            }
        }

        /* Delete from DB */

        await db.query(
            `DELETE FROM videohero WHERE id = ?`,
            [id]
        );

        return res.json({
            success: true,
            message: "Video deleted successfully"
        });

    } catch (err) {

        console.error("Delete video error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};