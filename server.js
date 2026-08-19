require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const pool = require("./config/db");
const uploadRoutes = require("./routes/uploadRoutes");

const productsRoutes = require("./routes/products");
const founderRoutes = require("./routes/founderRoutes");
const authRoutes = require("./routes/authRoutes");
const giftRoutes = require("./routes/giftRoutes");
const premiumRoutes = require("./routes/premiumRoutes");
const shopRoutes = require("./routes/shopRoutes");
const founderOrderRoutes = require("./routes/founderOrderRoutes");


// SECURITY
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");


// USER
const userProductRoutes = require("./routes/user/userProducts");
const wishlistRoutes = require("./routes/user/wishlist");
const cartRoutes = require("./routes/user/cart");
const likesRoutes = require("./routes/user/likes");
const userGiftRoutes = require("./routes/user/userGiftRoutes");
const userShopRoutes = require("./routes/user/userShopRoutes");
const userPremiumRoutes = require("./routes/user/userPremiumRoutes");
const userDetailsRoutes = require("./routes/user/UserDetailsRoutes");
const userAddressRoutes = require("./routes/user/userAddressRoutes");
const userOrderRoutes = require("./routes/user/userOrderRoutes");
const UserPaymentRoute = require("./routes/user/UserPaymentRoute");
const userInvoiceRoutes = require("./routes/user/userInvoiceRoutes");
const userRoutes = require("./routes/user/userRoutes");
const reviewRoutes = require("./routes/user/reviewRoutes");
const smsRoutes = require("./routes/smsRoutes");




const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});
app.set("io", io);
io.on("connection", (socket) => {

    console.log(
        "SMS device connected:",
        socket.id
    );
    socket.on("register_sms_device", async (data) => {

        try {

            const {
                device_id,
                device_token
            } = data;

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

                socket.emit(
                    "sms_device_verified",
                    {
                        success: false,
                        message: "Invalid SMS device."
                    }
                );

                return;

            }

            if (rows[0].is_active !== 1) {

                socket.emit(
                    "sms_device_verified",
                    {
                        success: false,
                        message: "SMS device is inactive."
                    }
                );

                return;

            }

            if (rows[0].is_primary === 1) {

                socket.join("sms_primary");

            }

            socket.emit(
                "sms_device_verified",
                {
                    success: true,
                    is_primary:
                        rows[0].is_primary === 1
                }
            );

        } catch (error) {

            console.error(
                "SMS device verification error:",
                error
            );

            socket.emit(
                "sms_device_verified",
                {
                    success: false,
                    message: "Device verification failed."
                }
            );

        }

    });

    socket.on("test_sms_command", () => {

        socket.emit("sms_command", {

            type: "TEST",

            phoneNumber: "7847828859",

            message: "AERODECK TEST OTP 123456"

        });

    });
    socket.on("disconnect", () => {

        console.log(
            "SMS device disconnected:",
            socket.id
        );

    });

});
app.use(helmet());
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://localhost",
    "http://localhost:3000"
];

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));
app.use(express.json());
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});
app.use("/api/upload", uploadRoutes);
app.use("/api/founders", founderRoutes);
app.use("/api", productsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/gifts", giftRoutes);
app.use("/api/premium", premiumRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/founder/orders", founderOrderRoutes);



// USER
app.use("/api/user", userProductRoutes);
app.use("/api/user", wishlistRoutes);
app.use("/api/user", cartRoutes);
app.use("/api/user", likesRoutes);
app.use("/api/user", userGiftRoutes);
app.use("/api/user", userShopRoutes);
app.use("/api/user", userPremiumRoutes);
app.use("/api/user/details", userDetailsRoutes);
app.use("/api/user", userAddressRoutes);
app.use("/api/user/orders", userOrderRoutes);
app.use("/api/user/payment", UserPaymentRoute);
app.use("/api/user/invoice", userInvoiceRoutes);
app.use("/api/user", userRoutes);
app.use("/api/user/review", reviewRoutes);
app.use("/api/sms", smsRoutes);




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

app.get("/health", (req, res) => {

    res.status(200).json({

        success: true,

        status: "OK"

    });

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

app.get("/user/app-version/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const [rows] = await pool.query(
            `SELECT update_version
             FROM DownloadApp
             WHERE user_id = ?
             LIMIT 1`,
            [userId]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                error: "User app version not found"
            });
        }

        res.json({
            success: true,
            version: rows[0].update_version
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});
app.get("/user/check-update/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        // User ke DownloadApp table se installed version
        const [userRows] = await pool.query(
            `SELECT update_version
             FROM DownloadApp
             WHERE user_id = ?
             LIMIT 1`,
            [userId]
        );

        if (!userRows.length) {
            return res.status(404).json({
                success: false,
                error: "User app version not found"
            });
        }

        // Latest available version
        const [latestRows] = await pool.query(
            `SELECT version
             FROM aerodeck_versions
             ORDER BY id DESC
             LIMIT 1`
        );

        if (!latestRows.length) {
            return res.status(404).json({
                success: false,
                error: "Latest app version not found"
            });
        }

        const userVersion = String(userRows[0].update_version);
        const latestVersion = String(latestRows[0].version);

        const updateAvailable = userVersion !== latestVersion;

        res.json({
            success: true,
            update_available: updateAvailable,
            user_version: userVersion,
            latest_version: latestVersion
        });

    } catch (err) {
        console.error("CHECK UPDATE ERROR:", err);

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
httpServer.listen(process.env.PORT, () => {

    console.log(
        `Server running on port ${process.env.PORT}`
    );

});