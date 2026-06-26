const cloudinary = require("../config/cloudinary");

exports.uploadProfile = async (req, res) => {
  try {

    if (!req.file) {

      return res.status(400).json({

        success: false,

        message: "No Image Selected"

      });

    }

    const result = await new Promise(

      (resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(

          {

            folder: "AERODECK/FOUNDERS"

          },

          (err, result) => {

            if (err) reject(err);

            else resolve(result);

          }

        );

        stream.end(req.file.buffer);

      }

    );

    return res.json({

      success: true,

      url: result.secure_url

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