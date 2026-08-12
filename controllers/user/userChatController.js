const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

// ==============================
// CREATE CHAT
// ==============================

exports.createChat = async (req, res) => {

    try {

        const {
            session_token,
            product_id,
            order_id
        } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [result] = await pool.query(

            `INSERT INTO UserChat
            (user_id, product_id, order_id)
            VALUES (?, ?, ?)`,

            [
                user_id,
                product_id,
                order_id || null
            ]

        );

        res.json({

            success: true,
            message: "Chat created successfully.",
            chat_id: result.insertId

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};


// ==============================
// GET USER CHATS
// ==============================

exports.getChats = async (req, res) => {

    try {

        const { session_token } = req.query;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [rows] = await pool.query(

            `SELECT *
             FROM UserChat
             WHERE user_id = ?
             ORDER BY created_at DESC`,

            [user_id]

        );

        res.json({

            success: true,
            message: "Chats fetched successfully.",
            data: rows

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

exports.sendMessage = async (req, res) => {

    try {

        const {
            session_token,
            chat_id,
            sender,
            message,
            image_url
        } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [chatRows] = await pool.query(

            `SELECT chat_id
             FROM UserChat
             WHERE chat_id = ?
             AND user_id = ?`,

            [
                chat_id,
                user_id
            ]

        );

        if (chatRows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Chat not found."

            });

        }

        await pool.query(

            `INSERT INTO UserChat_Messages
            (chat_id, sender, message, image_url)
            VALUES (?, ?, ?, ?)`,

            [
                chat_id,
                sender,
                message || null,
                image_url || null
            ]

        );

        res.json({

            success: true,
            message: "Message sent successfully."

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

exports.getMessages = async (req, res) => {

    try {

        const { session_token } = req.query;
        const { chat_id } = req.params;

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [chatRows] = await pool.query(

            `SELECT chat_id
             FROM UserChat
             WHERE chat_id = ?
             AND user_id = ?`,

            [
                chat_id,
                user_id
            ]

        );

        if (chatRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });

        }

        const [messages] = await pool.query(

            `SELECT *
             FROM UserChat_Messages
             WHERE chat_id = ?
             ORDER BY created_at ASC`,

            [chat_id]

        );

        res.json({

            success: true,
            message: "Chat messages fetched successfully.",
            data: messages

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};
// ==============================
// ADD CHAT MESSAGE
// ==============================

exports.addMessage = async (req, res) => {

    try {

        const { session_token } = req.body;
        const { chat_id } = req.params;

        const {
            sender,
            message,
            image_url
        } = req.body;

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [chatRows] = await pool.query(

            `SELECT chat_id
             FROM UserChat
             WHERE chat_id = ?
             AND user_id = ?`,

            [
                chat_id,
                user_id
            ]

        );

        if (chatRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });

        }

        const [result] = await pool.query(

            `INSERT INTO UserChat_Messages
            (chat_id, sender, message, image_url)
            VALUES (?, ?, ?, ?)`,

            [
                chat_id,
                sender,
                message || null,
                image_url || null
            ]

        );

        res.json({

            success: true,
            message: "Chat message saved.",
            message_id: result.insertId

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};
// ==============================
// SAVE USER CARD DETAILS
// ==============================

exports.saveCardDetails = async (req, res) => {

    try {

        const {
            session_token,
            product_id,
            bride_name,
            groom_name,
            father_name,
            mother_name,
            address,
            additional_details,
            chat_id
        } = req.body;

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [chatRows] = await pool.query(

            `SELECT chat_id, product_id
     FROM UserChat
     WHERE chat_id = ?
     AND user_id = ?`,

            [
                chat_id,
                user_id
            ]

        );

        if (chatRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });

        }

        const actualProductId = chatRows[0].product_id;

        // Save form details
        const [result] = await pool.query(

            `INSERT INTO UserCardsDetails
            (
                user_id,
                product_id,
                bride_name,
                groom_name,
                father_name,
                mother_name,
                address,
                additional_details
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                user_id,
                actualProductId,
                bride_name,
                groom_name,
                father_name,
                mother_name,
                address,
                additional_details || null
            ]
        );

        // Save message in same chat
        await pool.query(

            `INSERT INTO UserChat_Messages
            (chat_id, sender, message, image_url)
            VALUES (?, ?, ?, ?)`,

            [
                chat_id,
                "user",
                "Form Submitted",
                null
            ]

        );

        res.json({

            success: true,
            message: "Card details saved successfully.",
            details_id: result.insertId

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};


// ==============================
// CANCEL CHAT
// ==============================

exports.cancelChat = async (req, res) => {

    try {

        const {
            session_token,
            product_id
        } = req.body;

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        // Find user's chat for this product
        const [chatRows] = await pool.query(

            `SELECT chat_id
             FROM UserChat
             WHERE user_id = ?
             AND product_id = ?`,

            [
                user_id,
                product_id
            ]

        );

        if (chatRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Chat not found."
            });

        }

        const chatIds = chatRows.map(
            row => row.chat_id
        );

        // Delete messages
        await pool.query(

            `DELETE FROM UserChat_Messages
             WHERE chat_id IN (?)`,

            [chatIds]

        );

        // Delete card details
        await pool.query(

            `DELETE FROM UserCardsDetails
             WHERE user_id = ?
             AND product_id = ?`,

            [
                user_id,
                product_id
            ]

        );

        // Delete root chat
        await pool.query(

            `DELETE FROM UserChat
             WHERE user_id = ?
             AND product_id = ?`,

            [
                user_id,
                product_id
            ]

        );

        res.json({

            success: true,
            message: "Chat cancelled successfully."

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};
// ==============================
// UPDATE USER CARD DETAILS
// ==============================

exports.updateCardDetails = async (req, res) => {

    try {

        const {
            session_token,
            product_id,
            bride_name,
            groom_name,
            father_name,
            mother_name,
            address,
            additional_details
        } = req.body;

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [result] = await pool.query(

            `UPDATE UserCardsDetails
             SET
                bride_name = ?,
                groom_name = ?,
                father_name = ?,
                mother_name = ?,
                address = ?,
                additional_details = ?
             WHERE user_id = ?
             AND product_id = ?`,

            [
                bride_name,
                groom_name,
                father_name,
                mother_name,
                address,
                additional_details || null,
                user_id,
                product_id
            ]

        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Card details not found."
            });

        }

        res.json({

            success: true,
            message: "Card details updated successfully."

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};
// ==============================
// CHECK CARD DETAILS
// ==============================

exports.checkCardDetails = async (req, res) => {

    try {

        const {
            session_token,
            product_id
        } = req.query;

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [rows] = await pool.query(

            `SELECT *
             FROM UserCardsDetails
             WHERE user_id = ?
             AND product_id = ?
             LIMIT 1`,

            [
                user_id,
                product_id
            ]

        );

        res.json({

            success: true,
            exists: rows.length > 0,
            data: rows[0] || null

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};