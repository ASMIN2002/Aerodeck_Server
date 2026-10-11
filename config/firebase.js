const admin = require("firebase-admin");

let serviceAccount;

/* Base64 se load karo (Render / Production) */
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        "base64"
    ).toString("utf8");

    serviceAccount = JSON.parse(decoded);
} else {
    /* Local file se load karo */
    serviceAccount = require("./firebase-service-account.json");
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;