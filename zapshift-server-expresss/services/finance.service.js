import {
  paymentsCollection,
  earningsCollection,
  expensesCollection,
  cashoutsCollection,
  parcelsCollection,
} from "../config/db.js"; // live bindings
import { RETURN_STATUSES, FINAL_STATUSES } from "../constants/delivery.js";
import { TRUCK_COST_PER_PARCEL } from "../constants/money.js";
import { getRouteType } from "../utils/delivery.js";
import { riderPay } from "../utils/pricing.js";
import { roundMoney, sumAmounts } from "../utils/money.js";

// ================= MONEY: BALANCES =================
//
// Company (admin) money:
//   revenue        = every parcel payment received
//   - riderEarned  = what riders earned for finished jobs (60% / 40% / 40%)
//   - truckCosts   = 40 tk for every parcel sent by truck
//   = profit so far
//   - committed    = what we will still pay for paid parcels that aren't finished yet
//   - company cashouts already taken
//   = available to cash out
//
// Rider money: everything they earned - everything they cashed out

export const getCompanyFinance = async () => {
  const [payments, earnings, truckExpenses, cashouts, openParcels, paidParcels] = await Promise.all([
    paymentsCollection.find({}).project({ amount: 1 }).toArray(),
    earningsCollection.find({}).project({ amount: 1, leg: 1, parcelId: 1 }).toArray(),
    expensesCollection.find({ type: { $in: ["truck", "truck_return"] } }).project({ amount: 1, parcelId: 1, type: 1 }).toArray(),
    cashoutsCollection.find({}).project({ amount: 1, wallet: 1 }).toArray(),
    parcelsCollection
      .find({ paymentStatus: "paid", deliveryStatus: { $nin: FINAL_STATUSES } })
      .project({
        cost: 1,
        lineHaulFee: 1,
        deliveryStatus: 1,
        routeType: 1,
        senderRegion: 1,
        receiverRegion: 1,
        senderServiceCenter: 1,
        receiverServiceCenter: 1,
      })
      .toArray(),
    parcelsCollection.find({ paymentStatus: "paid" }).project({ lineHaulFee: 1 }).toArray(),
  ]);

  const revenue = sumAmounts(payments);
  // Part of the revenue that customers paid specifically for trucks
  const lineHaulCollected = roundMoney(
    paidParcels.reduce((sum, p) => sum + (Number(p.lineHaulFee) || 0), 0)
  );
  const riderEarned = sumAmounts(earnings);
  const truckCosts = sumAmounts(truckExpenses);
  const riderCashedOut = sumAmounts(cashouts.filter((c) => c.wallet === "rider"));
  const companyCashedOut = sumAmounts(cashouts.filter((c) => c.wallet === "company"));

  // Money still to be paid for unfinished parcels
  const paidLegs = new Set(earnings.map((e) => `${e.parcelId}:${e.leg}`));
  const truckPaid = new Set(truckExpenses.map((t) => `${t.parcelId}:${t.type || "truck"}`));
  let committed = 0;

  for (const p of openParcels) {
    const id = p._id.toString();
    const isReturn = RETURN_STATUSES.includes(p.deliveryStatus);

    if (getRouteType(p) === "local") {
      if (!paidLegs.has(`${id}:full`)) committed += riderPay(p, "full").amount;
    } else {
      if (!paidLegs.has(`${id}:pickup`)) committed += riderPay(p, "pickup").amount;
      if (!truckPaid.has(`${id}:truck`)) committed += TRUCK_COST_PER_PARCEL;
      if (!paidLegs.has(`${id}:delivery`)) committed += riderPay(p, "delivery").amount;
      // A return costs a second truck trip and a return rider
      if (isReturn) {
        if (!truckPaid.has(`${id}:truck_return`)) committed += TRUCK_COST_PER_PARCEL;
        if (!paidLegs.has(`${id}:return`)) committed += riderPay(p, "return").amount;
      }
    }
  }
  committed = roundMoney(committed);

  const profit = roundMoney(revenue - riderEarned - truckCosts);
  const available = roundMoney(profit - committed - companyCashedOut);

  return {
    revenue,
    lineHaulCollected,
    paidParcels: payments.length,
    riderEarned,
    riderCashedOut,
    riderOwed: roundMoney(riderEarned - riderCashedOut),
    truckCosts,
    truckTrips: truckExpenses.length,
    committed,
    profit,
    companyCashedOut,
    available: Math.max(0, available),
    // A negative number here means the company owes more than it holds
    rawAvailable: available,
    earnedByLeg: {
      full: sumAmounts(earnings.filter((e) => e.leg === "full")),
      pickup: sumAmounts(earnings.filter((e) => e.leg === "pickup")),
      delivery: sumAmounts(earnings.filter((e) => e.leg === "delivery")),
      return: sumAmounts(earnings.filter((e) => e.leg === "return")),
    },
  };
};

export const getRiderFinance = async (email) => {
  const [earnings, cashouts] = await Promise.all([
    earningsCollection
      .find({ riderEmail: email })
      .sort({ completed_at: -1, _id: -1 })
      .toArray(),
    cashoutsCollection
      .find({ wallet: "rider", ownerEmail: email })
      .sort({ created_at: -1, _id: -1 })
      .toArray(),
  ]);

  const totalEarned = sumAmounts(earnings);
  const cashedOut = sumAmounts(cashouts);

  return { earnings, cashouts, totalEarned, cashedOut, balance: roundMoney(totalEarned - cashedOut) };
};
