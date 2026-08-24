const pool = require("../config/db");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../config/cloudinary");

exports.getApps = async (req, res) => {

    try {

        const [rows] = await pool.query(

            `SELECT
                id,
                appname,
                app_description,
                appimage,
                imageid,
                app_url,
                status,
                updated_at
             FROM HEEPITAPPS
             ORDER BY id DESC`

        );

        const apps = rows.map((app) => {

            let app_size = null;

            if (app.app_url) {

                const filePath = path.resolve(
                    __dirname,
                    "../../HEEPITWEBSITE/public",
                    app.app_url.replace(/^\/+/, "")
                );
                if (fs.existsSync(filePath)) {

                    const stats = fs.statSync(filePath);

                    const sizeMB =
                        stats.size / (1024 * 1024);

                    app_size =
                        sizeMB < 1
                            ? `${(stats.size / 1024).toFixed(1)} KB`
                            : `${sizeMB.toFixed(1)} MB`;

                }

            }

            return {
                ...app,
                app_size
            };

        });

        res.json({

            success: true,

            data: apps

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

exports.createApp = async (req, res) => {

    try {

        const {
            appname,
            app_description,
            app_url,
            status
        } = req.body;

        if (
            !appname ||
            !app_description ||
            !app_url
        ) {

            return res.status(400).json({
                success: false,
                message: "All Fields Required"
            });

        }

        if (!req.file) {

            return res.status(400).json({
                success: false,
                message: "App Image Required"
            });

        }

        // =========================
        // CLOUDINARY UPLOAD
        // =========================

        const result = await new Promise((resolve, reject) => {

            const stream =
                cloudinary.uploader.upload_stream(
                    {
                        folder: "AERODECK/HEEPITAPPS"
                    },

                    (err, result) => {

                        if (err) {

                            console.error(
                                "Cloudinary Error:",
                                err
                            );

                            return reject(err);

                        }

                        resolve(result);

                    }
                );

            stream.end(req.file.buffer);

        });

        // =========================
        // DATABASE INSERT
        // =========================

        const [insertResult] = await pool.query(

            `INSERT INTO HEEPITAPPS
            (
                appname,
                app_description,
                appimage,
                imageid,
                app_url,
                status,
                updated_at
            )
            VALUES
            (?, ?, ?, ?, ?, ?, NOW())`,

            [
                appname,
                app_description,
                result.secure_url,
                result.public_id,
                app_url,
                status ?? 1
            ]

        );

        res.json({

            success: true,

            id: insertResult.insertId,

            appimage: result.secure_url,

            imageid: result.public_id,

            message: "App Added Successfully"

        });

    }

    catch (err) {

        console.error(
            "CREATE APP FAILED:",
            err
        );

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

exports.deleteApp = async (req, res) => {

    try {

        const { id } = req.params;

        if (!id) {

            return res.status(400).json({
                success: false,
                message: "App ID Required"
            });

        }

        const [result] = await pool.query(
            `DELETE FROM HEEPITAPPS
             WHERE id = ?`,
            [id]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "App Not Found"
            });

        }

        res.json({
            success: true,
            message: "App Deleted Successfully"
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};