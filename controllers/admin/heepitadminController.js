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
      `SELECT id, name, username, password, section
             FROM heepitadmin
             WHERE username = ?
             LIMIT 1`,
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

    await db.query(
      `UPDATE heepitadmin
             SET session_token = ?, last_login = NOW()
             WHERE id = ?`,
      [session_token, admin.id]
    );

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

exports.getProfileByToken = async (req, res) => {
  try {
    const { session_token } = req.body;

    if (!session_token) {
      return res.status(401).json({
        success: false,
        message: "Session token required."
      });
    }

    const [[admin]] = await db.query(
      `SELECT id, name, username, section
             FROM heepitadmin
             WHERE session_token = ? LIMIT 1`,
      [session_token]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid session."
      });
    }

    return res.json({
      success: true,
      admin
    });

  } catch (err) {
    console.error("GET PROFILE ERROR:", err);
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

    const baseType = section.replace(/^EDIT--/, "").split("~")[0];
    const allowed = ["SHOP", "CARDS", "FOOD", "MEDICAL", "GIFTS"];

    if (!allowed.includes(baseType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid section."
      });
    }

    const [result] = await db.query(
      `UPDATE heepitadmin
             SET section = ?
             WHERE id = ? AND section IS NULL`,
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
      `UPDATE heepitadmin
             SET name = ?
             WHERE id = ?`,
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
      `SELECT catid, category AS catname
             FROM ALL_Category
             WHERE catname = ?
             ORDER BY category ASC`,
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
      `UPDATE heepitadmin
             SET section = ?
             WHERE id = ?`,
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

exports.getAdminStats = async (req, res) => {
  try {
    const { admin_id } = req.params;

    if (!admin_id) {
      return res.status(400).json({
        success: false,
        message: "admin_id is required."
      });
    }

    const [rows] = await db.query(
      `SELECT
                likes,
                ratings,
                sells,
                pending,
                delivered,
                commission,
                analysh,
                created_at
             FROM heepitadmin_stats
             WHERE admin_id = ?
             ORDER BY id DESC
             LIMIT 1`,
      [admin_id]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          likes: 0,
          ratings: 0,
          sells: 0,
          pending: 0,
          delivered: 0,
          commission: 0,
          analysh: null,
          created_at: null
        }
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });

  } catch (err) {
    console.error("GET ADMIN STATS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};

exports.getAdminStatsRealtime = async (req, res) => {
  try {
    const { admin_id } = req.params;

    if (!admin_id) {
      return res.status(400).json({
        success: false,
        message: "admin_id is required."
      });
    }

    const [[adminRow]] = await db.query(
      `SELECT username FROM heepitadmin WHERE id = ? LIMIT 1`,
      [admin_id]
    );

    if (!adminRow) {
      return res.status(404).json({
        success: false,
        message: "Admin not found."
      });
    }

    const adminUsername = adminRow.username;

    const [[shopAgg]] = await db.query(
      `SELECT
                COALESCE(SUM(shop_total_likes), 0) AS total_likes,
                COALESCE(AVG(shop_rating), 0) AS avg_rating
             FROM Shop_Aerodeck
             WHERE posted_by = ?`,
      [adminUsername]
    );

    const [[statsRow]] = await db.query(
      `SELECT
                sells,
                pending,
                delivered,
                commission,
                analysh,
                created_at
             FROM heepitadmin_stats
             WHERE admin_id = ?
             ORDER BY id DESC
             LIMIT 1`,
      [admin_id]
    );

    return res.json({
      success: true,
      data: {
        likes: Number(shopAgg.total_likes) || 0,
        ratings: Number(Number(shopAgg.avg_rating).toFixed(2)) || 0,
        sells: Number(statsRow?.sells) || 0,
        pending: Number(statsRow?.pending) || 0,
        delivered: Number(statsRow?.delivered) || 0,
        commission: Number(statsRow?.commission) || 0,
        analysh: statsRow?.analysh || null,
        created_at: statsRow?.created_at || null
      }
    });

  } catch (err) {
    console.error("GET ADMIN STATS REALTIME ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};