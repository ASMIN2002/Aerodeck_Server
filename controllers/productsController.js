const db = require("../config/db");

const addProduct = async (req, res) => {

    try {

        const {

            product_name,
            product_category,
            product_description,
            product_demo_price,
            product_discount_percentage,
            product_highlight_text,
            product_price,
            product_image1,
            product_image2,
            product_image3,
            product_status

        } = req.body;

        await db.query(

            `INSERT INTO Products_Aerodeck (

                product_name,
                product_category,
                product_description,
                product_demo_price,
                product_discount_percentage,
                product_highlight_text,
                product_price,
                product_image1,
                product_image2,
                product_image3,
                product_total_likes,
                product_rating,
                product_status

            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                product_name,
                product_category,
                product_description,
                product_demo_price,
                product_discount_percentage,
                product_highlight_text,
                product_price,
                product_image1,
                product_image2,
                product_image3,
                0,
                0,
                product_status

            ]

        );

        return res.json({

            success: true,
            message: "Product Added Successfully"

        });

    }

    catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

const getProducts = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM Products_Aerodeck ORDER BY product_id DESC"
        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

const getOffers = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM Products_Offer_Aerodeck ORDER BY offer_id DESC"
        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

module.exports = {
    getProducts,
    getOffers,
    addProduct
};