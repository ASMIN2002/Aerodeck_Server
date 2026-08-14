const db = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

exports.getProfile = async (req, res) => {

    try {

        const { session_token } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const [rows] = await db.query(
            `
            SELECT *
            FROM User_Aerodeck
            WHERE user_id = ?
            LIMIT 1
            `,
            [user_id]
        );

        return res.json({
            success: true,
            user: rows[0]
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

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

        await db.query(
            `
    UPDATE User_Aerodeck
    SET full_name = ?
    WHERE user_id = ?
    `,
            [
                full_name.trim(),
                user_id
            ]
        );

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }




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
// ===============================
// GET WHATSAPP ORDER DATA
// ===============================
exports.getWhatsAppOrderData = async (req, res) => {

    try {

        const { session_token, product_id } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required."
            });
        }

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        return res.json({
            success: true,
            user_id: user_id,
            product_id: product_id
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Server error."
        });

    }

};