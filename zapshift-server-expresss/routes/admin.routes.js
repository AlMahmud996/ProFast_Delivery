import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import { verifyAdmin } from "../middlewares/verifyAdmin.js";
import { getHubParcels, getHubCount, dispatchParcel, arriveParcel } from "../controllers/hub.controller.js";
import { getAdminOverview } from "../controllers/finance.controller.js";
import {
  getPendingAssignment,
  getPendingAssignmentCount,
  getAvailableRiders,
  assignRiderToParcel,
  getAdminParcels,
  getParcelJourney,
} from "../controllers/adminParcel.controller.js";
import { getAnalytics } from "../controllers/analytics.controller.js";

const router = Router(); // mounted at /admin in routes/index.js

router.use(verifyFBToken, verifyAdmin); // every route below is for admins only

// ----- warehouse / truck transfers -----
router.get("/parcels/hub", getHubParcels); // GET   /admin/parcels/hub
router.get("/parcels/hub/count", getHubCount); // GET   /admin/parcels/hub/count
router.patch("/parcels/:id/dispatch", dispatchParcel); // PATCH /admin/parcels/:id/dispatch
router.patch("/parcels/:id/arrive", arriveParcel); // PATCH /admin/parcels/:id/arrive

// ----- home + money -----
router.get("/overview", getAdminOverview); // GET   /admin/overview

// ----- assign rider -----
router.get("/parcels/pending-assignment", getPendingAssignment); // GET   /admin/parcels/pending-assignment
router.get("/parcels/pending-assignment/count", getPendingAssignmentCount); // GET   /admin/parcels/pending-assignment/count
router.get("/riders/available", getAvailableRiders); // GET   /admin/riders/available?parcelId=
router.patch("/parcels/:id/assign-rider", assignRiderToParcel); // PATCH /admin/parcels/:id/assign-rider

// ----- parcel tracker -----
router.get("/parcels", getAdminParcels); // GET   /admin/parcels
router.get("/parcels/:id/journey", getParcelJourney); // GET   /admin/parcels/:id/journey

// ----- analytics -----
router.get("/analytics", getAnalytics); // GET   /admin/analytics

export default router;
