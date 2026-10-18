import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import { verifyRider } from "../middlewares/verifyRider.js";
import {
  getRiderPendingParcels,
  getRiderCompletedDeliveries,
  updateRiderParcelStatus,
  failRiderParcel,
} from "../controllers/riderTask.controller.js";
import { getRiderOverview } from "../controllers/finance.controller.js";

const router = Router(); // mounted at /rider in routes/index.js (the logged-in rider's own work)

router.use(verifyFBToken, verifyRider); // every route below is for logged-in riders only

router.get("/parcels/pending", getRiderPendingParcels); // GET   /rider/parcels/pending
router.get("/completed-deliveries", getRiderCompletedDeliveries); // GET   /rider/completed-deliveries
router.patch("/parcels/:id/status", updateRiderParcelStatus); // PATCH /rider/parcels/:id/status
router.patch("/parcels/:id/fail", failRiderParcel); // PATCH /rider/parcels/:id/fail
router.get("/overview", getRiderOverview); // GET   /rider/overview

export default router;
