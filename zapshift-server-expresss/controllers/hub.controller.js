import { ObjectId } from "mongodb";
import { parcelsCollection, expensesCollection } from "../config/db.js"; // live bindings
import { RETURN_STATUSES, HUB_MOVES, HUB_ARRIVALS, LEG_CONFIG } from "../constants/delivery.js";
import { TRUCK_COST_PER_PARCEL } from "../constants/money.js";
import { getRegion } from "../utils/geo.js";
import { addTracking, notifyAdmins } from "../services/notification.service.js";
import { findAutoRider, assignRider } from "../services/rider.service.js";

// ================= ADMIN: WAREHOUSE / TRUCK TRANSFERS =================
//
// Forward:  at_origin_hub --Dispatch--> dispatched_to_hub --Arrive--> at_destination_hub
// Return:   return_at_hub --Dispatch--> return_in_transit --Arrive--> return_at_origin_hub

// Inter-region parcels at a warehouse waiting for a truck, or on a truck
export const getHubParcels = async (req, res) => {
  try {
    const parcels = await parcelsCollection
      .find({
        deliveryStatus: { $in: ["at_origin_hub", "dispatched_to_hub", "return_at_hub", "return_in_transit"] },
      })
      .sort({ at_origin_hub_at: 1, _id: 1 })
      .toArray();

    res.send(
      parcels.map((p) => {
        const isReturn = RETURN_STATUSES.includes(p.deliveryStatus);
        return {
          ...p,
          senderRegion: getRegion(p, "sender"),
          receiverRegion: getRegion(p, "receiver"),
          isReturn,
          // Where the truck goes from/to (reversed for returns)
          fromWarehouse: isReturn ? p.receiverServiceCenter : p.senderServiceCenter,
          toWarehouse: isReturn ? p.senderServiceCenter : p.receiverServiceCenter,
        };
      })
    );
  } catch (error) {
    console.error("Fetch hub parcels error:", error);
    res.status(500).send({ message: "Failed to fetch warehouse parcels" });
  }
};

// Number of parcels waiting at a warehouse for a truck (sidebar badge)
export const getHubCount = async (req, res) => {
  try {
    const count = await parcelsCollection.countDocuments({
      deliveryStatus: { $in: ["at_origin_hub", "return_at_hub"] },
    });
    res.send({ count });
  } catch (error) {
    console.error("Count hub parcels error:", error);
    res.status(500).send({ message: "Failed to count warehouse parcels" });
  }
};

// Load a parcel on the truck (forward, or back to the sender's warehouse for a return)
export const dispatchParcel = async (req, res) => {
  try {
    const { id } = req.params;
    const vehicleNo = String(req.body?.vehicleNo || "").trim().slice(0, 40);

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    const move = HUB_MOVES[parcel.deliveryStatus];
    if (!move) {
      return res
        .status(400)
        .send({ message: "Only parcels waiting at a warehouse can be dispatched" });
    }

    const isReturn = move.direction === "return";
    const from = isReturn ? parcel.receiverServiceCenter : parcel.senderServiceCenter;
    const to = isReturn ? parcel.senderServiceCenter : parcel.receiverServiceCenter;
    const now = new Date().toISOString();

    const result = await parcelsCollection.updateOne(
      { _id: parcel._id, deliveryStatus: parcel.deliveryStatus },
      {
        $set: {
          deliveryStatus: move.next,
          [`${move.next}_at`]: now,
          [isReturn ? "return_dispatched_by" : "dispatched_by"]: req.decodedToken.email?.toLowerCase(),
          ...(vehicleNo ? { [isReturn ? "returnVehicleNo" : "vehicleNo"]: vehicleNo } : {}),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).send({ message: "Parcel was already dispatched" });
    }

    await addTracking({
      tracking_no: parcel.tracking_no,
      parcelId: parcel._id.toString(),
      created_by: parcel.created_by?.toLowerCase(),
      status: move.next,
      message: isReturn
        ? `Returned parcel left the ${from} warehouse by truck, heading back to ${to}.`
        : `Parcel left the ${from} warehouse by truck, heading to ${to}.`,
      created_at: now,
    });

    // Truck cost for this parcel, paid from the company's money
    try {
      await expensesCollection.insertOne({
        type: move.expense,
        parcelId: parcel._id.toString(),
        tracking_no: parcel.tracking_no,
        from,
        to,
        vehicleNo: vehicleNo || null,
        amount: TRUCK_COST_PER_PARCEL,
        created_by: req.decodedToken.email?.toLowerCase(),
        created_at: now,
      });
    } catch (expenseError) {
      if (expenseError.code !== 11000) throw expenseError; // already recorded
    }

    res.send(result);
  } catch (error) {
    console.error("Dispatch parcel error:", error);
    res.status(500).send({ message: "Failed to dispatch parcel" });
  }
};

// Truck reached the warehouse. Assign a rider based in that district automatically
// (delivery rider forward, return rider for returns); otherwise the admin is notified.
export const arriveParcel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid parcel id" });
    }

    const parcel = await parcelsCollection.findOne({ _id: new ObjectId(id) });

    if (!parcel) {
      return res.status(404).send({ message: "Parcel not found" });
    }

    const arrival = HUB_ARRIVALS[parcel.deliveryStatus];
    if (!arrival) {
      return res
        .status(400)
        .send({ message: "Only parcels on a truck can be marked as arrived" });
    }

    const isReturn = arrival.direction === "return";
    const warehouse = isReturn ? parcel.senderServiceCenter : parcel.receiverServiceCenter;
    const now = new Date().toISOString();

    const result = await parcelsCollection.updateOne(
      { _id: parcel._id, deliveryStatus: parcel.deliveryStatus },
      { $set: { deliveryStatus: arrival.next, [`${arrival.next}_at`]: now } }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).send({ message: "Parcel was already marked as arrived" });
    }

    await addTracking({
      tracking_no: parcel.tracking_no,
      parcelId: parcel._id.toString(),
      created_by: parcel.created_by?.toLowerCase(),
      status: arrival.next,
      message: isReturn
        ? `Returned parcel is back at the ${warehouse} warehouse.`
        : `Parcel arrived at the ${warehouse} warehouse.`,
      created_at: now,
    });

    // Try to hand it to a rider based at this warehouse right away
    const arrivedParcel = { ...parcel, deliveryStatus: arrival.next };
    const rider = await findAutoRider(arrivedParcel, arrival.leg);

    if (rider) {
      await assignRider(arrivedParcel, rider, "auto", arrival.leg);
      return res.send({
        ...result,
        deliveryStatus: LEG_CONFIG[arrival.leg].status,
        rider_name: rider.name,
      });
    }

    // No rider based in this district: the admin must pick one from a nearby district.
    await parcelsCollection.updateOne(
      { _id: parcel._id },
      { $set: { assignment_reason: "no_rider_in_district" } }
    );

    await notifyAdmins({
      type: "needs_rider",
      title: isReturn ? "Return needs a rider" : "Parcel needs a delivery rider",
      message: `"${parcel.parcelName}" is at the ${warehouse} warehouse and no rider is based there. Choose one from a nearby district.`,
      link: "/dashboard/assign-rider",
      parcelId: parcel._id.toString(),
      tracking_no: parcel.tracking_no,
    });

    res.send({
      ...result,
      deliveryStatus: arrival.next,
      rider_name: null,
      needsAdmin: true,
      district: warehouse,
    });
  } catch (error) {
    console.error("Arrive parcel error:", error);
    res.status(500).send({ message: "Failed to update parcel" });
  }
};
