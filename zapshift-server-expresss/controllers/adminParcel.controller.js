import { ObjectId } from "mongodb";
import { parcelsCollection, ridersCollection, trackingCollection } from "../config/db.js"; // live bindings
import { PENDING_ASSIGNMENT_FILTER, TRACKER_FILTERS } from "../constants/delivery.js";
import { getRegion, distanceKm } from "../utils/geo.js";
import { getRouteType, getAssignmentLeg, getLegLocation } from "../utils/delivery.js";
import { describeLocation, buildJourney } from "../utils/journey.js";
import { getRiderLoads, assignRider } from "../services/rider.service.js";

// ================= ADMIN: ASSIGN RIDER ROUTES =================

// Paid parcels waiting for a pickup rider (oldest payment first)
export const getPendingAssignment = async (req, res) => {
  try {
    const parcels = await parcelsCollection
      .find(PENDING_ASSIGNMENT_FILTER)
      .sort({ paid_at: 1, creationDate: 1, _id: 1 })
      .toArray();

    // Add the regions and the leg so the admin can see what kind of rider is needed
    const withRegions = parcels.map((p) => ({
      ...p,
      senderRegion: getRegion(p, "sender"),
      receiverRegion: getRegion(p, "receiver"),
      routeType: getRouteType(p),
      leg: getAssignmentLeg(p),
    }));

    res.send(withRegions);
  } catch (error) {
    console.error("Fetch pending assignment error:", error);
    res.status(500).send({ message: "Failed to fetch parcels" });
  }
};

// Number of parcels waiting for a rider (for the admin notification badge)
export const getPendingAssignmentCount = async (req, res) => {
  try {
    const count = await parcelsCollection.countDocuments(
      PENDING_ASSIGNMENT_FILTER
    );
    res.send({ count });
  } catch (error) {
    console.error("Count pending assignment error:", error);
    res.status(500).send({ message: "Failed to count parcels" });
  }
};

// Active riders to choose from for one parcel.
// The location is the sender's service center for a pickup, the receiver's for a delivery.
// Sorted: same service center first, then same region, then least busy.
export const getAvailableRiders = async (req, res) => {
  try {
    const { parcelId } = req.query;

    if (!ObjectId.isValid(parcelId)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const parcel = await parcelsCollection.findOne({
      _id: new ObjectId(parcelId),
    });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    const leg = getAssignmentLeg(parcel);
    const { district: pickupDistrict, region: pickupRegion } = getLegLocation(parcel, leg);

    const riders = await ridersCollection
      .find({ status: "active" })
      .project({ name: 1, email: 1, contact: 1, region: 1, warehouse: 1 })
      .toArray();

    const loads = await getRiderLoads(riders.map((r) => r._id.toString()));

    // Riders based in the same district first, then the NEAREST districts
    // (by distance between service centers), then the least busy.
    const list = riders
      .map((r) => ({
        ...r,
        busyParcels: loads[r._id.toString()] || 0,
        sameDistrict: r.warehouse === pickupDistrict,
        sameRegion: !!pickupRegion && r.region === pickupRegion,
        distanceKm: distanceKm(pickupDistrict, r.warehouse),
      }))
      .sort(
        (a, b) =>
          Number(b.sameDistrict) - Number(a.sameDistrict) ||
          (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
          Number(b.sameRegion) - Number(a.sameRegion) ||
          a.busyParcels - b.busyParcels ||
          (a.name || "").localeCompare(b.name || "")
      );

    // pickupDistrict / pickupRegion = where the rider has to go for this leg
    res.send({
      leg,
      pickupDistrict,
      pickupRegion,
      hasRiderInDistrict: list.some((r) => r.sameDistrict),
      riders: list,
    });
  } catch (error) {
    console.error("Fetch available riders error:", error);
    res.status(500).send({ message: "Failed to fetch riders" });
  }
};

// Admin assigns (or changes) the rider of a paid parcel:
// the pickup rider, or the delivery rider once it reached the destination warehouse
export const assignRiderToParcel = async (req, res) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(riderId)) {
      return res.status(400).send({ message: "Invalid parcel or rider id" });
    }

    const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    if (parcel.paymentStatus !== "paid") {
      return res
        .status(400)
        .send({ message: "Only paid parcels can get a rider" });
    }

    // Can assign while waiting, or change the rider before they start
    const allowed = [
      undefined,
      null,
      "pending_assignment",
      "rider_assigned",
      "at_destination_hub",
      "delivery_rider_assigned",
      "return_at_origin_hub",
      "return_rider_assigned",
    ];
    if (!allowed.includes(parcel.deliveryStatus)) {
      return res.status(400).send({
        message: `This parcel is already ${parcel.deliveryStatus.replaceAll("_", " ")}`,
      });
    }

    const leg = getAssignmentLeg(parcel);

    const rider = await ridersCollection.findOne({
      _id: new ObjectId(riderId),
      status: "active",
    });

    if (!rider) {
      return res
        .status(404)
        .send({ message: "Rider not found or not active" });
    }

    if (parcel.assigned_rider_id === riderId) {
      return res
        .status(400)
        .send({ message: "This rider is already assigned to the parcel" });
    }

    const result = await assignRider(
      parcel,
      rider,
      req.decodedToken.email?.toLowerCase(),
      leg
    );

    res.send({ ...result, rider_name: rider.name, leg }); // contains modifiedCount
  } catch (error) {
    console.error("Assign rider error:", error);
    res.status(500).send({ message: "Failed to assign rider" });
  }
};

