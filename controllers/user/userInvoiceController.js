const pool = require("../../config/db");

exports.getInvoice = async (req, res) => {

    try {

        const { order_id, product_id } = req.params;

        const [rows] = await pool.query(

            `
            SELECT

                i.invoice_number,
                i.invoice_date,
                i.order_number,
                i.product_id,
                i.product_name,
                i.quantity,
                i.unit_price,
                i.gst_percentage,
                i.gst_amount,
                i.total_amount,
                i.gstin_number,

                o.order_status,
                o.payment_status,
                o.payment_method,
                o.created_at AS order_date,
                o.advance_amount,
                o.remaining_amount,

                ua.full_name,
                ua.mobile_number,
                ua.house_flat,
                ua.area_street,
                ua.landmark,
                ua.city,
                ua.state,
                ua.pincode,
                ua.address_type,

                u.email

            FROM Invoice_Aerodeck i

            INNER JOIN Orders_Aerodeck o
                ON i.order_id = o.order_id

            INNER JOIN User_Address_Aerodeck ua
                ON o.address_id = ua.address_id

            INNER JOIN User_Aerodeck u
                ON o.user_id = u.user_id

            WHERE
                i.order_id = ?
                AND i.product_id = ?

            LIMIT 1
            `,
            [order_id, product_id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Invoice not found"

            });

        }

        const invoice = rows[0];

        return res.json({

            success: true,

            data: {

                invoice_number: invoice.invoice_number,
                order_number: invoice.order_number,

                order_date: invoice.order_date,
                invoice_date: invoice.invoice_date,

                delivery_date: "Pending",

                order_status: invoice.order_status,
                payment_status: invoice.payment_status,
                payment_method: invoice.payment_method,

                full_name: invoice.full_name,
                mobile_number: invoice.mobile_number,

                house_flat: invoice.house_flat,
                area_street: invoice.area_street,
                landmark: invoice.landmark,
                city: invoice.city,
                state: invoice.state,
                pincode: invoice.pincode,
                address_type: invoice.address_type,

                product_id: invoice.product_id,
                product_name: invoice.product_name,
                quantity: invoice.quantity,
                unit_price: invoice.unit_price,

                gst_percentage: invoice.gst_percentage,
                gst_amount: invoice.gst_amount,
                total_amount: invoice.total_amount,

                advance_amount: invoice.advance_amount,
                remaining_amount: invoice.remaining_amount,

                gstin_number: invoice.gstin_number,
                email: invoice.email

            }

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,
            message: "Internal Server Error"

        });

    }

};