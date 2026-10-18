import { ObjectId } from "mongodb";
import { parcelsCollection, earningsCollection } from "../config/db.js"; // live bindings
import {
  RIDER_ACTIVE_STATUSES,
  RETURN_STATUSES,
  RIDER_SHARE,
  RIDER_PAY_CAP,
  MAX_DELIVERY_ATTEMPTS,
  FAILED_REASONS,
} from "../constants/delivery.js";
import { getRouteType, getNextRiderStep, canFailDelivery, getCurrentLeg } from "../utils/delivery.js";
import { riderPay } from "../utils/pricing.js";
import { roundMoney } from "../utils/money.js";
import { addTracking, notifyAdmins } from "../services/notification.service.js";
import { recordEarning } from "../services/rider.service.js";

// ================= RIDER: DELIVERY TASKS =================

// The logged-in rider's unfinished jobs (oldest assignment first).
// The email comes from the token, so a rider can only see their own tasks.
export const getRiderPendingParcels = async (req, res) => {
  try {
    const riderEmail = req.decodedToken.email?.toLowerCase();

    const parcels = await parcelsCollection
      .find({
        assigned_rider_email: riderEmail,
        deliveryStatus: { $in: RIDER_ACTIVE_STATUSES },
      })
      .sort({ assigned_at: 1, _id: 1 })
      .toArray();

    // Tell the page which job this is, what the next button does and what it pays
    const withSteps = parcels.map((p) => {
      const routeType = getRouteType(p);
      const leg = getCurrentLeg(p);

      return {
        ...p,
        routeType,
        leg,
        nextStep: getNextRiderStep(p),
        // "Failed attempt" button is shown only at the last step before delivered
        canFail: canFailDelivery(p),
        failedAttemptCount: (p.failedAttempts || []).length,
        maxAttempts: MAX_DELIVERY_ATTEMPTS,
        isReturn: RETURN_STATUSES.includes(p.deliveryStatus),
        sharePercent: RIDER_SHARE[leg] * 100,
        estimatedEarning: riderPay(p, leg).amount,
        payBase: riderPay(p, leg).base,
        payCapped: riderPay(p, leg).capped,
      };
    });

    res.send(withSteps);
  } catch (error) {
    console.error("Fetch rider pending parcels error:", error);
    res.status(500).send({ message: "Failed to fetch pending deliveries" });
  }
};

// The logged-in rider's finished jobs and earnings (newest first)
export const getRiderCompletedDeliveries = async (req, res) => {
  try {
    const riderEmail = req.decodedToken.email?.toLowerCase();

    const history = await earningsCollection
      .find({ riderEmail })
      .sort({ completed_at: -1, _id: -1 })
      .toArray();

    const totalEarned = roundMoney(history.reduce((sum, e) => sum + (e.amount || 0), 0));

    res.send({
      totalEarned,
      totalJobs: history.length,
      shares: {
        full: RIDER_SHARE.full * 100,
        pickup: RIDER_SHARE.pickup * 100,
        delivery: RIDER_SHARE.delivery * 100,
        return: RIDER_SHARE.return * 100,
      },
      caps: RIDER_PAY_CAP,
      history,
    });
  } catch (error) {
    console.error("Fetch rider completed deliveries error:", error);
    res.status(500).send({ message: "Failed to fetch completed deliveries" });
  }
};

