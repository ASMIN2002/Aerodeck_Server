const pool = require("../config/db");

const MAX_NOTIFICATION_LENGTH = 200;
const ALLOWED_PAGES = ["ADMIN", "USER"];

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function badRequest(res, message) {
    return res.status(400).json({ success: false, message });
}

function notFound(res, message = "Not found") {
    return res.status(404).json({ success: false, message });
}

function parsePages(str) {
    return (str || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
}

function validateNotification(notification) {
    if (!notification || !notification.trim())
        return { error: "Notification text is required." };

    const cleanText = notification.trim();

    if (cleanText.length > MAX_NOTIFICATION_LENGTH)
        return { error: `Maximum ${MAX_NOTIFICATION_LENGTH} characters allowed.` };

    return { cleanText };
}

async function updateFounderPages(founderId, updaterFn) {
    const [[founder]] = await pool.query(
        `SELECT updatepage FROM founders WHERE id = ? LIMIT 1`,
        [founderId]
    );

    if (!founder) return { error: "Founder not found.", status: 404 };

    const arr = parsePages(founder.updatepage);
    const result = updaterFn(arr);

    if (result.error) return result;

    const newVal = result.arr.length > 0 ? result.arr.join(",") : null;

    await pool.query(
        `UPDATE founders SET updatepage = ? WHERE id = ?`,
        [newVal, founderId]
    );

    return { newVal };
}

exports.createFounder = async (req, res) => {
    try {
        const { full_name, age, email, username, password, profile_image, created_by } = req.body;

        if (!full_name || !age || !email || !username || !password || !profile_image)
            return badRequest(res, "All Fields Required");

        if (!created_by)
            return badRequest(res, "Creator ID Missing");

        const [user] = await pool.query(`SELECT id FROM founders WHERE username = ?`, [username]);
        if (user.length > 0)
            return res.json({ success: false, message: "Username Already Exists" });

        const [mail] = await pool.query(`SELECT id FROM founders WHERE email = ?`, [email]);
        if (mail.length > 0)
            return res.json({ success: false, message: "Email Already Exists" });

        const [result] = await pool.query(
            `INSERT INTO founders (full_name, age, email, username, password, profile_image, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [full_name, age, email, username, password, profile_image]
        );

        await pool.query(
            `INSERT INTO founder_creation_logs
             (founder_id, created_by, founder_email_verified, owner_email_verified, created_at)
             VALUES (?, ?, 1, 1, NOW())`,
            [result.insertId, created_by]
        );

        return res.json({
            success: true,
            founderId: result.insertId,
            message: "Founder Created Successfully",
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateProfileImage = async (req, res) => {
    try {
        const { founderId, profile_image } = req.body;

        await pool.query(
            `UPDATE founders SET profile_image = ? WHERE id = ?`,
            [profile_image, founderId]
        );

        return res.json({ success: true });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.createAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password)
            return badRequest(res, "Username and password required.");

        const [existing] = await pool.query(
            `SELECT id FROM heepitadmin WHERE username = ? LIMIT 1`,
            [username]
        );

        if (existing.length > 0)
            return res.json({ success: false, message: "Username already exists, regenerate." });

        const [adminResult] = await pool.query(
            `INSERT INTO heepitadmin (username, password) VALUES (?, ?)`,
            [username, password]
        );

        const monthShort = new Date()
            .toLocaleString("en-US", { month: "short" })
            .toUpperCase();

        await pool.query(
            `INSERT INTO heepitadmin_stats
             (admin_id, likes, ratings, sells, pending, delivered, commission, analysh)
             VALUES (?, 0, 0, 0, 0, 0, 0, ?)`,
            [adminResult.insertId, monthShort]
        );

        return res.json({
            success: true,
            admin_id: adminResult.insertId,
            message: "Admin created successfully.",
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT user_id, full_name, mobile_number, whatsapp_number,
                    is_mobile_verified, is_whatsapp_verified, email, is_email_verified,
                    created_at, profile_image, profile_image_id
             FROM users_heepit
             ORDER BY user_id DESC`
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.verifyUserField = async (req, res) => {
    try {
        const { user_id, field, action } = req.body;

        if (!user_id || !field || !action)
            return badRequest(res, "user_id, field and action are required.");

        if (!["whatsapp", "mobile"].includes(field))
            return badRequest(res, "Invalid field.");

        if (!["verify", "ignore"].includes(action))
            return badRequest(res, "Invalid action.");

        const [rows] = await pool.query(
            `SELECT user_id, whatsapp_number, mobile_number,
                    is_whatsapp_verified, is_mobile_verified
             FROM users_heepit WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (!rows.length) return notFound(res, "User not found.");

        const user = rows[0];
        const numberCol = field === "whatsapp" ? "whatsapp_number" : "mobile_number";
        const verifyCol = field === "whatsapp" ? "is_whatsapp_verified" : "is_mobile_verified";

        if (!user[numberCol])
            return badRequest(res, `No ${field} number to verify.`);

        if (action === "verify") {
            await pool.query(
                `UPDATE users_heepit SET ${verifyCol} = 1 WHERE user_id = ?`,
                [user_id]
            );
        } else {
            await pool.query(
                `UPDATE users_heepit SET ${numberCol} = NULL, ${verifyCol} = 0 WHERE user_id = ?`,
                [user_id]
            );
        }

        const [updated] = await pool.query(
            `SELECT * FROM users_heepit WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        return res.json({
            success: true,
            message: `${field} ${action}ed successfully.`,
            user: updated[0],
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.allowAdmin = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username || !username.trim())
            return badRequest(res, "Username required.");

        const [[admin]] = await pool.query(
            `SELECT id, username, section FROM heepitadmin WHERE username = ? LIMIT 1`,
            [username.trim()]
        );

        if (!admin) return notFound(res, "Not available.");

        const currentSection = admin.section || "";

        if (currentSection.startsWith("EDIT--"))
            return res.json({ success: true, message: "Already allowed.", section: currentSection });

        const newSection = currentSection ? `EDIT--${currentSection}` : `EDIT--`;

        await pool.query(
            `UPDATE heepitadmin SET section = ? WHERE id = ?`,
            [newSection, admin.id]
        );

        return res.json({ success: true, message: "Allowed successfully.", section: newSection });
    } catch (err) {
        return serverError(res, err, "ALLOW ADMIN ERROR:");
    }
};

exports.getAllTables = async (req, res) => {
    try {
        const [rows] = await pool.query(`SHOW TABLES`);
        const tables = rows.map((row) => Object.values(row)[0]);
        return res.json({ success: true, data: tables });
    } catch (err) {
        return serverError(res, err, "GET ALL TABLES ERROR:");
    }
};

exports.getTableData = async (req, res) => {
    try {
        const { tableName } = req.params;

        if (!tableName) return badRequest(res, "Table name required.");

        const [tableCheck] = await pool.query(`SHOW TABLES LIKE ?`, [tableName]);

        if (tableCheck.length === 0) return notFound(res, "Table not found.");

        const [[rows], [columns]] = await Promise.all([
            pool.query(`SELECT * FROM \`${tableName}\` LIMIT 1000`),
            pool.query(`SHOW COLUMNS FROM \`${tableName}\``),
        ]);

        return res.json({
            success: true,
            tableName,
            columns: columns.map((col) => col.Field),
            rows,
            totalRows: rows.length,
        });
    } catch (err) {
        return serverError(res, err, "GET TABLE DATA ERROR:");
    }
};

exports.getAllFounders = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, full_name, username, email, profile_image, updatepage
             FROM founders ORDER BY id DESC`
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "GET ALL FOUNDERS ERROR:");
    }
};

exports.updateFounderPage = async (req, res) => {
    try {
        const { founder_id, page } = req.body;

        if (!founder_id || !page)
            return badRequest(res, "founder_id and page required.");

        const upperPage = page.toUpperCase();

        if (!ALLOWED_PAGES.includes(upperPage))
            return badRequest(res, "Invalid page.");

        const result = await updateFounderPages(founder_id, (arr) => {
            if (arr.includes(upperPage)) return { error: "Already added.", status: 400 };
            arr.push(upperPage);
            return { arr };
        });

        if (result.error)
            return res.status(result.status).json({ success: false, message: result.error });

        return res.json({
            success: true,
            message: "Updated successfully.",
            updatepage: result.newVal,
        });
    } catch (err) {
        return serverError(res, err, "UPDATE FOUNDER PAGE ERROR:");
    }
};

exports.deleteFounderPage = async (req, res) => {
    try {
        const { founder_id, page } = req.body;

        if (!founder_id || !page)
            return badRequest(res, "founder_id and page required.");

        const upperPage = page.toUpperCase();

        const result = await updateFounderPages(founder_id, (arr) => ({
            arr: arr.filter((p) => p !== upperPage),
        }));

        if (result.error)
            return res.status(result.status).json({ success: false, message: result.error });

        return res.json({
            success: true,
            message: "Deleted successfully.",
            updatepage: result.newVal,
        });
    } catch (err) {
        return serverError(res, err, "DELETE FOUNDER PAGE ERROR:");
    }
};

exports.getAllNotificationsForManage = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, notification, status, created_at
             FROM heepit_notification ORDER BY created_at DESC`
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "GET ALL NOTIF MANAGE ERROR:");
    }
};

exports.insertNotificationManage = async (req, res) => {
    try {
        const { notification, status } = req.body;

        const validation = validateNotification(notification);
        if (validation.error) return badRequest(res, validation.error);

        const statusVal = Number(status) === 1 ? 1 : 0;

        const [result] = await pool.query(
            `INSERT INTO heepit_notification (notification, status) VALUES (?, ?)`,
            [validation.cleanText, statusVal]
        );

        return res.json({
            success: true,
            message: "Notification inserted successfully.",
            id: result.insertId,
        });
    } catch (err) {
        return serverError(res, err, "INSERT NOTIF MANAGE ERROR:");
    }
};

exports.updateNotificationManage = async (req, res) => {
    try {
        const { id, notification, status } = req.body;

        if (!id) return badRequest(res, "Notification ID required.");

        const validation = validateNotification(notification);
        if (validation.error) return badRequest(res, validation.error);

        const statusVal = Number(status) === 1 ? 1 : 0;

        await pool.query(
            `UPDATE heepit_notification SET notification = ?, status = ? WHERE id = ?`,
            [validation.cleanText, statusVal, id]
        );

        return res.json({ success: true, message: "Notification updated successfully." });
    } catch (err) {
        return serverError(res, err, "UPDATE NOTIF MANAGE ERROR:");
    }
};

exports.deleteNotificationManage = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) return badRequest(res, "Notification ID required.");

        await pool.query(`DELETE FROM heepit_notification WHERE id = ?`, [id]);

        return res.json({ success: true, message: "Notification deleted successfully." });
    } catch (err) {
        return serverError(res, err, "DELETE NOTIF MANAGE ERROR:");
    }
};