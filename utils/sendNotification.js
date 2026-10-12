async function sendNotificationToUser(user_id, title, body, data = {}, image = "") {
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
                body,
                ...(image && { image })
            },
            data: data,
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    ...(image && { imageUrl: image })
                }
            }
        };

        const response = await getMessaging().send(message);
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