// server/controllers/admin/heepitadminController.js
const db = require("../../config/db");
const crypto = require("crypto");

/* ============================================
   ADMIN LOGIN
   ============================================ */
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

/* ============================================
   SET SECTION (only if NULL)
   ============================================ */
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

/* ============================================
   UPDATE NAME
   ============================================ */
exports.updateName = async (req, res) => {
  try {
    const { admin_id, name } = req.body;

    if (!admin_id || !name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "admin_id and name are required."
      });
    }

    const [result] = await db.query(
      `
      UPDATE heepitadmin
      SET name = ?
      WHERE id = ?
      `,
      [name.trim(), admin_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found."
      });
    }

    return res.json({
      success: true,
      message: "Name updated successfully.",
      name: name.trim()
    });

  } catch (err) {
    console.error("UPDATE NAME ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};
/* ============================================
   GET CATEGORIES BY TYPE
   ============================================ */
exports.getCategoriesByType = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "type is required."
      });
    }

    const [rows] = await db.query(
      `
      SELECT catid, category AS catname
      FROM ALL_Category
      WHERE catname = ?
      ORDER BY category ASC
      `,
      [type]
    );

    return res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error("GET CATEGORIES ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};

/* ============================================
   UPDATE SECTION
   ============================================ */
exports.updateSection = async (req, res) => {
  try {
    const { admin_id, section } = req.body;

    if (!admin_id || !section) {
      return res.status(400).json({
        success: false,
        message: "admin_id and section are required."
      });
    }

    const [result] = await db.query(
      `
      UPDATE heepitadmin
      SET section = ?
      WHERE id = ?
      `,
      [section, admin_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Admin not found."
      });
    }

    return res.json({
      success: true,
      message: "Section updated successfully.",
      section
    });

  } catch (err) {
    console.error("UPDATE SECTION ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};