import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import { getMyTracking, getTrackingByNumber } from "../controllers/tracking.controller.js";

const router = Router(); // mounted at /tracking in routes/index.js

router.get("/", verifyFBToken, getMyTracking); // GET /tracking              (logged-in user's updates)
router.get("/:tracking_no", getTrackingByNumber); // GET /tracking/:tracking_no (public, like a courier site)

export default router;
