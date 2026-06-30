const express = require("express");
const cors = require("cors");
require("dotenv").config();

const verifyRoutes = require("./routes/verifyRoutes");
const pool = require("./config/db");
const uploadRoutes =
    require("./routes/uploadRoutes");
const founderRoutes =
    require("./routes/founderRoutes");

const productsRoutes = require("./routes/products");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/verify", verifyRoutes);

app.use(
    "/api/upload",
    uploadRoutes
);

app.use(
    "/api/founders",
    founderRoutes
);

app.use("/api", productsRoutes);

app.get("/", (req, res) => {

    res.send("AERODECK SERVER RUNNING");

});

app.get("/founders", async (req, res) => {

    try {

        const [rows] = await pool.query(
            "SELECT * FROM founders"
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

app.post("/login", async (req, res) => {

    try {

        const {

            username,

            password

        } = req.body;

        const [rows] = await pool.query(

            "SELECT * FROM founders WHERE username = ? AND password = ?",

            [
                username,
                password
            ]

        );
        if (rows.length > 0) {
            await pool.query(
                `INSERT INTO founders_verify
                (
                    founder_id,
                    otp,
                    is_verified,
                    verified_at,
                    expires_at,
                    created_at
                )
                VALUES
                (
                    ?,
                    NULL,
                    false,
                    NULL,
                    NULL,
                    NOW()
                )
                ON DUPLICATE KEY UPDATE

                        founder_id = founder_id`,

                [

                    rows[0].id

                ]

            );
            res.json({

                success: true,

                founder: rows[0]

            });

        } else {

            res.json({

                success: false

            });

        }

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

app.get("/app-version", async (req, res) => {

    try {

        const [rows] = await pool.query(

            `SELECT
                version,
                update_date
             FROM aerodeck_versions
             ORDER BY id DESC
             LIMIT 1`

        );

        res.json({

            success: true,

            data: rows[0]

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

app.get("/api/founder/profile", async (req, res) => {

    try {

        const { founderId } = req.query;

        const [rows] = await pool.query(

            `SELECT
        full_name,
        profile_image
      FROM founders
      WHERE id = ?`,

            [founderId]

        );

        if (rows.length === 0) {

            return res.json({

                success: false

            });

        }

        res.json({

            success: true,

            founder: rows[0]

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});
app.listen(process.env.PORT, () => {

    console.log(
        `Server running on port ${process.env.PORT}`
    );

});