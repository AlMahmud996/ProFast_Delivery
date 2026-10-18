import { parcelsCollection, trackingCollection } from "../config/db.js"; // live bindings
import { getRouteType } from "../utils/delivery.js";

// ================= TRACKING ROUTES =================

// Tracking notifications for the logged-in user
export const getMyTracking = async (req, res) => {
  try {
    const tokenEmail = req.decodedToken.email?.toLowerCase();
    const requestedEmail = req.query.email?.toLowerCase();

    if (!tokenEmail) {
      return res.status(403).send({ message: "User email not available" });
    }

    if (requestedEmail && requestedEmail !== tokenEmail) {
      return res
        .status(403)
        .send({ message: "You cannot view another user's tracking" });
    }

    const updates = await trackingCollection
      .find({ created_by: tokenEmail })
      .sort({ created_at: -1, _id: -1 })
      .toArray();

    res.send(updates);
  } catch (error) {
    console.error("Fetch tracking error:", error);
    res.status(500).send({ message: "Failed to fetch tracking updates" });
  }
};

// Full timeline by 6-digit tracking number (public, like a courier site)
export const getTrackingByNumber = async (req, res) => {
  try {
    const { tracking_no } = req.params;

    const parcel = await parcelsCollection.findOne({ tracking_no });

    if (!parcel) {
      return res
        .status(404)
        .send({ message: "No parcel found with this tracking number" });
    }

    const timeline = await trackingCollection
      .find({ tracking_no })
      .sort({ created_at: 1, _id: 1 })
      .toArray();

    res.send({
      parcel: {
        parcelName: parcel.parcelName,
        parcelType: parcel.parcelType,
        tracking_no: parcel.tracking_no,
        senderServiceCenter: parcel.senderServiceCenter,
        receiverServiceCenter: parcel.receiverServiceCenter,
        creationDate: parcel.creationDate,
        // Delivery progress for the Track page
        deliveryStatus: parcel.deliveryStatus || "pending_assignment",
        routeType: getRouteType(parcel),
        assigned_rider_name: parcel.assigned_rider_name || null,
      },
      timeline,
    });
  } catch (error) {
    console.error("Fetch tracking timeline error:", error);
    res.status(500).send({ message: "Failed to fetch tracking data" });
  }
};
