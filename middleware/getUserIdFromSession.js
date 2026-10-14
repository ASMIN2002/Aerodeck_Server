const pool = require("../config/db");

async function getUserIdFromSession(sessionToken) {

    const [rows] = await pool.query(
        `SELECT user_id
         FROM user_session_heepit
         WHERE session_token = ?
         AND is_active = 1
         LIMIT 1`,
        [sessionToken]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0].user_id;
}

module.exports = getUserIdFromSession;