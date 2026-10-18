import { getAuth } from "../config/firebase.js"; // also makes sure Firebase is initialized

// ================= AUTH MIDDLEWARE =================
export const verifyFBToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).send({ message: "Unauthorized: token missing" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await getAuth().verifyIdToken(token);

    req.decodedToken = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).send({ message: "Unauthorized: invalid token" });
  }
};
