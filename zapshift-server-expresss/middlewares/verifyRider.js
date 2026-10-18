import { usersCollection } from "../config/db.js"; // live binding, filled after connectDB()

// ================= RIDER MIDDLEWARE =================
// Use AFTER verifyFBToken. Lets the request through only if the
// logged-in user has role "rider" in the users collection.
export const verifyRider = async (req, res, next) => {
  try {
    const email = req.decodedToken?.email?.toLowerCase();
    const user = await usersCollection.findOne({ email });

    if (!user || user.role !== "rider") {
      return res.status(403).send({ message: "Forbidden: riders only" });
    }

    next();
  } catch (error) {
    console.error("Rider check failed:", error);
    res.status(500).send({ message: "Failed to verify rider" });
  }
};
