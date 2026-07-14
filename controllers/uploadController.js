const cloudinary = require("../config/cloudinary");

const db = require("../config/db");

function getPublicId(url) {

  if (!url) return null;

  const parts = url.split("/upload/");

  if (parts.length < 2) return null;

  let publicId = parts[1];

  publicId = publicId.replace(/^v\d+\//, "");

  publicId = publicId.replace(/\.[^/.]+$/, "");

  return publicId;

}

exports.uploadProfile = async (req, res) => {

  try {

    const founderId = req.body.founderId;

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No Image Selected"

      });

    }
    if (founderId) {

      const [rows] = await db.query(

        `SELECT profile_image
     FROM founders
     WHERE id = ?`,

        [founderId]

      );

      if (

        rows.length > 0 &&

        rows[0].profile_image

      ) {

        const publicId = getPublicId(

          rows[0].profile_image

        );

        if (publicId) {

          await cloudinary.uploader.destroy(

            publicId

          );

          console.log(

            "OLD PROFILE IMAGE DELETED:",

            publicId

          );

        }

      }

    }

    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(

        {

          folder: "AERODECK/FOUNDERS"

        },

        (err, result) => {

          if (err) {

            console.error("Cloudinary Error:", err);

            return reject(err);

          }

          resolve(result);

        }

      );

      stream.end(req.file.buffer);

    });

    return res.json({

      success: true,

      url: result.secure_url,

      public_id: result.public_id

    });

  }

  catch (err) {

    console.error("UPLOAD FAILED");

    console.error(err);

    return res.status(500).json({

      success: false,

      message: err.message

    });

  }

};
exports.uploadProduct = async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No Image Selected"

      });

    }

    const {

      product_id,

      image_no

    } = req.body;

    const [rows] = await db.query(

      `SELECT
        product_image1,
        product_image2,
        product_image3,
        product_image4
     FROM Products_Aerodeck
     WHERE product_id = ?`,

      [product_id]

    );

    if (rows.length > 0) {

      const oldUrl = rows[0][`product_image${image_no}`];

      if (oldUrl) {

        const publicId = getPublicId(oldUrl);

        if (publicId) {

          await cloudinary.uploader.destroy(publicId);

          console.log("OLD IMAGE DELETED:", publicId);

        }

      }

    }

    if (!product_id || !image_no) {

      return res.status(400).json({

        success: false,

        message: "Product ID & Image No Required"

      });

    }

    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(

        {

          folder: "AERODECK/PRODUCTS",

          public_id:

            `product_${product_id}_image${image_no}`,

          overwrite: true,

          invalidate: true,

          resource_type: "image"

        },

        (err, result) => {

          if (err) {

            return reject(err);

          }

          resolve(result);

        }

      );

      stream.end(req.file.buffer);

    });
    console.log("PUBLIC ID:", result.public_id);
    console.log("OVERWRITE RESULT:", result);
    console.log("URL:", result.secure_url);

    return res.json({

      success: true,

      url: result.secure_url

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

exports.uploadGift = async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No Image Selected"

      });

    }

    const {
      gift_id,
      image_no
    } = req.body;
    const [rows] = await db.query(

      `SELECT
    gift_image1,
    gift_image2,
    gift_image3,
    gift_image4
 FROM Gifts_Aerodeck
 WHERE gift_id = ?`,

      [gift_id]

    );

    if (rows.length > 0) {

      const oldUrl = rows[0][`gift_image${image_no}`];

      if (oldUrl) {

        const publicId = getPublicId(oldUrl);

        if (publicId) {

          await cloudinary.uploader.destroy(publicId);

          console.log("OLD IMAGE DELETED:", publicId);

        }

      }

    }

    if (!gift_id || !image_no) {

      return res.status(400).json({

        success: false,

        message: "Gift ID & Image No Required"

      });

    }

    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(

        {

          folder: "AERODECK/GIFTS",

          public_id:

            `gift_${gift_id}_image${image_no}`,

          overwrite: true,

          invalidate: true,

          resource_type: "image"

        },

        (err, result) => {

          if (err) {

            return reject(err);

          }

          resolve(result);

        }

      );

      stream.end(req.file.buffer);

    });
    console.log("PUBLIC ID:", result.public_id);
    console.log("OVERWRITE RESULT:", result);
    console.log("URL:", result.secure_url);

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id
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