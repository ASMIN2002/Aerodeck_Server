const pool = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const REQUEST_EXPIRE_HOURS = 24;
const REQUESTER_POINTS = 10;
const OWNER_POINTS = 40;

const REWARD_FIELDS = `
    id, user_id, hypo_points, redeemed, promo_code, count,
    used_hypo, req_userid, updated_at
`;

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

async function getRewardByUserId(conn, user_id, fields = REWARD_FIELDS) {
    const [rows] = await conn.query(
        `SELECT ${fields} FROM user_rewards_heepit WHERE user_id = ? LIMIT 1`,
        [user_id]
    );
    return rows[0] || null;
}

async function getUserEmail(conn, user_id) {
    const [rows] = await conn.query(
        `SELECT email FROM users_heepit WHERE user_id = ? LIMIT 1`,
        [user_id]
    );
    return rows[0]?.email || "";
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

        const myReward = await getRewardByUserId(pool, user_id);

        let requesterEmail = "";
        let usedOwnerEmail = "";
        let usedOwnerId = 0;
        let usedUpdatedAt = null;
        let usedRedeemed = 0;

        if (myReward?.req_userid > 0) {
            requesterEmail = await getUserEmail(pool, myReward.req_userid);
        }

        const [usedRows] = await pool.query(
            `SELECT user_id, updated_at, redeemed
             FROM user_rewards_heepit
             WHERE req_userid = ?
             LIMIT 1`,
            [user_id]
        );

        if (usedRows.length) {
            usedOwnerId = usedRows[0].user_id;
            usedUpdatedAt = usedRows[0].updated_at;
            usedRedeemed = usedRows[0].redeemed;
            usedOwnerEmail = await getUserEmail(pool, usedOwnerId);
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
    const conn = await pool.getConnection();
    try {
        const { session_token, hypo_points, redeemed } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        const points = Number(hypo_points);
        if (isNaN(points) || points < 0) {
            conn.release();
            return res.status(400).json({ success: false, message: "Invalid hypo_points." });
        }

        await conn.beginTransaction();
        try {
            const [existing] = await conn.query(
                `SELECT id FROM user_rewards_heepit WHERE user_id = ? LIMIT 1`,
                [user_id]
            );

            if (existing.length > 0) {
                await conn.query(
                    `UPDATE user_rewards_heepit SET hypo_points = ?, redeemed = ? WHERE user_id = ?`,
                    [points, redeemed ? 1 : 0, user_id]
                );
            } else {
                await conn.query(
                    `INSERT INTO user_rewards_heepit (user_id, hypo_points, redeemed) VALUES (?, ?, ?)`,
                    [user_id, points, redeemed ? 1 : 0]
                );
            }

            await conn.commit();
            conn.release();
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }

        return res.json({ success: true, message: "Rewards updated successfully." });
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};

exports.scratchReward = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { session_token, number } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        const pointsToAdd = Number(number) || 0;
        if (pointsToAdd < 0) {
            conn.release();
            return res.status(400).json({ success: false, message: "Invalid points." });
        }

        await conn.beginTransaction();
        try {
            const [rows] = await conn.query(
                `SELECT id, hypo_points, count FROM user_rewards_heepit
                 WHERE user_id = ? LIMIT 1 FOR UPDATE`,
                [user_id]
            );

            if (!rows.length) {
                await conn.rollback();
                conn.release();
                return res.status(404).json({ success: false, message: "Rewards not found." });
            }

            const reward = rows[0];

            if (reward.count <= 0) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ success: false, message: "No chances left." });
            }

            const newPoints = reward.hypo_points + pointsToAdd;
            const newCount = reward.count - 1;

            await conn.query(
                `UPDATE user_rewards_heepit SET hypo_points = ?, count = ? WHERE user_id = ?`,
                [newPoints, newCount, user_id]
            );

            await conn.commit();
            conn.release();

            return res.json({
                success: true,
                message: "Scratch successful.",
                points_added: pointsToAdd,
                total_points: newPoints,
                remaining_count: newCount,
            });
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};

