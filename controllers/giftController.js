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

const addGift = async (req, res) => {

    try {

        const {

            gift_name,
            gift_description,
            gift_demo_price,
            gift_discount_percentage,
            gift_highlight_text,
            gift_price,
            gift_image1,
            gift_image2,
            gift_image3,
            gift_image4,
            gift_status

        } = req.body;

        const [result] = await db.query(

            `INSERT INTO Gifts_Aerodeck (

                gift_name,
                gift_description,
                gift_demo_price,
                gift_discount_percentage,
                gift_highlight_text,
                gift_price,
                gift_image1,
                gift_image2,
                gift_image3,
                gift_image4,
                gift_total_likes,
                gift_rating,
                gift_status

           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [

                gift_name,
                gift_description,
                gift_demo_price,
                gift_discount_percentage,
                gift_highlight_text,
                gift_price,
                gift_image1,
                gift_image2,
                gift_image3,
                gift_image4,
                0,
                0,
                gift_status

            ]

        );
        const giftId = `G${result.insertId}`;

        await db.query(

            `UPDATE Gifts_Aerodeck
     SET gift_id = ?
     WHERE id = ?`,

            [giftId, result.insertId]

        );

        return res.json({

            success: true,
            message: "Gift Added Successfully"

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


const getGifts = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM Gifts_Aerodeck ORDER BY gift_id DESC"
        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

};

const updateGift = async (req, res) => {

    try {

        const {

            gift_id,
            gift_name,
            gift_description,
            gift_demo_price,
            gift_discount_percentage,
            gift_highlight_text,

            gift_image1,
            gift_image2,
            gift_image3,
            gift_image4,

            gift_image1_public_id,
            gift_image2_public_id,
            gift_image3_public_id,
            gift_image4_public_id,

            gift_status

        } = req.body;

        const gift_price = (

            Number(gift_demo_price)

            -

            (

                Number(gift_demo_price)

                *

                Number(gift_discount_percentage)

            ) / 100

        ).toFixed(2);

        await db.query(

            `UPDATE Gifts_Aerodeck
SET
    gift_name = ?,
    gift_description = ?,
    gift_demo_price = ?,
    gift_discount_percentage = ?,
    gift_highlight_text = ?,
    gift_price = ?,
    gift_image1 = ?,
gift_image1_public_id = ?,

gift_image2 = ?,
gift_image2_public_id = ?,

gift_image3 = ?,
gift_image3_public_id = ?,

gift_image4 = ?,
gift_image4_public_id = ?,

gift_status = ?
WHERE gift_id = ?`,

            [

                gift_name,
                gift_description,
                gift_demo_price,
                gift_discount_percentage,
                gift_highlight_text,
                gift_price,
                gift_image1,
                gift_image1_public_id,

                gift_image2,
                gift_image2_public_id,

                gift_image3,
                gift_image3_public_id,

                gift_image4,
                gift_image4_public_id,

                gift_status,
                gift_id


            ]

        );

        return res.json({

            success: true,
            message: "Gift Updated Successfully"

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

const deleteGift = async (req, res) => {

    try {

        const { id } = req.params;

        const [rows] = await db.query(

            `SELECT
        gift_image1,
        gift_image2,
        gift_image3,
        gift_image4
     FROM Gifts_Aerodeck
     WHERE gift_id = ?`,

            [id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Gift Not Found"

            });

        }

        const gift = rows[0];
        if (gift.gift_image1) {

            await cloudinary.uploader.destroy(

                getPublicId(gift.gift_image1)

            );

        }

        if (gift.gift_image2) {

            await cloudinary.uploader.destroy(

                getPublicId(gift.gift_image2)

            );

        }

        if (gift.gift_image3) {

            await cloudinary.uploader.destroy(

                getPublicId(gift.gift_image3)

            );

        }

        if (gift.gift_image4) {

            await cloudinary.uploader.destroy(

                getPublicId(gift.gift_image4)

            );

        }


        await db.query(

            "DELETE FROM Gift_Likes_AERODECK WHERE gift_id = ?",

            [id]

        );

        await db.query(
            "DELETE FROM Gift_Ratings_AERODECK WHERE gift_id = ?",
            [id]
        );

        await db.query(
            "DELETE FROM Gifts_Aerodeck WHERE gift_id = ?",
            [id]
        );

        return res.json({

            success: true,

            message: "Gift Deleted"

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
    getGifts,
    addGift,
    updateGift,
    deleteGift
};