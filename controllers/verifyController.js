const VERIFY_MODE = false;

exports.requestVerify = async (req, res) => {

  try {

    if (!VERIFY_MODE) {

      return res.json({
        success: true,
        verified: true,
        message: "Development Mode Verified"
      });

    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    return res.json({
      success: true,
      verified: false,
      otp
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Verification Failed"
    });

  }

};

exports.verifyStatus = async (req, res) => {

  try {

    if (!VERIFY_MODE) {

      return res.json({
        success: true,
        verified: true
      });

    }

    // Production me yahan database check hoga

    return res.json({
      success: true,
      verified: false
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Status Failed"
    });

  }

};