exports.useHypoPoints = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { session_token, points_used } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        const pointsToUse = Number(points_used) || 0;
        if (pointsToUse <= 0) {
            conn.release();
            return res.status(400).json({ success: false, message: "Invalid points." });
        }

        await conn.beginTransaction();
        try {
            const [result] = await conn.query(
                `UPDATE user_rewards_heepit
                 SET hypo_points = hypo_points - ?, used_hypo = used_hypo + ?
                 WHERE user_id = ? AND hypo_points >= ?`,
                [pointsToUse, pointsToUse, user_id, pointsToUse]
            );

            if (result.affectedRows === 0) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ success: false, message: "Not enough points." });
            }

            await conn.commit();
            conn.release();

            return res.json({
                success: true,
                message: "HYPO points used.",
                points_used: pointsToUse,
            });
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};

exports.sendRedeemRequest = async (req, res) => {
    try {
        const { session_token, promo_code } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res, "Session expired. Please login again.");

        if (!promo_code || !String(promo_code).trim())
            return res.status(200).json({ success: false, message: "Enter a promo code." });

        const cleanCode = String(promo_code).trim().toUpperCase();

        const [targetRows] = await pool.query(
            `SELECT user_id, req_userid FROM user_rewards_heepit
             WHERE promo_code = ? LIMIT 1`,
            [cleanCode]
        );

        if (!targetRows.length)
            return res.status(200).json({ success: false, message: "Invalid or unavailable promo code." });

        const targetUser = targetRows[0];

        if (String(targetUser.user_id) === String(user_id))
            return res.status(200).json({ success: false, message: "You can not add your own promo code." });

        if (Number(targetUser.req_userid) > 0)
            return res.status(200).json({ success: false, message: "Promo code already has a pending request." });

        const [result] = await pool.query(
            `UPDATE user_rewards_heepit
             SET req_userid = ?, updated_at = NOW()
             WHERE user_id = ? AND (req_userid IS NULL OR req_userid = 0)`,
            [user_id, targetUser.user_id]
        );

        if (result.affectedRows === 0)
            return res.status(200).json({ success: false, message: "Promo code already has a pending request." });

        return res.json({
            success: true,
            message: "Promo ID entered successfully. Waiting for response.",
        });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.handleRedeemRequest = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { session_token, action } = req.body;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res, "Invalid session.");
        }

        if (!["APPROVED", "REJECTED"].includes(action)) {
            conn.release();
            return res.status(400).json({ success: false, message: "Invalid action." });
        }

        await conn.beginTransaction();
        try {
            const [rows] = await conn.query(
                `SELECT user_id, req_userid FROM user_rewards_heepit
                 WHERE user_id = ? AND req_userid IS NOT NULL AND req_userid > 0
                 LIMIT 1 FOR UPDATE`,
                [user_id]
            );

            if (!rows.length) {
                await conn.rollback();
                conn.release();
                return res.status(404).json({ success: false, message: "No pending request." });
            }

            const requesterId = rows[0].req_userid;

            if (action === "APPROVED") {
                const [requesterRows] = await conn.query(
                    `SELECT user_id FROM user_rewards_heepit WHERE user_id = ? LIMIT 1`,
                    [requesterId]
                );

                if (!requesterRows.length) {
                    await conn.rollback();
                    conn.release();
                    return res.status(404).json({ success: false, message: "Requester account not found." });
                }

                await conn.query(
                    `UPDATE user_rewards_heepit SET redeemed = 1, req_userid = 0 WHERE user_id = ?`,
                    [user_id]
                );

                await conn.query(
                    `UPDATE user_rewards_heepit SET hypo_points = hypo_points + ? WHERE user_id = ?`,
                    [REQUESTER_POINTS, requesterId]
                );

                await conn.query(
                    `UPDATE user_rewards_heepit SET hypo_points = hypo_points + ? WHERE user_id = ?`,
                    [OWNER_POINTS, user_id]
                );

                await conn.commit();
                conn.release();

                return res.json({
                    success: true,
                    message: `Referral code successfully redeemed. You got ${OWNER_POINTS} HYPO points.`,
                });
            }

            await conn.query(
                `UPDATE user_rewards_heepit SET req_userid = 0 WHERE user_id = ?`,
                [user_id]
            );

            await conn.commit();
            conn.release();

            return res.json({ success: true, message: "Request rejected." });
        } catch (txErr) {
            await conn.rollback();
            conn.release();
            throw txErr;
        }
    } catch (err) {
        try { conn.release(); } catch { }
        return serverError(res, err);
    }
};