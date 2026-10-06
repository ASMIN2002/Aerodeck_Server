const db = require("../config/db");
const cloudinary = require("../config/cloudinary");

const addCategory = async (req, res) => {

    try {

        const {
            catname,
            category
        } = req.body;

        if (!catname || !category?.trim()) {

            return res.status(400).json({
                success: false,
                message: "Type and Category are required"
            });

        }

        const allowedTypes = ["SHOP", "GIFT", "FOOD", "CARDS", "MEDICAL"];

        if (!allowedTypes.includes(catname)) {

            return res.status(400).json({
                success: false,
                message: "Invalid category type"
            });

        }

        if (!req.file) {

            return res.status(400).json({
                success: false,
                message: "Image is required"
            });

        }

        const uploadResult = await new Promise(
            (resolve, reject) => {

                const stream =
                    cloudinary.uploader.upload_stream(
                        {
                            folder: "aerodeck/categories",
                            resource_type: "image"
                        },
                        (error, result) => {

                            if (error) {
                                reject(error);
                            } else {
                                resolve(result);
                            }

                        }
                    );

                stream.end(req.file.buffer);

            }
        );

        const imageUrl = uploadResult.secure_url;
        const imageId = uploadResult.public_id;

        const [result] = await db.query(
            `
            INSERT INTO ALL_Category
            (
                catname,
                category,
                image,
                imageid
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                catname,
                category.trim(),
                imageUrl,
                imageId
            ]
        );

        return res.status(201).json({

            success: true,

            message: "Category Added Successfully",

            data: {
                catid: result.insertId,
                catname: catname,
                category: category.trim(),
                image: imageUrl,
                imageid: imageId
            }

        });

    }

    catch (err) {

        console.error(
            "ADD CATEGORY ERROR:",
            err
        );

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

const getCategories = async (req, res) => {

    try {

        const [rows] = await db.query(
            `
            SELECT
                catid,
                catname,
                category,
                image,
                imageid
            FROM ALL_Category
            ORDER BY catid DESC
            `
        );

        return res.json({

            success: true,
            data: rows

        });

    }

    catch (err) {

        console.error(
            "GET CATEGORY ERROR:",
            err
        );

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

module.exports = {

    addCategory,
    getCategories

};