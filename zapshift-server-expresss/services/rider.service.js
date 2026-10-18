import { parcelsCollection, ridersCollection, earningsCollection } from "../config/db.js"; // live bindings
import { BUSY_DELIVERY_STATUSES, LEG_CONFIG } from "../constants/delivery.js";
import { getRouteType, getLegLocation } from "../utils/delivery.js";
import { riderPay } from "../utils/pricing.js";
import { notify, notifyAdmins, addTracking } from "./notification.service.js";

// ================= RIDER ASSIGNMENT HELPERS =================

// How many busy parcels each rider has, e.g. { "<riderId>": 2 }
export const getRiderLoads = async (riderIds) => {
  if (riderIds.length === 0) return {};

  const rows = await parcelsCollection
    .aggregate([
      {
        $match: {
          assigned_rider_id: { $in: riderIds },
          deliveryStatus: { $in: BUSY_DELIVERY_STATUSES },
        },
      },
      { $group: { _id: "$assigned_rider_id", count: { $sum: 1 } } },
    ])
    .toArray();

  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

// Pick a rider automatically, choosing the one with the fewest busy parcels.
//   pickup:          a rider at the sender's service center, otherwise anywhere in that region
//   delivery/return: ONLY a rider based at that warehouse's district.
//                    If there is none, nobody is auto-assigned: the admin is notified and
//                    chooses a rider from a nearby district (e.g. Narail for Magura).
export const findAutoRider = async (parcel, leg = "pickup") => {
  const { district, region } = getLegLocation(parcel, leg);

  let candidates = await ridersCollection
    .find({ status: "active", warehouse: district })
    .toArray();

  if (candidates.length === 0 && region && leg === "pickup") {
    candidates = await ridersCollection
      .find({ status: "active", region })
      .toArray();
  }

  if (candidates.length === 0) return null;

  const loads = await getRiderLoads(candidates.map((r) => r._id.toString()));

  candidates.sort(
    (a, b) => (loads[a._id.toString()] || 0) - (loads[b._id.toString()] || 0)
  );

  return candidates[0];
};

// Assign a rider to a paid parcel for a leg ("pickup", "delivery" or "return"),
// add a tracking update the sender can see, and tell the rider about the new job.
// assignedBy is "auto" or the admin's email.
// assigned_rider_* always holds the CURRENT rider; pickup_rider / delivery_rider /
// return_rider keep the history.
export const assignRider = async (parcel, rider, assignedBy, leg = "pickup") => {
  const now = new Date().toISOString();
  const cfg = LEG_CONFIG[leg];
  const isReassign =
    parcel.assigned_rider_id && parcel.assigned_rider_id !== rider._id.toString();

  const legDistrict = getLegLocation(parcel, leg).district;
  const fromOtherDistrict = !!rider.warehouse && rider.warehouse !== legDistrict;

  const riderInfo = {
    id: rider._id.toString(),
    name: rider.name,
    email: rider.email?.toLowerCase(),
    contact: rider.contact,
    district: rider.warehouse,
    // true when an admin sent a rider from a nearby district
    fromOtherDistrict,
  };

  const result = await parcelsCollection.updateOne(
    { _id: parcel._id },
    {
      $set: {
        deliveryStatus: cfg.status,
        routeType: getRouteType(parcel),
        assigned_rider_id: riderInfo.id,
        assigned_rider_name: riderInfo.name,
        assigned_rider_email: riderInfo.email,
        assigned_rider_contact: riderInfo.contact,
        assigned_at: now,
        assigned_by: assignedBy,
        [cfg.field]: riderInfo,
      },
      $unset: { assignment_reason: "" },
    }
  );

  let message;
  const fromText = fromOtherDistrict ? ` (from ${rider.warehouse})` : "";
  if (leg === "delivery") {
    message = isReassign
      ? `Delivery rider changed to ${rider.name}${fromText}.`
      : `Rider ${rider.name}${fromText} will collect your parcel from the ${parcel.receiverServiceCenter} warehouse and deliver it.`;
  } else if (leg === "return") {
    message = isReassign
      ? `Return rider changed to ${rider.name}${fromText}.`
      : `Rider ${rider.name}${fromText} will bring your returned parcel back to you from the ${parcel.senderServiceCenter} warehouse.`;
  } else {
    message = isReassign
      ? `Pickup rider changed to ${rider.name}.`
      : `Rider ${rider.name} has been assigned to pick up your parcel from ${parcel.senderServiceCenter}.`;
  }

  await addTracking({
    tracking_no: parcel.tracking_no,
    parcelId: parcel._id.toString(),
    created_by: parcel.created_by?.toLowerCase(),
    status: cfg.status,
    message,
    rider_name: rider.name,
    assigned_by: assignedBy === "auto" ? "auto" : "admin",
    created_at: now,
  });

  // Tell the rider about the new job
  const jobText = {
    pickup: `Pick up "${parcel.parcelName}" from ${parcel.senderServiceCenter}.`,
    delivery: `Collect "${parcel.parcelName}" from the ${parcel.receiverServiceCenter} warehouse and deliver it.`,
    return: `Collect returned "${parcel.parcelName}" from the ${parcel.senderServiceCenter} warehouse and bring it back to the sender.`,
  };
  await notify(riderInfo.email, {
    type: "new_job",
    title: leg === "return" ? "New return job" : "New job assigned to you",
    message: jobText[leg],
    link: "/dashboard/pending-deliveries",
    parcelId: parcel._id.toString(),
    tracking_no: parcel.tracking_no,
  });

  return result;
};

// Save what a rider earned for finishing a leg.
// leg: "full" (local), "pickup", "delivery" or "return" (inter-region)
// returned: true when the job ended with the parcel going back to the sender
export const recordEarning = async (parcel, leg, completedAt, { returned = false } = {}) => {
  const cost = Number(parcel.cost) || 0;
  const pay = riderPay(parcel, leg);

  const senderPlace = parcel.senderAddress || parcel.senderServiceCenter;
  const receiverPlace = parcel.receiverAddress || parcel.receiverServiceCenter;

  // Where this rider's job started and ended
  const route = {
    full: [senderPlace, returned ? `${senderPlace} (returned)` : receiverPlace],
    pickup: [senderPlace, `${parcel.senderServiceCenter} warehouse`],
    delivery: [
      `${parcel.receiverServiceCenter} warehouse`,
      returned ? `${parcel.receiverServiceCenter} warehouse (returned)` : receiverPlace,
    ],
    return: [`${parcel.senderServiceCenter} warehouse`, `${senderPlace} (returned)`],
  }[leg];

  try {
    await earningsCollection.insertOne({
      parcelId: parcel._id.toString(),
      leg,
      returned,
      riderId: parcel.assigned_rider_id,
      riderName: parcel.assigned_rider_name,
      riderEmail: parcel.assigned_rider_email?.toLowerCase(),
      parcelName: parcel.parcelName,
      parcelType: parcel.parcelType,
      tracking_no: parcel.tracking_no,
      routeType: getRouteType(parcel),
      from: parcel.senderServiceCenter,
      to: parcel.receiverServiceCenter,
      startPoint: route[0],
      endPoint: route[1],
      receiverName: leg === "pickup" || leg === "return" ? null : parcel.receiverName,
      parcelCost: cost,
      // Riders are paid from the delivery charge (price without the line-haul fee)
      payBase: pay.base,
      sharePercent: pay.sharePercent,
      capped: pay.capped,
      amount: pay.amount,
      assigned_at: parcel.assigned_at,
      // when the rider took the parcel for this job
      picked_up_at:
        leg === "delivery"
          ? parcel.out_for_delivery_at || completedAt
          : leg === "return"
          ? parcel.return_out_for_delivery_at || completedAt
          : parcel.picked_up_at,
      completed_at: completedAt,
    });
  } catch (error) {
    // 11000 = already recorded (unique index), anything else is a real error
    if (error.code !== 11000) throw error;
  }
};

// Mark a paid parcel as waiting for an admin to choose a rider
export const markPendingAssignment = async (parcel, reason) => {
  await parcelsCollection.updateOne(
    { _id: parcel._id },
    { $set: { deliveryStatus: "pending_assignment", assignment_reason: reason } }
  );

  await addTracking({
    tracking_no: parcel.tracking_no,
    parcelId: parcel._id.toString(),
    created_by: parcel.created_by?.toLowerCase(),
    status: "pending_assignment",
    message:
      reason === "inter_region"
        ? "Inter-region parcel. Our team will assign a pickup rider shortly."
        : "No rider is free in your area right now. Our team will assign one shortly.",
    created_at: new Date().toISOString(),
  });

  await notifyAdmins({
    type: "needs_rider",
    title: "Parcel needs a rider",
    message: `"${parcel.parcelName}" (${parcel.senderServiceCenter} → ${parcel.receiverServiceCenter}) is paid and waiting for a pickup rider.`,
    link: "/dashboard/assign-rider",
    parcelId: parcel._id.toString(),
    tracking_no: parcel.tracking_no,
  });
};
