import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import { verifyAdmin } from "../middlewares/verifyAdmin.js";
import {
  applyAsRider,
  getPendingRiders,
  getActiveRiders,
  updateRiderStatus,
} from "../controllers/rider.controller.js";

const router = Router(); // mounted at /riders in routes/index.js (rider APPLICATIONS and approval)

router.post("/", verifyFBToken, applyAsRider); // POST  /riders
router.get("/pending", verifyFBToken, verifyAdmin, getPendingRiders); // GET   /riders/pending
router.get("/active", verifyFBToken, verifyAdmin, getActiveRiders); // GET   /riders/active
router.patch("/:id/status", verifyFBToken, verifyAdmin, updateRiderStatus); // PATCH /riders/:id/status

export default router;
