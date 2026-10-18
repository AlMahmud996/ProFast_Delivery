import { ObjectId } from "mongodb";
import { ridersCollection, usersCollection, parcelsCollection } from "../config/db.js"; // live bindings
import { notifyAdmins, addTracking } from "../services/notification.service.js";

// ================= RIDER ROUTES =================

// Submit a rider application (logged-in users only, one per email)
export const applyAsRider = async (req, res) => {
  try {
    const tokenEmail = req.decodedToken.email?.toLowerCase();

    if (!tokenEmail) {
      return res.status(403).send({ message: "User email not available" });
    }

    const existing = await ridersCollection.findOne({ email: tokenEmail });

    if (existing) {
      return res.status(409).send({
        message: `You have already applied. Status: ${existing.status}`,
      });
    }

    const rider = {
      ...req.body,
      email: tokenEmail, // always use the email from the token
      status: "pending", // the client can't approve itself
      created_at: new Date().toISOString(),
    };

    const result = await ridersCollection.insertOne(rider);

    await notifyAdmins({
      type: "rider_application",
      title: "New rider application",
      message: `${rider.name || tokenEmail} applied to be a rider in ${rider.warehouse || rider.region || "your area"}.`,
      link: "/dashboard/pending-riders",
    });

    res.status(201).send(result); // contains insertedId
  } catch (error) {
    console.error("Rider application error:", error);
    res.status(500).send({ message: "Failed to submit application" });
  }
};

// Get all rider applications with "pending" status (newest first)
export const getPendingRiders = async (req, res) => {
  try {
    const pendingRiders = await ridersCollection
      .find({ status: "pending" })
      .sort({ created_at: -1, _id: -1 })
      .toArray();

    res.send(pendingRiders);
  } catch (error) {
    console.error("Fetch pending riders error:", error);
    res.status(500).send({ message: "Failed to fetch pending riders" });
  }
};

// Get all approved riders (most recently approved first)
export const getActiveRiders = async (req, res) => {
  try {
    const activeRiders = await ridersCollection
      .find({ status: "active" })
      .sort({ reviewed_at: -1, _id: -1 })
      .toArray();

    res.send(activeRiders);
  } catch (error) {
    console.error("Fetch active riders error:", error);
    res.status(500).send({ message: "Failed to fetch active riders" });
  }
};

// Approve ("active"), reject ("rejected") or deactivate ("inactive") a rider
export const updateRiderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid rider id" });
    }

    if (!["active", "rejected", "inactive"].includes(status)) {
      return res.status(400).send({ message: "Invalid status" });
    }

    const rider = await ridersCollection.findOne({ _id: new ObjectId(id) });

    if (!rider) {
      return res.status(404).send({ message: "Rider application not found" });
    }

    const result = await ridersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.decodedToken.email?.toLowerCase(),
        },
      }
    );

    // An approved rider gets the "rider" role in the users collection,
    // a deactivated or rejected rider goes back to a normal "user"
    if (status === "active") {
      await usersCollection.updateOne(
        { email: rider.email },
        { $set: { role: "rider" } }
      );
    } else {
      await usersCollection.updateOne(
        { email: rider.email, role: "rider" },
        { $set: { role: "user" } }
      );

      // Parcels this rider hasn't started yet go back to the admin's queue:
      // a pickup waits for a new pickup rider, a delivery stays at the warehouse
      const waitingParcels = await parcelsCollection
        .find({
          assigned_rider_id: id,
          deliveryStatus: { $in: ["rider_assigned", "delivery_rider_assigned", "return_rider_assigned"] },
        })
        .toArray();

      for (const parcel of waitingParcels) {
        // Back to the queue it came from: pickup -> pending_assignment,
        // delivery -> destination warehouse, return -> origin warehouse
        const requeue = {
          rider_assigned: { status: "pending_assignment", field: "pickup_rider", label: "pickup" },
          delivery_rider_assigned: { status: "at_destination_hub", field: "delivery_rider", label: "delivery" },
          return_rider_assigned: { status: "return_at_origin_hub", field: "return_rider", label: "return" },
        }[parcel.deliveryStatus];

        await parcelsCollection.updateOne(
          { _id: parcel._id },
          {
            $set: {
              deliveryStatus: requeue.status,
              assignment_reason: "rider_unavailable",
            },
            $unset: {
              [requeue.field]: "",
              assigned_rider_id: "",
              assigned_rider_name: "",
              assigned_rider_email: "",
              assigned_rider_contact: "",
              assigned_at: "",
              assigned_by: "",
            },
          }
        );

        await addTracking({
          tracking_no: parcel.tracking_no,
          parcelId: parcel._id.toString(),
          created_by: parcel.created_by?.toLowerCase(),
          status: requeue.status,
          message: `Your ${requeue.label} rider is no longer available. Our team will assign a new rider shortly.`,
          created_at: new Date().toISOString(),
        });

        await notifyAdmins({
          type: "needs_rider",
          title: "Parcel needs a new rider",
          message: `"${parcel.parcelName}" lost its ${requeue.label} rider (deactivated). Assign a new one.`,
          link: "/dashboard/assign-rider",
          parcelId: parcel._id.toString(),
          tracking_no: parcel.tracking_no,
        });
      }
    }

    res.send(result); // contains modifiedCount
  } catch (error) {
    console.error("Update rider status error:", error);
    res.status(500).send({ message: "Failed to update rider status" });
  }
};
