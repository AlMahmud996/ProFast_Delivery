import { Router } from "express";
import { verifyFBToken } from "../middlewares/verifyFBToken.js";
import {
  quoteParcel,
  createParcel,
  getMyParcels,
  getParcelById,
  deleteParcel,
} from "../controllers/parcel.controller.js";

const router = Router(); // mounted at /parcels in routes/index.js

router.post("/quote", quoteParcel); // POST   /parcels/quote
router.post("/", createParcel); // POST   /parcels
router.get("/", verifyFBToken, getMyParcels); // GET    /parcels
router.get("/:id", verifyFBToken, getParcelById); // GET    /parcels/:id
router.delete("/:id", verifyFBToken, deleteParcel); // DELETE /parcels/:id

export default router;
