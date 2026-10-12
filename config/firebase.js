const admin = require("firebase-admin");

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        "base64"
    ).toString("utf8");

    serviceAccount = JSON.parse(decoded);
} else {
    serviceAccount = require("./firebase-service-account.json");
}

admin.initializeApp({
    credential: admin.cert(serviceAccount)
});

module.exports = admin;