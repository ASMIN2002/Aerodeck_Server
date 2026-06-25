const express = require("express");
const cors = require("cors");
require("dotenv").config();

const verifyRoutes = require("./routes/verifyRoutes");
const pool = require("./config/db");

const app = express();
console.log("🔥 SERVER.JS LOADED");
app.use(cors());
app.use(express.json());

app.use("/api/verify", verifyRoutes);

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
        console.log("LOGIN ROWS =", rows);
        if (rows.length > 0) {
            console.log("LOGIN OK", rows[0].id);
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

                    otp = NULL,
                    is_verified = false,
                    verified_at = NULL,
                    expires_at = NULL,
                    created_at = NOW()`,

                [

                    rows[0].id

                ]

            );
            console.log("VERIFY ROW CREATED");
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

app.listen(process.env.PORT, () => {

    console.log(

        `Server running on port ${process.env.PORT}`

    );

});