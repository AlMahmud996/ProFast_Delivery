import {
  parcelsCollection,
  earningsCollection,
  expensesCollection,
  notificationsCollection,
} from "../config/db.js"; // live bindings
import { PRICING } from "../constants/pricing.js";
import { getRouteType } from "../utils/delivery.js";
import { roundMoney } from "../utils/money.js";

// Runs once after the DB is connected (called from index.js)
export const runStartupTasks = async () => {
  // Index to make "parcels of a user, latest first" fast
  await parcelsCollection.createIndex({ created_by: 1, creationDate: -1 });
  // One earning per parcel leg, so a double request can never pay twice
  await earningsCollection.createIndex({ parcelId: 1, leg: 1 }, { unique: true });
  // One truck cost per parcel and trip type
  await expensesCollection.createIndex({ parcelId: 1, type: 1 }, { unique: true });
  // Bell notifications of one person, newest first
  await notificationsCollection.createIndex({ recipientEmail: 1, created_at: -1 });

  // ---------- One-time fix for parcels booked before the line-haul fee ----------
  // Old inter-division parcels have no lineHaulFee, so riders would be paid from the
  // whole price and the truck would come out of the company's pocket (a loss on cheap
  // parcels). Mark ৳40 of their existing price as the line-haul fee. The customer's
  // price doesn't change; riders are paid from the rest. Runs on every start but
  // only touches parcels that still need it.
  try {
    const oldParcels = await parcelsCollection
      .find({ lineHaulFee: { $in: [null] }, deliveryStatus: { $ne: "delivered" } })
      .project({
        cost: 1,
        routeType: 1,
        senderRegion: 1,
        receiverRegion: 1,
        senderServiceCenter: 1,
        receiverServiceCenter: 1,
      })
      .toArray();

    let fixed = 0;
    for (const p of oldParcels) {
      const routeType = getRouteType(p);
      const cost = Number(p.cost) || 0;
      const lineHaulFee = routeType === "inter_region" ? Math.min(PRICING.lineHaulFee, cost) : 0;

      await parcelsCollection.updateOne(
        { _id: p._id },
        {
          $set: {
            lineHaulFee,
            deliveryCharge: roundMoney(cost - lineHaulFee),
            routeType,
            lineHaulBackfilled: lineHaulFee > 0, // marks parcels changed by this fix
          },
        }
      );
      if (lineHaulFee > 0) fixed++;
    }

    if (fixed > 0) {
      console.log(`Line-haul fee added to ${fixed} older inter-division parcel(s)`);
    }
  } catch (error) {
    console.error("Line-haul backfill failed:", error);
  }
};
