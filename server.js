const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const verifyRoutes = require("./routes/verifyRoutes");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/verify",verifyRoutes);

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


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
        const { username, password } = req.body;

        const [rows] = await pool.query(
            "SELECT * FROM founders WHERE username = ? AND password = ?",
            [username, password]
        );

        if (rows.length > 0) {
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
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get("/app-version", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT version, update_date
            FROM aerodeck_versions
            ORDER BY id DESC
            LIMIT 1
        `);

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