// ================= WHERE IS THE PARCEL NOW =================

// All parcels for admins, newest first, with search and pagination
export const getAdminParcels = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 10));
    const filter = { ...(TRACKER_FILTERS[req.query.status] || {}) };

    const term = String(req.query.search || "").trim();
    if (term) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = { $regex: safe, $options: "i" };
      filter.$or = [
        { tracking_no: rx },
        { trackingId: rx },
        { parcelName: rx },
        { created_by: rx },
        { senderName: rx },
        { receiverName: rx },
        { assigned_rider_name: rx },
      ];
    }

    const [total, parcels] = await Promise.all([
      parcelsCollection.countDocuments(filter),
      parcelsCollection
        .find(filter)
        .sort({ creationDate: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    res.send({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      parcels: parcels.map((p) => ({
        _id: p._id,
        parcelName: p.parcelName,
        parcelType: p.parcelType,
        tracking_no: p.tracking_no,
        trackingId: p.trackingId,
        cost: p.cost,
        paymentStatus: p.paymentStatus,
        deliveryStatus: p.deliveryStatus,
        routeType: getRouteType(p),
        creationDate: p.creationDate,
        senderName: p.senderName,
        senderEmail: p.created_by,
        senderServiceCenter: p.senderServiceCenter,
        receiverName: p.receiverName,
        receiverServiceCenter: p.receiverServiceCenter,
        pickupRider: p.pickup_rider?.name || null,
        deliveryRider: p.delivery_rider?.name || null,
        currentRider: p.assigned_rider_name || null,
        failedAttemptCount: (p.failedAttempts || []).length,
        location: describeLocation(p),
      })),
    });
  } catch (error) {
    console.error("Admin parcels error:", error);
    res.status(500).send({ message: "Failed to load parcels" });
  }
};

// One parcel's full journey for admins: who sent it, every rider, where it is, timeline
export const getParcelJourney = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });
    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    const timeline = await trackingCollection
      .find({ parcelId: id })
      .sort({ created_at: 1, _id: 1 })
      .toArray();

    res.send({
      parcel: { ...parcel, routeType: getRouteType(parcel) },
      location: describeLocation(parcel),
      journey: buildJourney(parcel),
      timeline,
    });
  } catch (error) {
    console.error("Admin parcel journey error:", error);
    res.status(500).send({ message: "Failed to load the parcel" });
  }
};
