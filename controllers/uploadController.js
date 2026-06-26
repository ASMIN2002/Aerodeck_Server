const cloudinary = require("../config/cloudinary");

exports.uploadProfile = async (req, res) => {

  try {

    console.log("===== UPLOAD REQUEST =====");

    console.log("File Received:", !!req.file);

    console.log(
      "Cloud Name:",
      process.env.CLOUDINARY_CLOUD_NAME
    );

    console.log(
      "API Key:",
      process.env.CLOUDINARY_API_KEY
        ? "FOUND"
        : "MISSING"
    );

    console.log(
      "API Secret:",
      process.env.CLOUDINARY_API_SECRET
        ? "FOUND"
        : "MISSING"
    );

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No Image Selected"

      });

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

      url: result.secure_url

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