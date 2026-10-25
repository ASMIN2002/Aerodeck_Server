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

function serverError(res, err, context = "Server Error") {
  console.error(context, err.message);
  return res.status(500).json({ success: false, message: context });
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

function unauthorized(res) {
  return res.status(401).json({ success: false, message: "Invalid session." });
}

function notFound(res, message = "Not found") {
  return res.status(404).json({ success: false, message });
}

async function uploadToCloudinary(fileBuffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
}

async function deleteFromCloudinary(publicId, resourceType = "image") {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("CLOUDINARY DELETE ERROR:", err.message);
  }
}

async function deleteOldImage(url) {
  if (!url) return;
  const publicId = getPublicId(url);
  if (publicId) await deleteFromCloudinary(publicId);
}

async function authenticate(session_token) {
  if (!session_token) return null;
  return await getUserIdFromSession(session_token);
}

exports.uploadProfile = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No Image Selected");

    const founderId = req.body.founderId;

    if (founderId) {
      const [rows] = await db.query(
        `SELECT profile_image FROM founders WHERE id = ?`,
        [founderId]
      );

      if (rows.length > 0 && rows[0].profile_image) {
        await deleteOldImage(rows[0].profile_image);
      }
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/FOUNDERS",
    });

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    return serverError(res, err, "UPLOAD FAILED:");
  }
};

exports.uploadProduct = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No Image Selected");

    const { product_id, image_no } = req.body;

    if (!product_id || !image_no)
      return badRequest(res, "Product ID & Image No Required");

    const [rows] = await db.query(
      `SELECT product_image1, product_image2, product_image3, product_image4
             FROM cards_heepit WHERE product_id = ?`,
      [product_id]
    );

    if (rows.length > 0) {
      await deleteOldImage(rows[0][`product_image${image_no}`]);
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/PRODUCTS",
      public_id: `product_${product_id}_image${image_no}`,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });

    return res.json({ success: true, url: result.secure_url });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.uploadGift = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No Image Selected");

    const { gift_id, image_no } = req.body;

    if (!gift_id || !image_no)
      return badRequest(res, "Gift ID & Image No Required");

    const [rows] = await db.query(
      `SELECT gift_image1, gift_image2, gift_image3, gift_image4
             FROM food_heepit WHERE gift_id = ?`,
      [gift_id]
    );

    if (rows.length > 0) {
      await deleteOldImage(rows[0][`gift_image${image_no}`]);
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/GIFTS",
      public_id: `gift_${gift_id}_image${image_no}`,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.uploadShop = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No Image Selected");

    const { shop_id, image_no } = req.body;

    if (!shop_id || !image_no)
      return badRequest(res, "Shop ID & Image No Required");

    const [rows] = await db.query(
      `SELECT shop_image1, shop_image2, shop_image3, shop_image4
             FROM shop_heepit WHERE shop_id = ?`,
      [shop_id]
    );

    if (rows.length > 0) {
      await deleteOldImage(rows[0][`shop_image${image_no}`]);
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/SHOP",
      public_id: `shop_${shop_id}_image${image_no}`,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.uploadReviewImage = async (req, res) => {
  try {
    const { session_token, order_item_id, product_id } = req.body;

    const user_id = await authenticate(session_token);
    if (!user_id) return unauthorized(res);

    const [[check]] = await db.query(
      `SELECT COUNT(*) AS total FROM review_media_heepit WHERE order_item_id = ?`,
      [order_item_id]
    );

    if (check.total >= 2)
      return res.json({ success: false, message: "Maximum 2 images allowed." });

    if (!req.file) return badRequest(res, "No image selected.");

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/REVIEWS",
      resource_type: "image",
    });

    const [insertResult] = await db.query(
      `INSERT INTO review_media_heepit
             (order_item_id, user_id, product_id, image_url, public_id)
             VALUES (?, ?, ?, ?, ?)`,
      [order_item_id, user_id, product_id, result.secure_url, result.public_id]
    );

    return res.json({
      success: true,
      media_id: insertResult.insertId,
      image_url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.deleteReviewImage = async (req, res) => {
  try {
    const { media_id } = req.params;
    const { session_token } = req.body;

    const user_id = await authenticate(session_token);
    if (!user_id) return unauthorized(res);

    const [rows] = await db.query(
      `SELECT public_id FROM review_media_heepit
             WHERE media_id = ? AND user_id = ?`,
      [media_id, user_id]
    );

    if (rows.length === 0) return notFound(res, "Image not found.");

    await deleteFromCloudinary(rows[0].public_id);

    await db.query(
      `DELETE FROM review_media_heepit WHERE media_id = ? AND user_id = ?`,
      [media_id, user_id]
    );

    return res.json({ success: true, message: "Image deleted successfully." });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.uploadUserProfile = async (req, res) => {
  try {
    const { session_token } = req.body;

    const user_id = await authenticate(session_token);
    if (!user_id) return unauthorized(res);

    if (!req.file) return badRequest(res, "No image selected.");

    const [rows] = await db.query(
      `SELECT user_id FROM users_heepit WHERE user_id = ?`,
      [user_id]
    );

    if (!rows.length) return notFound(res, "User not found.");

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/USERS",
      public_id: `user_${user_id}_profile`,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });

    await db.query(
      `UPDATE users_heepit SET profile_image = ?, profile_image_id = ?
             WHERE user_id = ?`,
      [result.secure_url, result.public_id, user_id]
    );

    const [updated] = await db.query(
      `SELECT user_id, full_name, mobile_number, email,
                    profile_image, profile_image_id,
                    is_mobile_verified, is_email_verified
             FROM users_heepit WHERE user_id = ?`,
      [user_id]
    );

    return res.json({
      success: true,
      message: "Profile image updated successfully.",
      user: updated[0],
    });
  } catch (err) {
    return serverError(res, err, "PROFILE UPLOAD ERROR:");
  }
};

exports.removeUserProfile = async (req, res) => {
  try {
    const { session_token } = req.body;

    const user_id = await authenticate(session_token);
    if (!user_id) return unauthorized(res);

    const [rows] = await db.query(
      `SELECT profile_image_id FROM users_heepit WHERE user_id = ?`,
      [user_id]
    );

    if (!rows.length) return notFound(res, "User not found.");

    if (rows[0].profile_image_id) {
      await deleteFromCloudinary(rows[0].profile_image_id);
    }

    await db.query(
      `UPDATE users_heepit SET profile_image = NULL, profile_image_id = NULL
             WHERE user_id = ?`,
      [user_id]
    );

    const [updated] = await db.query(
      `SELECT * FROM users_heepit WHERE user_id = ?`,
      [user_id]
    );

    return res.json({ success: true, user: updated[0] });
  } catch (err) {
    return serverError(res, err);
  }
};

exports.uploadVideoHero = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No Video Selected");

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/VIDEO_HERO",
      resource_type: "video",
    });

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    return serverError(res, err, "VIDEO UPLOAD FAILED:");
  }
};

