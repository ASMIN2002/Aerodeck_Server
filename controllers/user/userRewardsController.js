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
    updated_at
FROM USER_REWARDS
WHERE user_id = ?
LIMIT 1`,
            [user_id]
        );

        res.json({
            success: true,
            data: rows[0] || null
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
   UPDATE / INSERT USER REWARDS
   ============================================ */
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
/* ============================================
   SCRATCH REWARD
   ============================================ */
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

/* ============================================
   USE HYPO POINTS — Order place pe
   ============================================ */
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