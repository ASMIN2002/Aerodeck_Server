const db = require("../../config/db");
const crypto = require("crypto");

const ALLOWED_SECTIONS = ["SHOP", "CARDS", "FOOD", "MEDICAL", "GIFTS"];

function serverError(res, err, context = "Server error.") {
  console.error(context, err.message);
  return res.status(500).json({ success: false, message: context });
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

function unauthorized(res, message = "Invalid username or password.") {
  return res.status(401).json({ success: false, message });
}

function notFound(res, message = "Not found") {
  return res.status(404).json({ success: false, message });
}

function parseSection(section) {
  const clean = (section || "").replace(/^EDIT--/, "");
  return clean.split("~")[0] || "";
}

exports.adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return badRequest(res, "Username and password are required.");

    const [rows] = await db.query(
      `SELECT id, name, username, password, section
             FROM heepitadmin WHERE username = ? LIMIT 1`,
      [username.trim()]
    );

    if (rows.length === 0) return unauthorized(res);

    const admin = rows[0];

    if (admin.password !== password) return unauthorized(res);

    const session_token = crypto.randomBytes(32).toString("hex");

    await db.query(
      `UPDATE heepitadmin SET session_token = ?, last_login = NOW() WHERE id = ?`,
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
        section: admin.section,
      },
    });
  } catch (err) {
    return serverError(res, err, "ADMIN LOGIN ERROR:");
  }
};

exports.getProfileByToken = async (req, res) => {
  try {
    const { session_token } = req.body;

    if (!session_token)
      return res.status(401).json({ success: false, message: "Session token required." });

    const [[admin]] = await db.query(
      `SELECT id, name, username, section
             FROM heepitadmin WHERE session_token = ? LIMIT 1`,
      [session_token]
    );

    if (!admin)
      return res.status(401).json({ success: false, message: "Invalid session." });

    return res.json({ success: true, admin });
  } catch (err) {
    return serverError(res, err, "GET PROFILE ERROR:");
  }
};

exports.setSection = async (req, res) => {
  try {
    const { admin_id, section } = req.body;

    if (!admin_id || !section)
      return badRequest(res, "admin_id and section are required.");

    const baseType = parseSection(section);

    if (!ALLOWED_SECTIONS.includes(baseType))
      return badRequest(res, "Invalid section.");

    const [result] = await db.query(
      `UPDATE heepitadmin SET section = ?
             WHERE id = ? AND section IS NULL`,
      [section, admin_id]
    );

    if (result.affectedRows === 0)
      return badRequest(res, "Section already set or admin not found.");

    return res.json({
      success: true,
      message: "Section set successfully.",
      section,
    });
  } catch (err) {
    return serverError(res, err, "SET SECTION ERROR:");
  }
};

exports.updateName = async (req, res) => {
  try {
    const { admin_id, name } = req.body;

    if (!admin_id || !name || !name.trim())
      return badRequest(res, "admin_id and name are required.");

    const [result] = await db.query(
      `UPDATE heepitadmin SET name = ? WHERE id = ?`,
      [name.trim(), admin_id]
    );

    if (result.affectedRows === 0) return notFound(res, "Admin not found.");

    return res.json({
      success: true,
      message: "Name updated successfully.",
      name: name.trim(),
    });
  } catch (err) {
    return serverError(res, err, "UPDATE NAME ERROR:");
  }
};

exports.getCategoriesByType = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) return badRequest(res, "type is required.");

    const [rows] = await db.query(
      `SELECT catid, category AS catname
             FROM all_category
             WHERE catname = ?
             ORDER BY category ASC`,
      [type]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    return serverError(res, err, "GET CATEGORIES ERROR:");
  }
};

exports.updateSection = async (req, res) => {
  try {
    const { admin_id, section } = req.body;

    if (!admin_id || !section)
      return badRequest(res, "admin_id and section are required.");

    const [result] = await db.query(
      `UPDATE heepitadmin SET section = ? WHERE id = ?`,
      [section, admin_id]
    );

    if (result.affectedRows === 0) return notFound(res, "Admin not found.");

    return res.json({
      success: true,
      message: "Section updated successfully.",
      section,
    });
  } catch (err) {
    return serverError(res, err, "UPDATE SECTION ERROR:");
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const { admin_id } = req.params;

    if (!admin_id) return badRequest(res, "admin_id is required.");

    const [rows] = await db.query(
      `SELECT likes, ratings, sells, pending, delivered, commission, analysh, created_at
             FROM heepitadmin_stats
             WHERE admin_id = ?
             ORDER BY id DESC LIMIT 1`,
      [admin_id]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          likes: 0, ratings: 0, sells: 0, pending: 0,
          delivered: 0, commission: 0, analysh: null, created_at: null,
        },
      });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return serverError(res, err, "GET ADMIN STATS ERROR:");
  }
};

exports.getAdminStatsRealtime = async (req, res) => {
  try {
    const { admin_id } = req.params;

    if (!admin_id) return badRequest(res, "admin_id is required.");

    const [[adminRow]] = await db.query(
      `SELECT username, section FROM heepitadmin WHERE id = ? LIMIT 1`,
      [admin_id]
    );

    if (!adminRow) return notFound(res, "Admin not found.");

    const adminUsername = adminRow.username;
    const baseType = parseSection(adminRow.section);
    const isCards = baseType === "CARDS";

    const productTable = isCards ? "cards_heepit" : "shop_heepit";
    const likesCol = isCards ? "product_total_likes" : "shop_total_likes";
    const ratingCol = isCards ? "product_rating" : "shop_rating";

    const [[productAgg], [statsRow]] = await Promise.all([
      db.query(
        `SELECT
                    COALESCE(SUM(${likesCol}), 0) AS total_likes,
                    COALESCE(AVG(${ratingCol}), 0) AS avg_rating
                 FROM ${productTable}
                 WHERE posted_by = ?`,
        [adminUsername]
      ).then(([rows]) => rows),
      db.query(
        `SELECT sells, pending, delivered, commission, analysh, created_at
                 FROM heepitadmin_stats
                 WHERE admin_id = ?
                 ORDER BY id DESC LIMIT 1`,
        [admin_id]
      ).then(([rows]) => rows),
    ]);

    const totalLikes = Number(productAgg?.total_likes) || 0;
    const avgRating = Number(productAgg?.avg_rating) || 0;

    return res.json({
      success: true,
      data: {
        likes: totalLikes,
        ratings: Number(avgRating.toFixed(2)) || 0,
        sells: Number(statsRow?.sells) || 0,
        pending: Number(statsRow?.pending) || 0,
        delivered: Number(statsRow?.delivered) || 0,
        commission: Number(statsRow?.commission) || 0,
        analysh: statsRow?.analysh || null,
        created_at: statsRow?.created_at || null,
      },
    });
  } catch (err) {
    return serverError(res, err, "GET ADMIN STATS REALTIME ERROR:");
  }
};