// Rider moves a parcel to its next step. Allowed steps depend on the route:
//   local:          rider_assigned -> picked_up -> in_transit -> delivered        (full)
//   inter-region 1: rider_assigned -> picked_up -> at_origin_hub                  (pickup)
//   inter-region 3: delivery_rider_assigned -> out_for_delivery -> delivered      (delivery)
//   returns:        returning -> returned (local) / return_at_hub (inter-region)
//                   return_rider_assigned -> return_out_for_delivery -> returned  (return)
export const updateRiderParcelStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const riderEmail = req.decodedToken.email?.toLowerCase();

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    // Only the rider currently assigned to this parcel can update it
    if (parcel.assigned_rider_email?.toLowerCase() !== riderEmail) {
      return res
        .status(403)
        .send({ message: "This parcel is not assigned to you" });
    }

    // Steps must happen in order, no skipping or going back
    const expected = getNextRiderStep(parcel);
    if (!expected || status !== expected) {
      return res.status(400).send({
        message: expected
          ? `Next step for this parcel is "${expected.replaceAll("_", " ")}"`
          : "This parcel can't be updated anymore",
      });
    }

    const now = new Date().toISOString();
    const routeType = getRouteType(parcel);

    const update = { deliveryStatus: status, routeType, [`${status}_at`]: now };
    const unset = {};

    // These steps end the rider's job at a warehouse: the rider is free again
    // (pickup_rider / delivery_rider keep the record)
    if (status === "at_origin_hub" || status === "return_at_hub") {
      Object.assign(unset, {
        assigned_rider_id: "",
        assigned_rider_name: "",
        assigned_rider_email: "",
        assigned_rider_contact: "",
      });
    }

    // The status filter stops two quick clicks from both succeeding
    const result = await parcelsCollection.updateOne(
      { _id: parcel._id, deliveryStatus: parcel.deliveryStatus },
      Object.keys(unset).length ? { $set: update, $unset: unset } : { $set: update }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(409)
        .send({ message: "Parcel was already updated. Please refresh." });
    }

    const updatedParcel = { ...parcel, ...update };

    // Pay the rider when their part of the job is done
    //   delivered       -> full (local) / delivery (inter-region)
    //   at_origin_hub   -> pickup
    //   return_at_hub   -> delivery (the delivery rider tried twice and brought it back)
    //   returned        -> full (local: same rider brought it back) / return (inter-region)
    let earned = null;
    const payLeg = {
      delivered: routeType === "local" ? "full" : "delivery",
      at_origin_hub: "pickup",
      return_at_hub: "delivery",
      returned: routeType === "local" ? "full" : "return",
    }[status];

    if (payLeg) {
      const returned = status === "return_at_hub" || status === "returned";
      await recordEarning(updatedParcel, payLeg, now, { returned });
      const pay = riderPay(parcel, payLeg);
      earned = {
        leg: payLeg,
        sharePercent: pay.sharePercent,
        amount: pay.amount,
        payBase: pay.base,
        capped: pay.capped,
      };
    }

    const messages = {
      picked_up: `Parcel picked up by ${parcel.assigned_rider_name} from ${parcel.senderServiceCenter}.`,
      in_transit: `Parcel is on the way to ${parcel.receiverName || "the receiver"} in ${parcel.receiverServiceCenter}.`,
      at_origin_hub: `Parcel reached the ${parcel.senderServiceCenter} warehouse. It will be sent to ${parcel.receiverServiceCenter} by truck.`,
      out_for_delivery: `Parcel is out for delivery with ${parcel.assigned_rider_name}.`,
      delivered: `Parcel delivered to ${parcel.receiverName || "the receiver"}.`,
      return_at_hub: `Returned parcel is back at the ${parcel.receiverServiceCenter} warehouse. It will be sent back to ${parcel.senderServiceCenter} by truck.`,
      return_out_for_delivery: `Your returned parcel is on the way back to you with ${parcel.assigned_rider_name}.`,
      returned: `Parcel returned to you (${parcel.senderName || "the sender"}).`,
    };

    await addTracking({
      tracking_no: parcel.tracking_no,
      parcelId: parcel._id.toString(),
      created_by: parcel.created_by?.toLowerCase(),
      status,
      message: messages[status],
      rider_name: parcel.assigned_rider_name,
      created_at: now,
    });

    // Admins: a parcel is waiting at a warehouse for a truck
    if (status === "at_origin_hub" || status === "return_at_hub") {
      const where = status === "at_origin_hub" ? parcel.senderServiceCenter : parcel.receiverServiceCenter;
      const to = status === "at_origin_hub" ? parcel.receiverServiceCenter : parcel.senderServiceCenter;
      await notifyAdmins({
        type: "waiting_truck",
        title: status === "return_at_hub" ? "Return waiting for a truck" : "Parcel waiting for a truck",
        message: `"${parcel.parcelName}" is at the ${where} warehouse, ready to go to ${to}.`,
        link: "/dashboard/hub-transfers",
        parcelId: parcel._id.toString(),
        tracking_no: parcel.tracking_no,
      });
    }

    res.send({ ...result, deliveryStatus: status, earned });
  } catch (error) {
    console.error("Rider update status error:", error);
    res.status(500).send({ message: "Failed to update parcel status" });
  }
};

