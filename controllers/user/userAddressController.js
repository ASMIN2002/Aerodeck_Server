const db = require("../../config/db");

const getAddresses = async (req, res) => {

    try {

        const { user_id } = req.params;

        const [rows] = await db.query(

            `SELECT *
             FROM User_Address_Aerodeck
             WHERE user_id = ?
             ORDER BY address_id ASC`,

            [user_id]

        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

const addAddress = async (req, res) => {

    try {

        const {
            user_id,
            full_name,
            mobile_number,
            house_flat,
            area_street,
            landmark,
            pincode,
            city,
            state,
            latitude,
            longitude,
            address_type
        } = req.body;

        // Maximum 4 addresses check
        const [count] = await db.query(

            `SELECT COUNT(*) AS total
             FROM User_Address_Aerodeck
             WHERE user_id = ?`,

            [user_id]

        );

        if (count[0].total >= 4) {

            return res.status(400).json({
                success: false,
                message: "Maximum 4 addresses allowed."
            });

        }

        // First address becomes primary
        const is_primary = count[0].total === 0 ? 1 : 0;

        await db.query(

            `INSERT INTO User_Address_Aerodeck
            (
                user_id,
                full_name,
                mobile_number,
                house_flat,
                area_street,
                landmark,
                pincode,
                city,
                state,
                latitude,
                longitude,
                address_type,
                is_primary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                user_id,
                full_name,
                mobile_number,
                house_flat,
                area_street,
                landmark,
                pincode,
                city,
                state,
                latitude,
                longitude,
                address_type,
                is_primary
            ]

        );

        res.json({
            success: true,
            message: "Address added successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

const updateAddress = async (req, res) => {

    try {

        const { address_id } = req.params;

        const {
            user_id,
            full_name,
            mobile_number,
            house_flat,
            area_street,
            landmark,
            pincode,
            city,
            state,
            latitude,
            longitude,
            address_type
        } = req.body;

        const [result] = await db.query(

            `UPDATE User_Address_Aerodeck
             SET
                full_name = ?,
                mobile_number = ?,
                house_flat = ?,
                area_street = ?,
                landmark = ?,
                pincode = ?,
                city = ?,
                state = ?,
                latitude = ?,
                longitude = ?,
                address_type = ?
             WHERE address_id = ?
             AND user_id = ?`,

            [
                full_name,
                mobile_number,
                house_flat,
                area_street,
                landmark,
                pincode,
                city,
                state,
                latitude,
                longitude,
                address_type,
                address_id,
                user_id
            ]

        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Address not found."
            });

        }

        res.json({
            success: true,
            message: "Address updated successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

const deleteAddress = async (req, res) => {

    try {

        const { address_id } = req.params;
        const { user_id } = req.body;

        // Check address
        const [rows] = await db.query(

            `SELECT is_primary
             FROM User_Address_Aerodeck
             WHERE address_id = ?
             AND user_id = ?`,

            [address_id, user_id]

        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Address not found."
            });

        }

        const wasPrimary = rows[0].is_primary;

        // Delete address
        await db.query(

            `DELETE FROM User_Address_Aerodeck
             WHERE address_id = ?
             AND user_id = ?`,

            [address_id, user_id]

        );

        // If deleted address was primary,
        // make another address primary
        if (wasPrimary) {

            const [remaining] = await db.query(

                `SELECT address_id
                 FROM User_Address_Aerodeck
                 WHERE user_id = ?
                 ORDER BY address_id ASC
                 LIMIT 1`,

                [user_id]

            );

            if (remaining.length > 0) {

                await db.query(

                    `UPDATE User_Address_Aerodeck
                     SET is_primary = 1
                     WHERE address_id = ?`,

                    [remaining[0].address_id]

                );

            }

        }

        res.json({
            success: true,
            message: "Address deleted successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

const setPrimaryAddress = async (req, res) => {

    try {

        const { address_id } = req.params;
        const { user_id } = req.body;

        // Sab addresses ko non-primary banao
        await db.query(

            `UPDATE User_Address_Aerodeck
             SET is_primary = 0
             WHERE user_id = ?`,

            [user_id]

        );

        // Selected address ko primary banao
        await db.query(

            `UPDATE User_Address_Aerodeck
             SET is_primary = 1
             WHERE address_id = ?
             AND user_id = ?`,

            [address_id, user_id]

        );

        res.json({
            success: true,
            message: "Primary address updated successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

const getPincodeDetails = async (req, res) => {

    try {

        const { pincode } = req.params;

        if (!/^\d{6}$/.test(pincode)) {

            return res.status(400).json({
                success: false,
                message: "Invalid PIN Code."
            });

        }

        const response = await fetch(
            `https://api.postalpincode.in/pincode/${pincode}`
        );

        const data = await response.json();

        if (
            !data ||
            data[0].Status !== "Success" ||
            !data[0].PostOffice
        ) {

            return res.json({
                success: false,
                message: "PIN Code not found."
            });

        }

        const firstOffice = data[0].PostOffice[0];

        return res.json({

            success: true,

            location: {

                pincode,
                area: firstOffice.Name,
                post_office: firstOffice.Name,
                district: firstOffice.District,
                city: firstOffice.District,
                state: firstOffice.State,
                country: firstOffice.Country,
            },

            areas: data[0].PostOffice.map(item => item.Name)

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

module.exports = {
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setPrimaryAddress,
    getPincodeDetails
};