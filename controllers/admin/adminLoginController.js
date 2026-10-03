const db = require("../../config/db");
const crypto = require("crypto");

exports.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        const [rows] = await db.query(
            `
      SELECT id, name, username, password, section
      FROM heepitadmin
      WHERE username = ?
      LIMIT 1
      `,
            [username.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        const admin = rows[0];

        if (admin.password !== password) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        const session_token = crypto.randomBytes(32).toString("hex");

        return res.json({
            success: true,
            message: "Login successful.",
            session_token,
            admin: {
                id: admin.id,
                name: admin.name,
                username: admin.username,
                section: admin.section
            }
        });

    } catch (err) {
        console.error("ADMIN LOGIN ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};

exports.setSection = async (req, res) => {
    try {
        const { admin_id, section } = req.body;

        if (!admin_id || !section) {
            return res.status(400).json({
                success: false,
                message: "admin_id and section are required."
            });
        }

        const allowed = ["SHOP", "CARDS", "FOOD", "MEDICAL", "GIFTS"];

        if (!allowed.includes(section)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section."
            });
        }

        const [result] = await db.query(
            `
      UPDATE heepitadmin
      SET section = ?
      WHERE id = ? AND section IS NULL
      `,
            [section, admin_id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message: "Section already set or admin not found."
            });
        }

        return res.json({
            success: true,
            message: "Section set successfully.",
            section
        });

    } catch (err) {
        console.error("SET SECTION ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
};