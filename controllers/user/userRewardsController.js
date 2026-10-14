const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const REQUEST_EXPIRE_HOURS = 24;
const REQUESTER_POINTS = 10;
const OWNER_POINTS = 40;

async function authenticate(session_token) {
    if (!session_token) return null;
    return await getUserIdFromSession(session_token);
}

function unauthorized(res, message = "Invalid or expired session.") {
    return res.status(401).json({ success: false, message });
}

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

async function getRewardByUserId(user_id, fields = "*") {
    const [rows] = await pool.query(
        `SELECT ${fields} FROM user_rewards_heepit WHERE user_id = ? LIMIT 1`,
        [user_id]
    );
    return rows[0] || null;
}

async function getUserEmail(user_id) {
    const [[row]] = await pool.query(
        `SELECT email FROM users_heepit WHERE user_id = ? LIMIT 1`,
        [user_id]
    );
    return row?.email || "";
}

exports.getUserRewards = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);
        if (!user_id) return unauthorized(res);

        await pool.query(
            `UPDATE user_rewards_heepit
             SET req_userid = 0
             WHERE user_id = ?
               AND req_userid > 0
               AND redeemed = 0
               AND TIMESTAMPDIFF(HOUR, updated_at, NOW()) >= ?`,
            [user_id, REQUEST_EXPIRE_HOURS]
        );

        const myReward = await getRewardByUserId(
            user_id,
            `id, user_id, hypo_points, redeemed, promo_code, count,
             used_hypo, req_userid, updated_at`
        );

        let requesterEmail = "";

        if (myReward?.req_userid > 0) {
            requesterEmail = await getUserEmail(myReward.req_userid);
        }

        const [[usedRow]] = await pool.query(
            `SELECT user_id, updated_at, redeemed
             FROM user_rewards_heepit
             WHERE req_userid = ?
             LIMIT 1`,
            [user_id]
        );

        let usedOwnerEmail = "";
        let usedOwnerId = 0;
        let usedUpdatedAt = null;
        let usedRedeemed = 0;

        if (usedRow) {
            usedOwnerId = usedRow.user_id;
            usedUpdatedAt = usedRow.updated_at;
            usedRedeemed = usedRow.redeemed;
            usedOwnerEmail = await getUserEmail(usedOwnerId);
        }

        return res.json({
            success: true,
            data: myReward
                ? {
                    ...myReward,
                    requester_email: requesterEmail,
                    used_owner_id: usedOwnerId,
                    used_owner_email: usedOwnerEmail,
                    used_updated_at: usedUpdatedAt,
                    used_redeemed: usedRedeemed,
                }
                : null,
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.updateUserRewards = async (req, res) => {
    try {
        const { session_token, hypo_points, redeemed } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const [existing] = await pool.query(
            `SELECT id FROM user_rewards_heepit WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (existing.length > 0) {
            await pool.query(
                `UPDATE user_rewards_heepit SET hypo_points = ?, redeemed = ? WHERE user_id = ?`,
                [hypo_points, redeemed, user_id]
            );
        } else {
            await pool.query(
                `INSERT INTO user_rewards_heepit (user_id, hypo_points, redeemed) VALUES (?, ?, ?)`,
                [user_id, hypo_points, redeemed]
            );
        }

        return res.json({ success: true, message: "Rewards updated successfully." });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.scratchReward = async (req, res) => {
    try {
        const { session_token, number } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const reward = await getRewardByUserId(user_id, `id, hypo_points, count`);

        if (!reward)
            return res.status(404).json({ success: false, message: "Rewards not found." });

        if (reward.count <= 0)
            return res.status(400).json({ success: false, message: "No chances left." });

        const pointsToAdd = Number(number) || 0;
        const newPoints = reward.hypo_points + pointsToAdd;
        const newCount = reward.count - 1;

        await pool.query(
            `UPDATE user_rewards_heepit SET hypo_points = ?, count = ? WHERE user_id = ?`,
            [newPoints, newCount, user_id]
        );

        return res.json({
            success: true,
            message: "Scratch successful.",
            points_added: pointsToAdd,
            total_points: newPoints,
            remaining_count: newCount,
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.useHypoPoints = async (req, res) => {
    try {
        const { session_token, points_used } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const pointsToUse = Number(points_used) || 0;

        if (pointsToUse <= 0)
            return res.status(400).json({ success: false, message: "Invalid points." });

        const reward = await getRewardByUserId(user_id, "hypo_points");

        if (!reward)
            return res.status(404).json({ success: false, message: "Rewards not found." });

        if (reward.hypo_points < pointsToUse)
            return res.status(400).json({ success: false, message: "Not enough points." });

        await pool.query(
            `UPDATE user_rewards_heepit
             SET hypo_points = hypo_points - ?, used_hypo = used_hypo + ?
             WHERE user_id = ?`,
            [pointsToUse, pointsToUse, user_id]
        );

        return res.json({
            success: true,
            message: "HYPO points used.",
            points_used: pointsToUse,
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.sendRedeemRequest = async (req, res) => {
    try {
        const { session_token, promo_code } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id)
            return unauthorized(res, "Session expired. Please login again.");

        if (!promo_code)
            return res.status(200).json({ success: false, message: "Enter a promo code." });

        const cleanCode = promo_code.trim().toUpperCase();

        const [[targetUser]] = await pool.query(
            `SELECT user_id FROM user_rewards_heepit WHERE promo_code = ? LIMIT 1`,
            [cleanCode]
        );

        if (!targetUser)
            return res.status(200).json({ success: false, message: "Invalid or unavailable promo code." });

        if (targetUser.user_id === user_id)
            return res.status(200).json({ success: false, message: "You can not add your own promo code." });

        await pool.query(
            `UPDATE user_rewards_heepit SET req_userid = ?, updated_at = NOW() WHERE user_id = ?`,
            [user_id, targetUser.user_id]
        );

        return res.json({
            success: true,
            message: "Promo ID entered successfully. Waiting for response.",
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.handleRedeemRequest = async (req, res) => {
    try {
        const { session_token, action } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res, "Invalid session.");

        const [[myRow]] = await pool.query(
            `SELECT user_id, req_userid
             FROM user_rewards_heepit
             WHERE user_id = ? AND req_userid IS NOT NULL AND req_userid > 0
             LIMIT 1`,
            [user_id]
        );

        if (!myRow)
            return res.status(404).json({ success: false, message: "No pending request." });

        const requesterId = myRow.req_userid;

        if (action === "APPROVED") {
            await Promise.all([
                pool.query(
                    `UPDATE user_rewards_heepit SET redeemed = 1 WHERE user_id = ?`,
                    [user_id]
                ),
                pool.query(
                    `UPDATE user_rewards_heepit SET hypo_points = hypo_points + ? WHERE user_id = ?`,
                    [REQUESTER_POINTS, requesterId]
                ),
                pool.query(
                    `UPDATE user_rewards_heepit SET hypo_points = hypo_points + ? WHERE user_id = ?`,
                    [OWNER_POINTS, user_id]
                ),
            ]);

            return res.json({
                success: true,
                message: `Referral code successfully redeemed. You got ${OWNER_POINTS} HYPO points.`,
            });
        }

        if (action === "REJECTED") {
            await pool.query(
                `UPDATE user_rewards_heepit SET req_userid = 0 WHERE user_id = ?`,
                [user_id]
            );

            return res.json({ success: true, message: "Request rejected." });
        }

        return res.status(400).json({ success: false, message: "Invalid action." });
    } catch (err) {
        return serverError(res, err);
    }
};