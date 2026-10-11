const admin = require("../config/firebase");
const pool = require("../config/db");

/* ============================================
   SEND NOTIFICATION TO A SINGLE USER
   ============================================ */
async function sendNotificationToUser(user_id, title, body, data = {}) {
    try {
        const [[user]] = await pool.query(
            `SELECT fcm_token FROM User_Aerodeck WHERE user_id = ? LIMIT 1`,
            [user_id]
        );

        if (!user || !user.fcm_token) {
            console.log(`No FCM token for user ${user_id}`);
            return { success: false, message: "No token" };
        }

        const message = {
            token: user.fcm_token,
            notification: {
                title,
                body
            },
            data: data,
            android: {
                priority: "high",
                notification: {
                    sound: "default"
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log(`Notification sent to user ${user_id}:`, response);
        return { success: true, response };

    } catch (err) {
        console.error(`SEND NOTIFICATION ERROR (user ${user_id}):`, err);

        if (
            err.code === "messaging/invalid-registration-token" ||
            err.code === "messaging/registration-token-not-registered"
        ) {
            await pool.query(
                `UPDATE User_Aerodeck SET fcm_token = NULL WHERE user_id = ?`,
                [user_id]
            );
            console.log(`Removed invalid token for user ${user_id}`);
        }

        return { success: false, error: err.message };
    }
}

/* ============================================
   SEND NOTIFICATION TO ALL USERS
   ============================================ */
async function sendNotificationToAll(title, body, data = {}) {
    try {
        const [users] = await pool.query(
            `SELECT user_id, fcm_token FROM User_Aerodeck
             WHERE fcm_token IS NOT NULL`
        );

        if (users.length === 0) {
            console.log("No users with FCM tokens");
            return { success: false, message: "No tokens" };
        }

        const tokens = users.map((u) => u.fcm_token);

        const BATCH_SIZE = 500;
        let totalSuccess = 0;
        let totalFailure = 0;

        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const batch = tokens.slice(i, i + BATCH_SIZE);

            const message = {
                tokens: batch,
                notification: {
                    title,
                    body
                },
                data: data,
                android: {
                    priority: "high",
                    notification: {
                        sound: "default"
                    }
                }
            };

            const response = await admin.messaging().sendEachForMulticast(message);

            totalSuccess += response.successCount;
            totalFailure += response.failureCount;

            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const code = resp.error?.code;
                    if (
                        code === "messaging/invalid-registration-token" ||
                        code === "messaging/registration-token-not-registered"
                    ) {
                        invalidTokens.push(batch[idx]);
                    }
                }
            });

            if (invalidTokens.length > 0) {
                await pool.query(
                    `UPDATE User_Aerodeck
                     SET fcm_token = NULL
                     WHERE fcm_token IN (?)`,
                    [invalidTokens]
                );
            }
        }

        console.log(`Broadcast: ${totalSuccess} success, ${totalFailure} failed`);
        return { success: true, totalSuccess, totalFailure };

    } catch (err) {
        console.error("BROADCAST ERROR:", err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendNotificationToUser,
    sendNotificationToAll
};