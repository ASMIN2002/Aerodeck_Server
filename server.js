const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./config/db");
const uploadRoutes = require("./routes/uploadRoutes");

const productsRoutes = require("./routes/products");
const founderRoutes = require("./routes/founderRoutes");
const authRoutes = require("./routes/authRoutes");
const giftRoutes = require("./routes/giftRoutes");
const premiumRoutes = require("./routes/premiumRoutes");
const shopRoutes = require("./routes/shopRoutes");


// USER
const userProductRoutes = require("./routes/user/userProducts");
const wishlistRoutes = require("./routes/user/wishlist");
const cartRoutes = require("./routes/user/cart");
const likesRoutes = require("./routes/user/likes");
const userGiftRoutes = require("./routes/user/userGiftRoutes");


const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/upload", uploadRoutes);
app.use("/api/founders", founderRoutes);
app.use("/api", productsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/gifts", giftRoutes);
app.use("/api/premium", premiumRoutes);
app.use("/api/shop", shopRoutes);



// USER
app.use("/api/user", userProductRoutes);
app.use("/api/user", wishlistRoutes);
app.use("/api/user", cartRoutes);
app.use("/api/user", likesRoutes);
app.use("/api/user", userGiftRoutes);



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
        if (rows.length === 0) {
            return res.json({
                success: false,
                message: "Invalid Username or Password"
            });
        }
        return res.json({
            success: true,
            founder: rows[0]
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
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

app.put("/api/founder/profile-image", async (req, res) => {

    try {

        const { founderId, profile_image } = req.body;

        await pool.query(

            `UPDATE founders
             SET profile_image = ?
             WHERE id = ?`,

            [profile_image, founderId]

        );

        res.json({

            success: true

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

app.get("/api/users", async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                user_id,
                full_name,
                mobile_number,
                email,
                is_mobile_verified,
                is_email_verified,
                created_at
            FROM User_Aerodeck
            ORDER BY user_id DESC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }
});
app.get("/api/offers/count", async (req, res) => {

    try {

        const [rows] = await pool.query(

            `SELECT COUNT(*) AS totalOffers
             FROM Products_Offer_Aerodeck`

        );

        res.json({

            success: true,

            totalOffers: rows[0].totalOffers

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