import { createRequire } from "module"; // this file is an ES module, so "require" doesn't exist by default

// createRequire gives us a normal require function.
const require = createRequire(import.meta.url);

// Newer firebase-admin versions only support these sub-path imports
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const serviceAccount = process.env.FB_SERVICE_KEY
  ? JSON.parse(Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf8"))
  : require("../firebase-admin_key.json");
// ================= FIREBASE ADMIN =================
// Initialize ONCE, with the service account key
initializeApp({
  credential: cert(serviceAccount),
});

export { getAuth }; // used by the token middleware
