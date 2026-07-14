const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

function getPublicId(url) {

    if (!url) return null;

    const parts = url.split("/upload/");

    if (parts.length < 2) return null;

    let publicId = parts[1];

    publicId = publicId.replace(/^v\d+\//, "");

    publicId = publicId.replace(/\.[^/.]+$/, "");

    return publicId;

}

const addPremium = async (req, res) => {

    try {

        const {

            premium_name,
            premium_description,
            premium_demo_price,
            premium_discount_percentage,
            premium_highlight_text,
            premium_price,
            premium_image1,
            premium_image2,
            premium_image3,
            premium_image4,
            premium_status

        } = req.body;

        const [result] = await db.query(

            `INSERT INTO Premium_Aerodeck (

                premium_name,
                premium_description,
                premium_demo_price,
                premium_discount_percentage,
                premium_highlight_text,
                premium_price,
                premium_image1,
                premium_image2,
                premium_image3,
                premium_image4,
                premium_total_likes,
                premium_rating,
                premium_status

           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                premium_name,
                premium_description,
                premium_demo_price,
                premium_discount_percentage,
                premium_highlight_text,
                premium_price,
                premium_image1,
                premium_image2,
                premium_image3,
                premium_image4,
                0,
                0,
                premium_status

            ]

        );
        const premiumId = `P${result.insertId}`;

        await db.query(

            `UPDATE Premium_Aerodeck
     SET premium_id = ?
     WHERE id = ?`,

            [premiumId, result.insertId]

        );

        return res.json({

            success: true,
            message: "Premium Added Successfully"

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


const getPremiums = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM Premium_Aerodeck ORDER BY premium_id DESC"
        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

const updatePremium = async (req, res) => {

    try {

        const {

            premium_id,
            premium_name,
            premium_description,
            premium_demo_price,
            premium_discount_percentage,
            premium_highlight_text,

            premium_image1,
            premium_image2,
            premium_image3,
            premium_image4,

            premium_image1_public_id,
            premium_image2_public_id,
            premium_image3_public_id,
            premium_image4_public_id,

            premium_status

        } = req.body;

        const premium_price = (

            Number(premium_demo_price)

            -

            (

                Number(premium_demo_price)

                *

                Number(premium_discount_percentage)

            ) / 100

        ).toFixed(2);

        await db.query(

            `UPDATE Premium_Aerodeck
SET
    premium_name = ?,
    premium_description = ?,
    premium_demo_price = ?,
    premium_discount_percentage = ?,
    premium_highlight_text = ?,
    premium_price = ?,
    premium_image1 = ?,
premium_image1_public_id = ?,

premium_image2 = ?,
premium_image2_public_id = ?,

premium_image3 = ?,
premium_image3_public_id = ?,

premium_image4 = ?,
premium_image4_public_id = ?,

premium_status = ?
WHERE premium_id = ?`,

            [

                premium_name,
                premium_description,
                premium_demo_price,
                premium_discount_percentage,
                premium_highlight_text,
                premium_price,
                premium_image1,
                premium_image1_public_id,

                premium_image2,
                premium_image2_public_id,

                premium_image3,
                premium_image3_public_id,

                premium_image4,
                premium_image4_public_id,

                premium_status,
                premium_id


            ]

        );

        return res.json({

            success: true,
            message: "Premium Updated Successfully"

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

const deletePremium = async (req, res) => {

    try {

        const { id } = req.params;

        const [rows] = await db.query(

            `SELECT
        premium_image1,
        premium_image2,
        premium_image3,
        premium_image4
     FROM Premium_Aerodeck
     WHERE premium_id = ?`,

            [id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Premium Not Found"

            });

        }

        const premium = rows[0];
        if (premium.premium_image1) {

            await cloudinary.uploader.destroy(

                getPublicId(premium.premium_image1)

            );

        }

        if (premium.premium_image2) {

            await cloudinary.uploader.destroy(

                getPublicId(premium.premium_image2)

            );

        }

        if (premium.premium_image3) {

            await cloudinary.uploader.destroy(

                getPublicId(premium.premium_image3)

            );

        }

        if (premium.premium_image4) {

            await cloudinary.uploader.destroy(

                getPublicId(premium.premium_image4)

            );

        }


        await db.query(

            "DELETE FROM Premium_Likes_AERODECK WHERE premium_id = ?",

            [id]

        );

        await db.query(
            "DELETE FROM Premium_Ratings_AERODECK WHERE premium_id = ?",
            [id]
        );

        await db.query(
            "DELETE FROM Premium_Aerodeck WHERE premium_id = ?",
            [id]
        );

        return res.json({

            success: true,

            message: "Premium Deleted"

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

module.exports = {
    getPremiums,
    addPremium,
    updatePremium,
    deletePremium
};