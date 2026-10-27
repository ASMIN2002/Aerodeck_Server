const db = require("../../config/db");
const getUserIdFromSession = require("../../middleware/getUserIdFromSession");

const MAX_ADDRESSES = 4;
const SERVICEABLE_DISTRICTS = ["balasore", "baleshwar", "baleswar"];
const PINCODE_CACHE = new Map();
const PINCODE_CACHE_TTL = 1000 * 60 * 60;

async function authenticate(session_token) {
    if (!session_token) return null;
    return await getUserIdFromSession(session_token);
}

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function unauthorized(res) {
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
}

function extractAddressFields(body) {
    return {
        full_name: body.full_name,
        mobile_number: body.mobile_number,
        house_flat: body.house_flat,
        area_street: body.area_street,
        landmark: body.landmark,
        pincode: body.pincode,
        city: body.city,
        state: body.state,
        latitude: body.latitude,
        longitude: body.longitude,
        address_type: body.address_type,
    };
}

function validateAddress(fields) {
    const errors = [];
    if (!fields.full_name || !String(fields.full_name).trim()) errors.push("full_name required");
    if (!fields.mobile_number || !/^\d{10}$/.test(String(fields.mobile_number))) errors.push("mobile_number must be 10 digits");
    if (!fields.house_flat || !String(fields.house_flat).trim()) errors.push("house_flat required");
    if (!fields.area_street || !String(fields.area_street).trim()) errors.push("area_street required");
    if (!fields.pincode || !/^\d{6}$/.test(String(fields.pincode))) errors.push("pincode must be 6 digits");
    if (!fields.city || !String(fields.city).trim()) errors.push("city required");
    if (!fields.state || !String(fields.state).trim()) errors.push("state required");
    return errors;
}

