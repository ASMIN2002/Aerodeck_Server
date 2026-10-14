const pool = require("../../config/db");

const INVOICE_JOIN = `
    FROM invoice_heepit i
    LEFT JOIN users_heepit u ON i.user_id = u.user_id
    LEFT JOIN heepitadmin a ON i.admin_id = a.id
    LEFT JOIN orders_heepit o ON i.order_id = o.order_id
    LEFT JOIN user_address_heepit ad ON o.address_id = ad.address_id
`;

const INVOICE_FIELDS = `
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
`;

function serverError(res, err, context = "Server Error") {
    console.error(context, err.message);
    return res.status(500).json({ success: false, message: context });
}

function notFound(res, message = "Not found") {
    return res.status(404).json({ success: false, message });
}

async function getProductAndAdmin(productType, productId) {
    const tableMap = {
        CARD: { table: "cards_heepit", idCol: "product_id" },
        SHOP: { table: "shop_heepit", idCol: "shop_id" },
    };

    const config = tableMap[productType];
    if (!config) return { product: null, adminId: 0 };

    const [[product]] = await pool.query(
        `SELECT * FROM ${config.table} WHERE ${config.idCol} = ? LIMIT 1`,
        [productId]
    );

    if (!product || !product.posted_by) return { product, adminId: 0 };

    const [[admin]] = await pool.query(
        `SELECT id FROM heepitadmin WHERE username = ? LIMIT 1`,
        [product.posted_by]
    );

    return { product, adminId: admin?.id || 0 };
}

async function generateInvoiceNumber() {
    const yearShort = String(new Date().getFullYear()).slice(-2);

    const [[lastInv]] = await pool.query(
        `SELECT invoice_number FROM invoice_heepit
         WHERE invoice_number LIKE ?
         ORDER BY invoice_id DESC LIMIT 1`,
        [`HEEPIT/${yearShort}/%`]
    );

    let nextCounter = 1;

    if (lastInv?.invoice_number) {
        const parts = lastInv.invoice_number.split("/");
        const lastCounter = parseInt(parts[2], 10);
        if (!isNaN(lastCounter)) nextCounter = lastCounter + 1;
    }

    return `HEEPIT/${yearShort}/${String(nextCounter).padStart(3, "0")}`;
}

function calculateFinalTotal(item, order) {
    if (item.product_type !== "CARD") return item.total_price || 0;

    if (order.payment_status === "PARTIAL")
        return `${order.advance_amount || 0} ~ ${item.total_price}`;

    if (order.payment_status === "PAID")
        return `${item.total_price} ~ ${item.total_price}`;

    return item.total_price || 0;
}

exports.createInvoice = async (req, res) => {
    try {
        const { order_id, product_type } = req.body;

        if (!order_id || !product_type)
            return res.status(400).json({ success: false, message: "order_id and product_type required" });

        const [[item]] = await pool.query(
            `SELECT * FROM order_items_heepit
             WHERE order_id = ? AND product_type = ? LIMIT 1`,
            [order_id, product_type]
        );

        if (!item) return notFound(res, "Order item not found");

        const [[order]] = await pool.query(
            `SELECT * FROM orders_heepit WHERE order_id = ? LIMIT 1`,
            [order_id]
        );

        if (!order) return notFound(res, "Order not found");

        const [[existing]] = await pool.query(
            `SELECT invoice_id, invoice_number, is_Generate
             FROM invoice_heepit WHERE order_id = ? AND product_id = ? LIMIT 1`,
            [order_id, item.product_id]
        );

        if (existing) {
            return res.json({
                success: true,
                message: "Invoice already exists.",
                invoice_id: existing.invoice_id,
                invoice_number: existing.invoice_number,
                is_generated: existing.is_Generate === 1 || existing.is_Generate === true,
                already_exists: true,
            });
        }

        const { product, adminId } = await getProductAndAdmin(item.product_type, item.product_id);

        if (!product) return notFound(res, "Product not found");

        const invoiceNumber = await generateInvoiceNumber();
        const finalTotalAmount = calculateFinalTotal(item, order);

        const [result] = await pool.query(
            `INSERT INTO invoice_heepit
             (invoice_number, order_id, admin_id, order_number, user_id, product_id,
              product_name, quantity, unit_price, gst_percentage, gst_amount,
              total_amount, gstin_number, is_Generate, is_Saved)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                false,
            ]
        );

        return res.json({
            success: true,
            message: "Invoice generated successfully.",
            invoice_id: result.insertId,
            invoice_number: invoiceNumber,
            is_generated: false,
            already_exists: false,
        });
    } catch (err) {
        return serverError(res, err, "CREATE INVOICE ERROR:");
    }
};

exports.getAllInvoices = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT ${INVOICE_FIELDS}
             ${INVOICE_JOIN}
             ORDER BY i.invoice_id DESC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "GET ALL INVOICES ERROR:");
    }
};

exports.getInvoiceById = async (req, res) => {
    try {
        const { invoice_id } = req.params;

        const [[invoice]] = await pool.query(
            `SELECT ${INVOICE_FIELDS}
             ${INVOICE_JOIN}
             WHERE i.invoice_id = ?
             LIMIT 1`,
            [invoice_id]
        );

        if (!invoice) return notFound(res, "Invoice not found");

        return res.json({ success: true, data: invoice });
    } catch (err) {
        return serverError(res, err, "GET INVOICE ERROR:");
    }
};

exports.markGenerated = async (req, res) => {
    try {
        const { invoice_id } = req.params;

        await pool.query(
            `UPDATE invoice_heepit SET is_Generate = TRUE WHERE invoice_id = ?`,
            [invoice_id]
        );

        return res.json({ success: true, message: "Invoice marked as generated." });
    } catch (err) {
        return serverError(res, err, "MARK GENERATED ERROR:");
    }
};

exports.toggleSaved = async (req, res) => {
    try {
        const { invoice_id } = req.params;

        const [[inv]] = await pool.query(
            `SELECT is_Saved FROM invoice_heepit WHERE invoice_id = ? LIMIT 1`,
            [invoice_id]
        );

        if (!inv) return notFound(res, "Invoice not found");

        const newVal = !inv.is_Saved;

        await pool.query(
            `UPDATE invoice_heepit SET is_Saved = ? WHERE invoice_id = ?`,
            [newVal, invoice_id]
        );

        return res.json({
            success: true,
            is_Saved: newVal,
            message: newVal ? "Saved in your profile" : "Unsaved from your profile",
        });
    } catch (err) {
        return serverError(res, err, "TOGGLE SAVED ERROR:");
    }
};

exports.getInvoicesByAdmin = async (req, res) => {
    try {
        const { admin_id } = req.params;

        if (!admin_id)
            return res.status(400).json({ success: false, message: "admin_id required" });

        const [rows] = await pool.query(
            `SELECT ${INVOICE_FIELDS}
             ${INVOICE_JOIN}
             WHERE i.admin_id = ? AND i.is_Saved = 1
             ORDER BY i.invoice_id DESC`,
            [admin_id]
        );

        return res.json({ success: true, data: rows });
    } catch (err) {
        return serverError(res, err, "GET INVOICES BY ADMIN ERROR:");
    }
};