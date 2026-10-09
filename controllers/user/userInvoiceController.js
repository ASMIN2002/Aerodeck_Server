const pool = require("../../config/db");

/* ============================================
   CREATE INVOICE — Generate Invoice click pe
   ============================================ */
exports.createInvoice = async (req, res) => {
    try {

        const { order_item_id, admin_id } = req.body;

        if (!order_item_id) {
            return res.status(400).json({
                success: false,
                message: "order_item_id required"
            });
        }

        /* 1. ORDER ITEM */
        const [[item]] = await pool.query(
            `SELECT * FROM Order_Items_Aerodeck
             WHERE order_item_id = ?
             LIMIT 1`,
            [order_item_id]
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
            [item.order_id]
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
            [item.order_id, item.product_id]
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

        /* 4. PRODUCT — S se start = Shop */
        let productData = null;

        if (item.product_id.startsWith("S")) {

            const [[p]] = await pool.query(
                `SELECT * FROM Shop_Aerodeck
                 WHERE shop_id = ?
                 LIMIT 1`,
                [item.product_id]
            );

            productData = p;

        }

        if (!productData) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        /* 5. USER */
        const [[user]] = await pool.query(
            `SELECT * FROM User_Aerodeck
             WHERE user_id = ?
             LIMIT 1`,
            [order.user_id]
        );

        /* 6. ADMIN */
        let adminData = null;

        if (admin_id) {
            const [[a]] = await pool.query(
                `SELECT * FROM heepitadmin
                 WHERE id = ?
                 LIMIT 1`,
                [admin_id]
            );
            adminData = a;
        }

        /* 7. INSERT INVOICE */
        const invoiceNumber = "001";

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
                admin_id || 0,
                order.order_number || String(order.order_id),
                order.user_id,
                item.product_id,
                item.product_name,
                item.quantity,
                item.unit_price || 0,
                0,
                0,
                item.total_price || 0,
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

/* ============================================
   GET ALL INVOICES
   ============================================ */
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

/* ============================================
   GET SINGLE INVOICE — invoice_id se
   ============================================ */
exports.getInvoiceById = async (req, res) => {
    try {

        const { invoice_id } = req.params;

        const [[invoice]] = await pool.query(
            `SELECT
                i.*,
                u.full_name AS customer_name,
                u.email AS customer_email,
                u.mobile_number AS customer_mobile,
                a.username AS admin_username,
                a.name AS admin_name
             FROM Invoice_Aerodeck i
             LEFT JOIN User_Aerodeck u
                ON i.user_id = u.user_id
             LEFT JOIN heepitadmin a
                ON i.admin_id = a.id
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

/* ============================================
   MARK GENERATED — is_Generate = TRUE
   ============================================ */
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