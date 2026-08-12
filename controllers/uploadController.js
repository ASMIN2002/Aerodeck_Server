const cloudinary = require("../config/cloudinary");
const getUserIdFromSession = require("../middleware/getUserIdFromSession");

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

exports.uploadPremium = async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No Image Selected"

      });

    }

    const {
      premium_id,
      image_no
    } = req.body;

    const [rows] = await db.query(

      `SELECT
        premium_image1,
        premium_image2,
        premium_image3,
        premium_image4
      FROM Premium_Aerodeck
      WHERE premium_id = ?`,

      [premium_id]

    );

    if (rows.length > 0) {

      const oldUrl = rows[0][`premium_image${image_no}`];

      if (oldUrl) {

        const publicId = getPublicId(oldUrl);

        if (publicId) {

          await cloudinary.uploader.destroy(publicId);

          console.log("OLD IMAGE DELETED:", publicId);

        }

      }

    }

    if (!premium_id || !image_no) {

      return res.status(400).json({

        success: false,

        message: "Premium ID & Image No Required"

      });

    }

    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(

        {

          folder: "AERODECK/PREMIUM",

          public_id: `premium_${premium_id}_image${image_no}`,

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
exports.uploadShop = async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No Image Selected"

      });

    }

    const {
      shop_id,
      image_no
    } = req.body;

    const [rows] = await db.query(

      `SELECT
        shop_image1,
        shop_image2,
        shop_image3,
        shop_image4
      FROM Shop_Aerodeck
      WHERE shop_id = ?`,

      [shop_id]

    );

    if (rows.length > 0) {

      const oldUrl = rows[0][`shop_image${image_no}`];

      if (oldUrl) {

        const publicId = getPublicId(oldUrl);

        if (publicId) {

          await cloudinary.uploader.destroy(publicId);

          console.log("OLD IMAGE DELETED:", publicId);

        }

      }

    }

    if (!shop_id || !image_no) {

      return res.status(400).json({

        success: false,

        message: "Shop ID & Image No Required"

      });

    }

    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(

        {

          folder: "AERODECK/SHOP",

          public_id: `shop_${shop_id}_image${image_no}`,

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
exports.uploadReviewImage = async (req, res) => {

  try {

    const {

      session_token,
      order_item_id,
      product_id

    } = req.body;
    const user_id = await getUserIdFromSession(session_token);

    if (!user_id) {

      return res.status(401).json({

        success: false,
        message: "Invalid session."

      });

    }

    const [[check]] = await db.query(

      `SELECT COUNT(*) AS total
   FROM Review_Media_AERODECK
   WHERE order_item_id = ?`,

      [order_item_id]

    );

    if (check.total >= 2) {

      return res.json({

        success: false,
        message: "Maximum 2 images allowed."

      });

    }

    if (!req.file) {

      return res.status(400).json({

        success: false,
        message: "No image selected."

      });

    }

    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(

        {

          folder: "AERODECK/REVIEWS",

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

    const [insertResult] = await db.query(

      `INSERT INTO Review_Media_AERODECK
(
    order_item_id,
    user_id,
    product_id,
    image_url,
    public_id
)
VALUES
(?,?,?,?,?)`,

      [
        order_item_id,
        user_id,
        product_id,
        result.secure_url,
        result.public_id
      ]

    );

    return res.json({

      success: true,

      media_id: insertResult.insertId,

      image_url: result.secure_url,

      public_id: result.public_id

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: err.message

    });

  }

};
exports.deleteReviewImage = async (req, res) => {

  try {

    const { media_id } = req.params;

    const { session_token } = req.body;

    const user_id = await getUserIdFromSession(session_token);

    if (!user_id) {

      return res.status(401).json({

        success: false,
        message: "Invalid session."

      });

    }

    const [rows] = await db.query(

      `SELECT

                public_id

            FROM Review_Media_AERODECK

            WHERE

                media_id = ?
                AND user_id = ?`,

      [

        media_id,
        user_id

      ]

    );

    if (rows.length === 0) {

      return res.status(404).json({

        success: false,
        message: "Image not found."

      });

    }

    await cloudinary.uploader.destroy(

      rows[0].public_id

    );

    await db.query(

      `DELETE FROM Review_Media_AERODECK

             WHERE

                media_id = ?
                AND user_id = ?`,

      [

        media_id,
        user_id

      ]

    );

    return res.json({

      success: true,
      message: "Image deleted successfully."

    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,
      message: err.message

    });

  }

};

// USER
exports.uploadUserProfile = async (req, res) => {

  try {

    const { session_token } = req.body;

    const user_id = await getUserIdFromSession(session_token);

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Invalid session."
      });
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image selected."
      });
    }

    // Get current profile image
    const [rows] = await db.query(

      `SELECT
                profile_image,
                profile_image_id
             FROM User_Aerodeck
             WHERE user_id=?`,

      [user_id]

    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    // Delete old image
    if (rows[0].profile_image_id) {

      try {

        await cloudinary.uploader.destroy(
          rows[0].profile_image_id
        );

        console.log(
          "OLD USER IMAGE DELETED:",
          rows[0].profile_image_id
        );

      } catch (e) {

        console.log("Old image delete skipped.");

      }

    }

    // Upload new image
    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(

        {
          folder: "AERODECK/USERS",
          public_id: `user_${user_id}_profile`,
          overwrite: true,
          invalidate: true,
          resource_type: "image"
        },

        (err, result) => {

          if (err) return reject(err);

          resolve(result);

        }

      );

      stream.end(req.file.buffer);

    });

    // Update Database
    const [updateResult] = await db.query(

      `UPDATE User_Aerodeck
             SET
                profile_image=?,
                profile_image_id=?
             WHERE user_id=?`,

      [
        result.secure_url,
        result.public_id,
        user_id
      ]

    );
    // Return updated user
    const [updated] = await db.query(

      `SELECT
                user_id,
                full_name,
                mobile_number,
                email,
                profile_image,
                profile_image_id,
                is_mobile_verified,
                is_email_verified
             FROM User_Aerodeck
             WHERE user_id=?`,

      [user_id]

    );

    return res.json({

      success: true,

      message: "Profile image updated successfully.",

      user: updated[0]

    });

  }

  catch (err) {

    console.error(err);

    return res.status(500).json({

      success: false,

      message: err.message

    });

  }

};
exports.removeUserProfile = async (req, res) => {

  try {

    const { session_token } = req.body;

    const user_id = await getUserIdFromSession(session_token);

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Invalid session."
      });
    }
    const [rows] = await db.query(
      `SELECT profile_image_id
             FROM User_Aerodeck
             WHERE user_id=?`,
      [user_id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (rows[0].profile_image_id) {

      await cloudinary.uploader.destroy(
        rows[0].profile_image_id
      );

    }

    await db.query(
      `UPDATE User_Aerodeck
             SET
                profile_image=NULL,
                profile_image_id=NULL
             WHERE user_id=?`,
      [user_id]
    );

    const [updated] = await db.query(
      `SELECT *
             FROM User_Aerodeck
             WHERE user_id=?`,
      [user_id]
    );

    return res.json({
      success: true,
      user: updated[0]
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

};

exports.uploadPaymentProof = async (req, res) => {

  try {

    const {
      session_token,
      product_id,
      order_id,
      name,
      number
    } = req.body;

    const user_id =
      await getUserIdFromSession(session_token);

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Payment screenshot is required."
      });
    }

    if (!product_id || !name || !number) {
      return res.status(400).json({
        success: false,
        message: "Payment details are required."
      });
    }

    // Upload screenshot to Cloudinary
    const result = await new Promise((resolve, reject) => {

      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "AERODECK/PAYMENTS",
          resource_type: "image"
        },
        (err, uploaded) => {

          if (err) {
            return reject(err);
          }

          resolve(uploaded);

        }
      );

      stream.end(req.file.buffer);

    });

    // Save payment details
    await db.query(
      `INSERT INTO UserPaymentDetails
            (
                user_id,
                product_id,
                upload_image_url,
                url_id,
                name,
                number,
                payment_date
            )
            VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        user_id,
        product_id,
        result.secure_url,
        result.public_id,
        name,
        number
      ]
    );

    return res.json({
      success: true,
      message: "Payment proof uploaded successfully.",
      url: result.secure_url,
      url_id: result.public_id
    });

  } catch (err) {

    console.error(
      "PAYMENT PROOF UPLOAD ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: err.sqlMessage || err.message
    });

  }

};