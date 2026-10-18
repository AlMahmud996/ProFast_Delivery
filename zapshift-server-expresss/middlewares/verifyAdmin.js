import { usersCollection } from "../config/db.js"; // live binding, filled after connectDB()

// ================= ADMIN MIDDLEWARE =================
// Use AFTER verifyFBToken. Lets the request through only if the
// logged-in user has role "admin" in the users collection.
export const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decodedToken?.email?.toLowerCase();
    const user = await usersCollection.findOne({ email });

    if (!user || user.role !== "admin") {
      return res.status(403).send({ message: "Forbidden: admins only" });
    }

    next();
  } catch (error) {
    console.error("Admin check failed:", error);
    res.status(500).send({ message: "Failed to verify admin" });
  }
};
