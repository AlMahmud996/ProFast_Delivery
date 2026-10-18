import { ObjectId } from "mongodb";
import { parcelsCollection } from "../config/db.js"; // live binding
import { PRICING } from "../constants/pricing.js";
import { getRegion } from "../utils/geo.js";
import { calculatePrice } from "../utils/pricing.js";

// ================= PARCEL ROUTES =================

// Checks the fields the price depends on. Returns an error message or null.
const validatePriceInput = (body) => {
  if (!["document", "non-document"].includes(body.parcelType)) {
    return "Parcel type must be document or non-document";
  }
  if (!body.senderServiceCenter || !body.receiverServiceCenter) {
    return "Choose the sender and receiver service centers";
  }
  const weight = Number(body.weight ?? body.parcelWeight ?? 0);
  if (!Number.isFinite(weight) || weight < 0) return "Enter a valid weight";
  if (weight > PRICING.maxWeightKg) return `Maximum weight is ${PRICING.maxWeightKg} kg`;
  return null;
};

// Price preview for the Send Parcel form (same calculation as booking)
export const quoteParcel = async (req, res) => {
  const problem = validatePriceInput(req.body || {});
  if (problem) return res.status(400).send({ message: problem });
  res.send(calculatePrice(req.body));
};

// Create a parcel (used by the Send Parcel form)
export const createParcel = async (req, res) => {
  try {
    const parcel = { ...req.body };

    const problem = validatePriceInput(parcel);
    if (problem) return res.status(400).send({ message: problem });

    // Keep the email lowercase so it always matches the queries below
    if (parcel.created_by) {
      parcel.created_by = parcel.created_by.toLowerCase();
    }

    // Fill in regions from the service centers if the form didn't send them
    parcel.senderRegion = parcel.senderRegion || getRegion(parcel, "sender");
    parcel.receiverRegion = parcel.receiverRegion || getRegion(parcel, "receiver");

    // The server's price replaces whatever the browser sent
    const price = calculatePrice(parcel);
    parcel.weight = price.weight;
    parcel.cost = price.total;
    parcel.costBreakdown = price.breakdown;
    parcel.deliveryCharge = price.deliveryCharge;
    parcel.lineHaulFee = price.lineHaulFee;
    parcel.deliveryType = price.deliveryType;
    parcel.routeType = price.routeType;
    parcel.paymentStatus = "unpaid"; // can't create an already-paid parcel
    delete parcel._id;

    const result = await parcelsCollection.insertOne(parcel);
    // insertedId + the final price, so the form can show what will be charged
    res.status(201).send({ ...result, cost: price.total, costBreakdown: price.breakdown });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to create parcel" });
  }
};

// Get the logged-in user's parcels
export const getMyParcels = async (req, res) => {
  try {
    const tokenEmail = req.decodedToken.email?.toLowerCase();
    const requestedEmail = req.query.email?.toLowerCase();

    if (!tokenEmail) {
      return res.status(403).send({ message: "User email not available" });
    }

    if (requestedEmail && requestedEmail !== tokenEmail) {
      return res
        .status(403)
        .send({ message: "You cannot view another user's parcels" });
    }

    const parcels = await parcelsCollection
      .find({ created_by: tokenEmail })
      .sort({ creationDate: -1, _id: -1 })
      .toArray();

    res.send(parcels);
  } catch (error) {
    console.error("Fetch parcels error:", error);
    res.status(500).send({ message: "Failed to fetch parcels" });
  }
};

// Get a single parcel by id (owner only)
export const getParcelById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const parcel = await parcelsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    if (
      parcel.created_by?.toLowerCase() !==
      req.decodedToken.email?.toLowerCase()
    ) {
      return res
        .status(403)
        .send({ message: "You cannot view this parcel" });
    }

    res.send(parcel);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch parcel" });
  }
};

// Delete a parcel by id (owner only, unpaid only)
export const deleteParcel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const result = await parcelsCollection.deleteOne({
      _id: new ObjectId(id),
      created_by: req.decodedToken.email?.toLowerCase(),
      paymentStatus: { $ne: "paid" },
    });

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to delete parcel" });
  }
};