exports.getAddresses = async (req, res) => {
    try {
        const user_id = await authenticate(req.query.session_token);
        if (!user_id) return unauthorized(res);

        const [rows] = await db.query(
            `SELECT address_id, full_name, mobile_number, house_flat, area_street,
                    landmark, pincode, city, state, latitude, longitude,
                    address_type, is_primary
             FROM user_address_heepit
             WHERE user_id = ?
             ORDER BY is_primary DESC, address_id ASC`,
            [user_id]
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.addAddress = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { session_token } = req.body;
        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        const fields = extractAddressFields(req.body);
        const errors = validateAddress(fields);
        if (errors.length > 0) {
            conn.release();
            return res.status(400).json({ success: false, message: errors.join(", ") });
        }

        await conn.beginTransaction();
        try {
            const [count] = await conn.query(
                `SELECT COUNT(*) AS total FROM user_address_heepit WHERE user_id = ? FOR UPDATE`,
                [user_id]
            );

            if (count[0].total >= MAX_ADDRESSES) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({
                    success: false,
                    message: `Maximum ${MAX_ADDRESSES} addresses allowed.`,
                });
            }

            const is_primary = count[0].total === 0 ? 1 : 0;

            await conn.query(
                `INSERT INTO user_address_heepit
                 (user_id, full_name, mobile_number, house_flat, area_street, landmark,
                  pincode, city, state, latitude, longitude, address_type, is_primary)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user_id,
                    fields.full_name,
                    fields.mobile_number,
                    fields.house_flat,
                    fields.area_street,
                    fields.landmark || null,
                    fields.pincode,
                    fields.city,
                    fields.state,
                    fields.latitude || null,
                    fields.longitude || null,
                    fields.address_type || "Home",
                    is_primary,
                ]
            );

            await conn.commit();
            conn.release();
            return res.json({ success: true, message: "Address added successfully." });
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

exports.updateAddress = async (req, res) => {
    try {
        const { address_id } = req.params;
        const session_token = req.body.session_token || req.query.session_token;

        const user_id = await authenticate(session_token);
        if (!user_id) return unauthorized(res);

        const fields = extractAddressFields(req.body);
        const errors = validateAddress(fields);
        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: errors.join(", ") });
        }

        const [result] = await db.query(
            `UPDATE user_address_heepit
             SET full_name = ?, mobile_number = ?, house_flat = ?, area_street = ?,
                 landmark = ?, pincode = ?, city = ?, state = ?,
                 latitude = ?, longitude = ?, address_type = ?
             WHERE address_id = ? AND user_id = ?`,
            [
                fields.full_name,
                fields.mobile_number,
                fields.house_flat,
                fields.area_street,
                fields.landmark || null,
                fields.pincode,
                fields.city,
                fields.state,
                fields.latitude || null,
                fields.longitude || null,
                fields.address_type || "Home",
                address_id,
                user_id,
            ]
        );

        if (result.affectedRows === 0)
            return res.status(404).json({ success: false, message: "Address not found." });

        return res.json({ success: true, message: "Address updated successfully." });
    } catch (err) {
        return serverError(res, err);
    }
};

exports.deleteAddress = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { address_id } = req.params;
        const session_token = req.body.session_token || req.query.session_token;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        const [rows] = await conn.query(
            `SELECT is_primary FROM user_address_heepit
             WHERE address_id = ? AND user_id = ? LIMIT 1`,
            [address_id, user_id]
        );

        if (rows.length === 0) {
            conn.release();
            return res.status(404).json({ success: false, message: "Address not found." });
        }

        const wasPrimary = rows[0].is_primary;

        await conn.beginTransaction();
        try {
            await conn.query(
                `DELETE FROM user_address_heepit WHERE address_id = ? AND user_id = ?`,
                [address_id, user_id]
            );

            if (wasPrimary) {
                const [remaining] = await conn.query(
                    `SELECT address_id FROM user_address_heepit
                     WHERE user_id = ? ORDER BY address_id ASC LIMIT 1`,
                    [user_id]
                );

                if (remaining.length > 0) {
                    await conn.query(
                        `UPDATE user_address_heepit SET is_primary = 1 WHERE address_id = ?`,
                        [remaining[0].address_id]
                    );
                }
            }

            await conn.commit();
            conn.release();
            return res.json({ success: true, message: "Address deleted successfully." });
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

exports.setPrimaryAddress = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { address_id } = req.params;
        const session_token = req.body.session_token || req.query.session_token;

        const user_id = await authenticate(session_token);
        if (!user_id) {
            conn.release();
            return unauthorized(res);
        }

        const [exists] = await conn.query(
            `SELECT address_id FROM user_address_heepit
             WHERE address_id = ? AND user_id = ? LIMIT 1`,
            [address_id, user_id]
        );

        if (exists.length === 0) {
            conn.release();
            return res.status(404).json({ success: false, message: "Address not found." });
        }

        await conn.beginTransaction();
        try {
            await conn.query(
                `UPDATE user_address_heepit
                 SET is_primary = CASE WHEN address_id = ? THEN 1 ELSE 0 END
                 WHERE user_id = ?`,
                [address_id, user_id]
            );

            await conn.commit();
            conn.release();
            return res.json({ success: true, message: "Primary address updated successfully." });
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

exports.getPincodeDetails = async (req, res) => {
    try {
        const { pincode } = req.params;

        if (!/^\d{6}$/.test(pincode))
            return res.status(400).json({ success: false, message: "Invalid PIN Code." });

        const cacheKey = `pincode_${pincode}`;
        const cached = PINCODE_CACHE.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < PINCODE_CACHE_TTL) {
            return res.json(cached.data);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        let data;
        try {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
                signal: controller.signal,
            });
            data = await response.json();
        } finally {
            clearTimeout(timeout);
        }

        if (!data || data[0].Status !== "Success" || !data[0].PostOffice) {
            return res.json({ success: false, message: "PIN Code not found." });
        }

        const firstOffice = data[0].PostOffice[0];
        const district = firstOffice.District?.toLowerCase().trim();

        if (!SERVICEABLE_DISTRICTS.includes(district)) {
            return res.json({
                success: false,
                delivery_available: false,
                district_received: firstOffice.District,
                pincode_received: pincode,
                message: "Delivery only available inside Balasore.",
            });
        }

        const responseData = {
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
            areas: data[0].PostOffice.map((item) => item.Name),
        };

        PINCODE_CACHE.set(cacheKey, { data: responseData, timestamp: Date.now() });
        return res.json(responseData);
    } catch (err) {
        return serverError(res, err);
    }
};

exports.getPrimaryAddressByUserId = async (req, res) => {
    try {
        const { user_id } = req.params;
        const session_token = req.query.session_token;

        if (!user_id)
            return res.status(400).json({ success: false, message: "user_id required." });

        if (session_token) {
            const authUserId = await authenticate(session_token);
            if (!authUserId || String(authUserId) !== String(user_id)) {
                return unauthorized(res);
            }
        }

        const [rows] = await db.query(
            `SELECT address_id, full_name, mobile_number, house_flat, area_street,
                    landmark, pincode, city, state, latitude, longitude,
                    address_type, is_primary
             FROM user_address_heepit
             WHERE user_id = ? AND is_primary = 1 LIMIT 1`,
            [user_id]
        );

        if (rows.length === 0)
            return res.status(404).json({ success: false, message: "Primary address not found." });

        return res.json({ success: true, data: rows[0] });
    } catch (err) {
        return serverError(res, err);
    }
};