exports.uploadShopVideo = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No Video Selected");

    const { shop_id, video_no } = req.body;

    if (!shop_id || !video_no)
      return badRequest(res, "Shop ID & Video No Required");

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/SHOP_VIDEOS",
      public_id: `shop_${shop_id}_video${video_no}`,
      overwrite: true,
      invalidate: true,
      resource_type: "video",
    });

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    return serverError(res, err, "SHOP VIDEO UPLOAD FAILED:");
  }
};
exports.uploadShopModel3D = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No Model Selected");
    const { shop_id, image_no } = req.body;
    if (!shop_id || !image_no) return badRequest(res, "Shop ID & Image No Required");
    const ext = (req.file.originalname || "").split(".").pop().toLowerCase();
    if (!["glb", "gltf"].includes(ext)) return badRequest(res, "Only .glb or .gltf files allowed");
    const [rows] = await db.query(`SELECT shop_image${image_no} AS old_url FROM shop_heepit WHERE shop_id = ?`, [shop_id]);
    if (rows.length > 0 && rows[0].old_url) {
      const oldUrl = rows[0].old_url;
      const oldPublicId = getPublicId(oldUrl);
      if (oldPublicId) {
        const oldType = /\.(glb|gltf)(\?|$)/i.test(oldUrl) ? "raw" : "image";
        await deleteFromCloudinary(oldPublicId, oldType);
      }
    }
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "AERODECK/SHOP/MODELS3D",
      public_id: `shop_${shop_id}_model${image_no}.glb`,
      overwrite: true,
      invalidate: true,
      resource_type: "raw",
    });
    return res.json({ success: true, url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    return serverError(res, err, "MODEL 3D UPLOAD FAILED:");
  }
};