// Rider couldn't deliver (receiver unreachable, refused, ...).
// After MAX_DELIVERY_ATTEMPTS failed attempts the parcel goes back to the sender.
export const failRiderParcel = async (req, res) => {
  try {
    const { id } = req.params;
    const riderEmail = req.decodedToken.email?.toLowerCase();
    const reason = String(req.body?.reason || "");
    const note = String(req.body?.note || "").trim().slice(0, 200);

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }
    if (!FAILED_REASONS[reason]) {
      return res.status(400).send({ message: "Choose a reason" });
    }
    if (reason === "other" && !note) {
      return res.status(400).send({ message: "Write a short note for 'Other reason'" });
    }

    const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }
    if (parcel.assigned_rider_email?.toLowerCase() !== riderEmail) {
      return res.status(403).send({ message: "This parcel is not assigned to you" });
    }
    if (!canFailDelivery(parcel)) {
      return res
        .status(400)
        .send({ message: "You can only report a failed attempt while delivering to the receiver" });
    }

    const now = new Date().toISOString();
    const attempts = [
      ...(parcel.failedAttempts || []),
      {
        reason,
        reasonText: FAILED_REASONS[reason],
        note: note || null,
        rider_name: parcel.assigned_rider_name,
        rider_email: riderEmail,
        at: now,
      },
    ];
    const goBack = attempts.length >= MAX_DELIVERY_ATTEMPTS;

    // The status filter stops two quick clicks from both counting
    const result = await parcelsCollection.updateOne(
      { _id: parcel._id, deliveryStatus: parcel.deliveryStatus },
      {
        $set: {
          failedAttempts: attempts,
          ...(goBack ? { deliveryStatus: "returning", returning_at: now, return_reason: FAILED_REASONS[reason] } : {}),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).send({ message: "Parcel was already updated. Please refresh." });
    }

    const reasonLine = `${FAILED_REASONS[reason]}${note ? ` (${note})` : ""}`;

    await addTracking({
      tracking_no: parcel.tracking_no,
      parcelId: parcel._id.toString(),
      created_by: parcel.created_by?.toLowerCase(),
      status: "failed_attempt",
      message: `Delivery attempt ${attempts.length} of ${MAX_DELIVERY_ATTEMPTS} failed: ${reasonLine}.${
        goBack ? "" : " We'll try again."
      }`,
      rider_name: parcel.assigned_rider_name,
      created_at: now,
    });

    if (goBack) {
      await addTracking({
        tracking_no: parcel.tracking_no,
        parcelId: parcel._id.toString(),
        created_by: parcel.created_by?.toLowerCase(),
        status: "returning",
        message:
          getRouteType(parcel) === "local"
            ? `After ${MAX_DELIVERY_ATTEMPTS} failed attempts, ${parcel.assigned_rider_name} is bringing the parcel back to you.`
            : `After ${MAX_DELIVERY_ATTEMPTS} failed attempts, the parcel is being sent back to you through our warehouses.`,
        rider_name: parcel.assigned_rider_name,
        created_at: now,
      });

      await notifyAdmins({
        type: "returning",
        title: "Parcel is being returned",
        message: `"${parcel.parcelName}" (${parcel.tracking_no}) failed ${MAX_DELIVERY_ATTEMPTS} times and is going back to the sender. Last reason: ${reasonLine}.`,
        link: "/dashboard/parcel-tracker",
        parcelId: parcel._id.toString(),
        tracking_no: parcel.tracking_no,
      });
    }

    res.send({
      ...result,
      failedAttemptCount: attempts.length,
      maxAttempts: MAX_DELIVERY_ATTEMPTS,
      deliveryStatus: goBack ? "returning" : parcel.deliveryStatus,
      returning: goBack,
    });
  } catch (error) {
    console.error("Rider fail attempt error:", error);
    res.status(500).send({ message: "Failed to report the attempt" });
  }
};
