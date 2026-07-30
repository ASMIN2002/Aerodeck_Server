const db = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

// ===============================
// UPDATE USER NAME
// ===============================
exports.updateName = async (req, res) => {

    try {

        const {
            session_token,
            full_name
        } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!full_name || full_name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Full name is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        // Check remaining profile changes
        const [userRows] = await db.query(
            `
            SELECT
                profile_change_count
            FROM User_Aerodeck
            WHERE user_id = ?
            `,
            [user_id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        if (userRows[0].profile_change_count <= 0) {
            return res.status(400).json({
                success: false,
                message: "You have used all 2 monthly profile changes."
            });
        }

        // Update name + decrease count + save date
        await db.query(
            `
            UPDATE User_Aerodeck
            SET
                full_name = ?,
                profile_change_count = profile_change_count - 1,
                profile_last_change = NOW()
            WHERE user_id = ?
            `,
            [
                full_name.trim(),
                user_id
            ]
        );

        // Return updated user
        const [rows] = await db.query(
            `
            SELECT *
            FROM User_Aerodeck
            WHERE user_id = ?
            `,
            [user_id]
        );

        return res.json({
            success: true,
            message: "Name updated successfully.",
            user: rows[0]
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });

    }

};