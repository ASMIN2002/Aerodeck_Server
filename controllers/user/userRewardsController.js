const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

/* ============================================
   GET USER REWARDS
   ============================================ */
exports.getUserRewards = async (req, res) => {

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
            `SELECT
                id,
                user_id,
                hypo_points,
                redeemed,
                promo_code,
                count,
                used_hypo,
                req_userid,
                updated_at
             FROM USER_REWARDS
             WHERE user_id = ?
             LIMIT 1`,
            [user_id]
        );

        const myReward = rows[0] || null;

        /* Owner ka naam (jiski row mein meri ID req_userid mein hai) */
        let ownerName = "";

        const [[ownerRow]] = await pool.query(
            `SELECT user_id
             FROM USER_REWARDS
             WHERE req_userid = ?
             LIMIT 1`,
            [user_id]
        );

        if (ownerRow) {
            const [[ownerUser]] = await pool.query(
                `SELECT full_name FROM User_Aerodeck WHERE user_id = ? LIMIT 1`,
                [ownerRow.user_id]
            );

            if (ownerUser) {
                ownerName = ownerUser.full_name || "User";
            }
        }

        res.json({
            success: true,
            data: myReward ? {
                ...myReward,
                owner_name: ownerName
            } : null
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};
exports.updateUserRewards = async (req, res) => {

    try {

        const { session_token, hypo_points, redeemed } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [existing] = await pool.query(
            `SELECT id FROM USER_REWARDS WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (existing.length > 0) {

            await pool.query(
                `UPDATE USER_REWARDS
                 SET hypo_points = ?, redeemed = ?
                 WHERE user_id = ?`,
                [hypo_points, redeemed, user_id]
            );

        } else {

            await pool.query(
                `INSERT INTO USER_REWARDS
                 (user_id, hypo_points, redeemed)
                 VALUES (?, ?, ?)`,
                [user_id, hypo_points, redeemed]
            );

        }

        res.json({
            success: true,
            message: "Rewards updated successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

exports.scratchReward = async (req, res) => {

    try {

        const { session_token, number } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const [rows] = await pool.query(
            `SELECT id, hypo_points, count
             FROM USER_REWARDS
             WHERE user_id = ?
             LIMIT 1`,
            [user_id]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Rewards not found."
            });

        }

        const reward = rows[0];

        if (reward.count <= 0) {

            return res.status(400).json({
                success: false,
                message: "No chances left."
            });

        }

        const pointsToAdd = Number(number) || 0;

        const newPoints = reward.hypo_points + pointsToAdd;
        const newCount = reward.count - 1;

        await pool.query(
            `UPDATE USER_REWARDS
             SET hypo_points = ?, count = ?
             WHERE user_id = ?`,
            [newPoints, newCount, user_id]
        );

        res.json({
            success: true,
            message: "Scratch successful.",
            points_added: pointsToAdd,
            total_points: newPoints,
            remaining_count: newCount
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

exports.useHypoPoints = async (req, res) => {

    try {

        const { session_token, points_used } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });

        }

        const pointsToUse = Number(points_used) || 0;

        if (pointsToUse <= 0) {

            return res.status(400).json({
                success: false,
                message: "Invalid points."
            });

        }

        const [rows] = await pool.query(
            `SELECT hypo_points FROM USER_REWARDS
             WHERE user_id = ?
             LIMIT 1`,
            [user_id]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Rewards not found."
            });

        }

        if (rows[0].hypo_points < pointsToUse) {

            return res.status(400).json({
                success: false,
                message: "Not enough points."
            });

        }

        await pool.query(
            `UPDATE USER_REWARDS
             SET hypo_points = hypo_points - ?,
                 used_hypo = used_hypo + ?
             WHERE user_id = ?`,
            [pointsToUse, pointsToUse, user_id]
        );

        res.json({
            success: true,
            message: "HYPO points used.",
            points_used: pointsToUse
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

/* ============================================
   SEND REDEEM REQUEST
   ============================================ */
exports.sendRedeemRequest = async (req, res) => {

    try {

        const { session_token, promo_code } = req.body;

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "SESSION EXPIRE"
            });
        }

        if (!promo_code) {
            return res.status(400).json({
                success: false,
                message: "Enter a promo code."
            });
        }

        const cleanCode = promo_code.trim().toUpperCase();

        /* Find promo code owner */
        const [[targetUser]] = await pool.query(
            `SELECT user_id
             FROM USER_REWARDS
             WHERE promo_code = ?
             LIMIT 1`,
            [cleanCode]
        );

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "SESSION EXPIRE"
            });
        }

        /* Own code check */
        if (targetUser.user_id === user_id) {
            return res.status(400).json({
                success: false,
                message: "You can not add your own promo code"
            });
        }

        /* Save my user_id in target's row */
        await pool.query(
            `UPDATE USER_REWARDS
             SET req_userid = ?
             WHERE user_id = ?`,
            [user_id, targetUser.user_id]
        );

        res.json({
            success: true,
            message: "Promo ID entered successfully. Waiting for response."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

exports.handleRedeemRequest = async (req, res) => {

    try {

        const { session_token, action } = req.body;
        /* action: "APPROVED" / "REJECTED" */

        const user_id = await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid session."
            });
        }

        /* Find my row — jisme req_userid set hai */
        const [[myRow]] = await pool.query(
            `SELECT user_id, req_userid
             FROM USER_REWARDS
             WHERE user_id = ?
             AND req_userid IS NOT NULL
             AND req_userid > 0
             LIMIT 1`,
            [user_id]
        );

        if (!myRow) {
            return res.status(404).json({
                success: false,
                message: "No pending request."
            });
        }

        const requesterId = myRow.req_userid;

        /* ============================================
           APPROVED
           ============================================ */
        if (action === "APPROVED") {

            /* My row — redeemed = 1, req_userid REHNE DETA */
            await pool.query(
                `UPDATE USER_REWARDS
                 SET redeemed = 1
                 WHERE user_id = ?`,
                [user_id]
            );

            /* Requester (User A) — 10 points */
            await pool.query(
                `UPDATE USER_REWARDS
                 SET hypo_points = hypo_points + 10
                 WHERE user_id = ?`,
                [requesterId]
            );

            /* Owner (User B) — 40 points */
            await pool.query(
                `UPDATE USER_REWARDS
                 SET hypo_points = hypo_points + 40
                 WHERE user_id = ?`,
                [user_id]
            );

            return res.json({
                success: true,
                message: "Referral code successfully redeemed. You got 40 HYPO points."
            });

        }

        /* ============================================
           REJECTED
           ============================================ */
        if (action === "REJECTED") {

            await pool.query(
                `UPDATE USER_REWARDS
                 SET req_userid = 0
                 WHERE user_id = ?`,
                [user_id]
            );

            return res.json({
                success: true,
                message: "Request rejected."
            });

        }

        return res.status(400).json({
            success: false,
            message: "Invalid action."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};