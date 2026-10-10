const pool = require("../../config/db");

exports.createInvoice = async (req, res) => {
    try {

        const { order_id, product_type } = req.body;

        if (!order_id || !product_type) {
            return res.status(400).json({
                success: false,
                message: "order_id and product_type required"
            });
        }

        /* 1. ORDER ITEM */
        const [[item]] = await pool.query(
            `SELECT * FROM Order_Items_Aerodeck
             WHERE order_id = ?
             AND product_type = ?
             LIMIT 1`,
            [order_id, product_type]
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Order item not found"
            });
        }

        /* 2. ORDER */
        const [[order]] = await pool.query(
            `SELECT * FROM Orders_Aerodeck
             WHERE order_id = ?
             LIMIT 1`,
            [order_id]
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        /* 3. ALREADY EXISTS? */
        const [[existing]] = await pool.query(
            `SELECT invoice_id, invoice_number, is_Generate
             FROM Invoice_Aerodeck
             WHERE order_id = ? AND product_id = ?
             LIMIT 1`,
            [order_id, item.product_id]
        );

        if (existing) {
            return res.json({
                success: true,
                message: "Invoice already exists.",
                invoice_id: existing.invoice_id,
                invoice_number: existing.invoice_number,
                is_generated:
                    existing.is_Generate === 1 ||
                    existing.is_Generate === true,
                already_exists: true
            });
        }

        /* 4. INVOICE NUMBER */
        const yearShort = String(new Date().getFullYear()).slice(-2);

        const [[lastInv]] = await pool.query(
            `SELECT invoice_number FROM Invoice_Aerodeck
             WHERE invoice_number LIKE ?
             ORDER BY invoice_id DESC
             LIMIT 1`,
            [`HEEPIT/${yearShort}/%`]
        );

        let nextCounter = 1;

        if (lastInv && lastInv.invoice_number) {
            const parts = lastInv.invoice_number.split("/");
            const lastCounter = parseInt(parts[2], 10);
            if (!isNaN(lastCounter)) {
                nextCounter = lastCounter + 1;
            }
        }

        const invoiceNumber = `HEEPIT/${yearShort}/${String(nextCounter).padStart(3, "0")}`;

        /* 5. PRODUCT + ADMIN */
        let productData = null;
        let adminId = 0;

        if (item.product_type === "CARD") {

            const [[p]] = await pool.query(
                `SELECT * FROM Products_Aerodeck
                 WHERE product_id = ?
                 LIMIT 1`,
                [item.product_id]
            );

            productData = p;

            if (p && p.posted_by) {
                const [[admin]] = await pool.query(
                    `SELECT id FROM heepitadmin
                     WHERE username = ?
                     LIMIT 1`,
                    [p.posted_by]
                );
                if (admin) adminId = admin.id;
            }

        } else if (item.product_type === "SHOP") {

            const [[p]] = await pool.query(
                `SELECT * FROM Shop_Aerodeck
                 WHERE shop_id = ?
                 LIMIT 1`,
                [item.product_id]
            );

            productData = p;

            if (p && p.posted_by) {
                const [[admin]] = await pool.query(
                    `SELECT id FROM heepitadmin
                     WHERE username = ?
                     LIMIT 1`,
                    [p.posted_by]
                );
                if (admin) adminId = admin.id;
            }

        }

        if (!productData) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        /* 6. USER */
        const [[user]] = await pool.query(
            `SELECT * FROM User_Aerodeck
             WHERE user_id = ?
             LIMIT 1`,
            [order.user_id]
        );

        /* ============================================
           7. TOTAL AMOUNT — CARD ke cases
           ============================================ */
        let finalTotalAmount = item.total_price || 0;

        if (item.product_type === "CARD") {

            if (order.payment_status === "PARTIAL") {
                /* advance ~ total */
                finalTotalAmount = `${order.advance_amount || 0} ~ ${item.total_price}`;
            } else if (order.payment_status === "PAID") {
                /* total ~ total (fully paid) */
                finalTotalAmount = `${item.total_price} ~ ${item.total_price}`;
            }
        }

        /* 8. INSERT INVOICE */
        const [result] = await pool.query(
            `INSERT INTO Invoice_Aerodeck
             (
                invoice_number,
                order_id,
                admin_id,
                order_number,
                user_id,
                product_id,
                product_name,
                quantity,
                unit_price,
                gst_percentage,
                gst_amount,
                total_amount,
                gstin_number,
                is_Generate,
                is_Saved
             )
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                invoiceNumber,
                item.order_id,
                adminId,
                order.order_number || String(order.order_id),
                order.user_id,
                item.product_id,
                item.product_name,
                item.quantity,
                item.unit_price || 0,
                0,
                0,
                finalTotalAmount,
                "",
                false,
                false
            ]
        );

        return res.json({
            success: true,
            message: "Invoice generated successfully.",
            invoice_id: result.insertId,
            invoice_number: invoiceNumber,
            is_generated: false,
            already_exists: false
        });

    } catch (err) {
        console.error("CREATE INVOICE ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
exports.getAllInvoices = async (req, res) => {
    try {

        const [rows] = await pool.query(
            `SELECT
                i.*,
                u.full_name AS customer_name,
                a.username AS admin_username
             FROM Invoice_Aerodeck i
             LEFT JOIN User_Aerodeck u
                ON i.user_id = u.user_id
             LEFT JOIN heepitadmin a
                ON i.admin_id = a.id
             ORDER BY i.invoice_id DESC`
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        console.error("GET ALL INVOICES ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.getInvoiceById = async (req, res) => {
    try {

        const { invoice_id } = req.params;

        const [[invoice]] = await pool.query(
            `SELECT
                i.*,

                u.full_name AS customer_name,
                u.email AS customer_email,
                u.mobile_number AS customer_mobile,
                u.whatsapp_number AS customer_whatsapp,

                a.username AS admin_username,
                a.name AS admin_name,

                o.created_at AS order_created_at,

                ad.full_name AS address_name,
                ad.mobile_number AS address_mobile,
                ad.house_flat,
                ad.area_street,
                ad.landmark,
                ad.city,
                ad.state,
                ad.pincode,
                ad.address_type

             FROM Invoice_Aerodeck i

             LEFT JOIN User_Aerodeck u
                ON i.user_id = u.user_id

             LEFT JOIN heepitadmin a
                ON i.admin_id = a.id

             LEFT JOIN Orders_Aerodeck o
                ON i.order_id = o.order_id

             LEFT JOIN User_Address_Aerodeck ad
                ON o.address_id = ad.address_id

             WHERE i.invoice_id = ?
             LIMIT 1`,
            [invoice_id]
        );

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found"
            });
        }

        return res.json({
            success: true,
            data: invoice
        });

    } catch (err) {

        console.error("GET INVOICE ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};
exports.markGenerated = async (req, res) => {
    try {

        const { invoice_id } = req.params;

        await pool.query(
            `UPDATE Invoice_Aerodeck
             SET is_Generate = TRUE
             WHERE invoice_id = ?`,
            [invoice_id]
        );

        return res.json({
            success: true,
            message: "Invoice marked as generated."
        });

    } catch (err) {

        console.error("MARK GENERATED ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

/* ============================================
   TOGGLE SAVED — is_Saved toggle
   ============================================ */
exports.toggleSaved = async (req, res) => {
    try {

        const { invoice_id } = req.params;

        const [[inv]] = await pool.query(
            `SELECT is_Saved FROM Invoice_Aerodeck
             WHERE invoice_id = ?
             LIMIT 1`,
            [invoice_id]
        );

        if (!inv) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found"
            });
        }

        const newVal = !inv.is_Saved;

        await pool.query(
            `UPDATE Invoice_Aerodeck
             SET is_Saved = ?
             WHERE invoice_id = ?`,
            [newVal, invoice_id]
        );

        return res.json({
            success: true,
            is_Saved: newVal,
            message: newVal
                ? "Saved in your profile"
                : "Unsaved from your profile"
        });

    } catch (err) {

        console.error("TOGGLE SAVED ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.getInvoicesByAdmin = async (req, res) => {
    try {

        const { admin_id } = req.params;

        if (!admin_id) {
            return res.status(400).json({
                success: false,
                message: "admin_id required"
            });
        }

        const [rows] = await pool.query(
            `SELECT
                i.*,

                u.full_name AS customer_name,
                u.email AS customer_email,
                u.mobile_number AS customer_mobile,
                u.whatsapp_number AS customer_whatsapp,

                a.username AS admin_username,
                a.name AS admin_name,

                o.created_at AS order_created_at,

                ad.mobile_number AS address_mobile,
                ad.house_flat,
                ad.area_street,
                ad.landmark,
                ad.city,
                ad.state,
                ad.pincode,
                ad.address_type

             FROM Invoice_Aerodeck i

             LEFT JOIN User_Aerodeck u
                ON i.user_id = u.user_id

             LEFT JOIN heepitadmin a
                ON i.admin_id = a.id

             LEFT JOIN Orders_Aerodeck o
                ON i.order_id = o.order_id

             LEFT JOIN User_Address_Aerodeck ad
                ON o.address_id = ad.address_id

             WHERE i.admin_id = ?
               AND i.is_Saved = 1

             ORDER BY i.invoice_id DESC`,
            [admin_id]
        );

        return res.json({
            success: true,
            data: rows
        });

    } catch (err) {

        console.error("GET INVOICES BY ADMIN ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};