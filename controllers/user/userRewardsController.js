const pool = require("../../config/db");

const getUserIdFromSession =
    require("../../middleware/getUserIdFromSession");

// =====================================================
// CHECK & UPDATE USER REWARD
// =====================================================

exports.checkUserRewards = async (req, res) => {

    try {

        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: "user_id is required."
            });
        }


        // =================================================
        // FIND ONE QUALIFYING ORDER
        //
        // Same order_id = only ONE point
        // At least one item must be ₹1000+
        // Return date must be expired
        // No return
        // No cancel
        // =================================================

        const [orders] = await pool.query(
            `
            SELECT DISTINCT
                o.order_id

            FROM Orders_Aerodeck o

            INNER JOIN Order_Items_Aerodeck oi
                ON oi.order_id = o.order_id

            WHERE o.user_id = ?

            AND oi.total_price >= 1000

            AND oi.order_status = 'DELIVERED'

            AND oi.return_date IS NOT NULL

            AND oi.return_date < NOW()

            AND NOT EXISTS (
                SELECT 1
                FROM Return_Aerodeck r
                WHERE r.user_id = o.user_id
                AND r.order_id = o.order_id
                AND r.order_item_id = oi.order_item_id
            )

            AND NOT EXISTS (
                SELECT 1
                FROM Cancel_Aerodeck c
                WHERE c.user_id = o.user_id
                AND c.order_item_id = oi.order_item_id
            )

            ORDER BY o.order_id ASC

            LIMIT 1
            `,
            [user_id]
        );


        // =================================================
        // NO ELIGIBLE ORDER
        // =================================================

        if (!orders.length) {

            return res.json({
                success: true,
                eligible: false,
                message: "No eligible reward order found."
            });

        }


        const order_id = orders[0].order_id;


        // =================================================
        // GET USER REWARD
        // =================================================

        const [rewardRows] = await pool.query(
            `
            SELECT
                reward_id,
                user_id,
                points,
                reward_status,
                order_id

            FROM User_Rewards

            WHERE user_id = ?

            LIMIT 1
            `,
            [user_id]
        );


        // =================================================
        // FIRST REWARD
        // =================================================

        if (!rewardRows.length) {

            await pool.query(
                `
                INSERT INTO User_Rewards
                (
                    user_id,
                    points,
                    reward_status,
                    order_id
                )

                VALUES (?, 1, 1, ?)
                `,
                [
                    user_id,
                    order_id
                ]
            );


        }

        // =================================================
        // SAME ORDER ALREADY PROCESSED
        // =================================================

        else if (
            String(rewardRows[0].order_id) ===
            String(order_id)
        ) {

            return res.json({
                success: true,
                eligible: false,
                already_processed: true,
                message: "This order reward has already been processed.",
                reward: rewardRows[0]
            });

        }

        // =================================================
        // NEW QUALIFYING ORDER
        // =================================================

        else {

            await pool.query(
                `
                UPDATE User_Rewards

                SET
                    points = points + 1,
                    reward_status = 1,
                    order_id = ?

                WHERE user_id = ?

                LIMIT 1
                `,
                [
                    order_id,
                    user_id
                ]
            );

        }


        // =================================================
        // GET UPDATED REWARD
        // =================================================

        const [updatedReward] = await pool.query(
            `
            SELECT
                reward_id,
                user_id,
                points,
                reward_status,
                order_id

            FROM User_Rewards

            WHERE user_id = ?

            LIMIT 1
            `,
            [user_id]
        );


        return res.json({

            success: true,

            eligible: true,

            reward: updatedReward[0]

        });


    } catch (err) {

        console.error(
            "CHECK USER REWARDS ERROR:",
            err
        );

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};



// =====================================================
// GET USER REWARD
// =====================================================

exports.getUserRewards = async (req, res) => {

    try {

        const { session_token } = req.query;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                reward_id,
                user_id,
                points,
                reward_status,
                order_id
            FROM User_Rewards
            WHERE user_id = ?
            LIMIT 1
            `,
            [user_id]
        );

        if (!rows.length) {

            return res.json({
                success: true,
                has_reward: false,
                reward: null
            });

        }

        return res.json({
            success: true,
            has_reward: true,
            reward: rows[0]
        });

    } catch (err) {

        console.error(
            "GET USER REWARDS ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};
// =====================================================
// SPECIAL REWARD SPIN
// ONLY FOR ₹1000+ QUALIFYING REWARD
// =====================================================

exports.spinReward = async (req, res) => {

    try {

        const { session_token } = req.body;

        if (!session_token) {
            return res.status(401).json({
                success: false,
                message: "Session token is required."
            });
        }

        const user_id =
            await getUserIdFromSession(session_token);

        if (!user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session."
            });
        }

        // =================================================
        // GET USER REWARD
        // =================================================

        const [rows] = await pool.query(
            `
            SELECT
                reward_id,
                user_id,
                points,
                reward_status,
                order_id
            FROM User_Rewards
            WHERE user_id = ?
            LIMIT 1
            `,
            [user_id]
        );


        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Reward record not found."
            });
        }


        const reward = rows[0];


        // =================================================
        // SPECIAL SPIN ONLY
        // reward_status = 1
        // =================================================

        if (reward.reward_status !== 1) {

            return res.status(400).json({
                success: false,
                message: "Special reward spin is not available."
            });

        }

        const realRewards = [
            5,
            3,
            4,
            6
        ];

        const randomIndex =
            Math.floor(Math.random() * realRewards.length);

        const spinPoints =
            realRewards[randomIndex];

        await pool.query(
            `
            UPDATE User_Rewards
            SET
                points = points + ?,
                reward_status = NULL
            WHERE user_id = ?
            AND reward_status = 1
            LIMIT 1
            `,
            [
                spinPoints,
                user_id
            ]
        );


        // =================================================
        // GET UPDATED REWARD
        // =================================================

        const [updatedRows] = await pool.query(
            `
            SELECT
                reward_id,
                user_id,
                points,
                reward_status,
                order_id
            FROM User_Rewards
            WHERE user_id = ?
            LIMIT 1
            `,
            [user_id]
        );


        return res.json({

            success: true,

            message: "Special reward spin completed.",

            spin_points: spinPoints,

            reward: updatedRows[0]

        });


    } catch (err) {

        console.error(
            "SPECIAL REWARD SPIN ERROR:",
            err
        );

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};