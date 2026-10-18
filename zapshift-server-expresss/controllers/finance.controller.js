import {
  usersCollection,
  ridersCollection,
  parcelsCollection,
  earningsCollection,
  cashoutsCollection,
  cashoutLocksCollection,
} from "../config/db.js"; // live bindings
import {
  RIDER_SHARE,
  RIDER_PAY_CAP,
  RIDER_ACTIVE_STATUSES,
  FINAL_STATUSES,
  RETURN_STATUSES,
} from "../constants/delivery.js";
import { PRICING } from "../constants/pricing.js";
import { TRUCK_COST_PER_PARCEL, MIN_CASHOUT, CASHOUT_METHODS } from "../constants/money.js";
import { getRouteType, getCurrentLeg } from "../utils/delivery.js";
import { riderPay } from "../utils/pricing.js";
import { roundMoney, publicCashout } from "../utils/money.js";
import { getCompanyFinance, getRiderFinance } from "../services/finance.service.js";

// ---------- ADMIN HOME ----------
export const getAdminOverview = async (req, res) => {
  try {
    const [finance, statusRows, activeRiders, pendingRiders, recentCashouts, interRegionPaid] =
      await Promise.all([
        getCompanyFinance(),
        parcelsCollection
          .find({ paymentStatus: "paid" })
          .project({ deliveryStatus: 1 })
          .toArray(),
        ridersCollection.countDocuments({ status: "active" }),
        ridersCollection.countDocuments({ status: "pending" }),
        cashoutsCollection
          .find({ wallet: "company" })
          .sort({ created_at: -1, _id: -1 })
          .limit(10)
          .toArray(),
        // Only parcels still in progress: finished ones can't be changed anymore
        parcelsCollection
          .find({ paymentStatus: "paid", deliveryStatus: { $nin: [...FINAL_STATUSES, ...RETURN_STATUSES] } })
          .project({ cost: 1, lineHaulFee: 1, deliveryStatus: 1, routeType: 1, senderRegion: 1, receiverRegion: 1, senderServiceCenter: 1, receiverServiceCenter: 1 })
          .toArray(),
      ]);

    // How many paid parcels are in each delivery state
    const parcelStatus = {};
    for (const p of statusRows) {
      const s = p.deliveryStatus || "pending_assignment";
      parcelStatus[s] = (parcelStatus[s] || 0) + 1;
    }

    // In-progress parcels where riders + truck will cost more than the customer paid.
    // Uses what riders were ACTUALLY paid for legs already finished.
    const openIds = interRegionPaid.map((p) => p._id.toString());
    const paidEarnings = openIds.length
      ? await earningsCollection.find({ parcelId: { $in: openIds } }).project({ parcelId: 1, leg: 1, amount: 1 }).toArray()
      : [];
    const paidLeg = new Map(paidEarnings.map((e) => [`${e.parcelId}:${e.leg}`, Number(e.amount) || 0]));

    const lossParcels = interRegionPaid.filter((p) => {
      const id = p._id.toString();
      const legCost = (leg) => paidLeg.get(`${id}:${leg}`) ?? riderPay(p, leg).amount;
      const cost = Number(p.cost) || 0;
      const margin =
        getRouteType(p) === "local"
          ? cost - legCost("full")
          : cost - legCost("pickup") - legCost("delivery") - TRUCK_COST_PER_PARCEL;
      return margin < 0;
    }).length;

    res.send({
      finance,
      parcelStatus,
      riders: { active: activeRiders, pending: pendingRiders },
      lossParcels,
      rules: {
        shares: {
          full: RIDER_SHARE.full * 100,
          pickup: RIDER_SHARE.pickup * 100,
          delivery: RIDER_SHARE.delivery * 100,
          return: RIDER_SHARE.return * 100,
        },
        caps: RIDER_PAY_CAP,
        truckCostPerParcel: TRUCK_COST_PER_PARCEL,
        lineHaulFee: PRICING.lineHaulFee,
        minCashout: MIN_CASHOUT,
      },
      recentCashouts: recentCashouts.map(publicCashout),
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).send({ message: "Failed to load overview" });
  }
};

// ---------- RIDER HOME ----------
export const getRiderOverview = async (req, res) => {
  try {
    const email = req.decodedToken.email?.toLowerCase();

    const [finance, rider, activeJobs] = await Promise.all([
      getRiderFinance(email),
      ridersCollection.findOne(
        { email },
        { projection: { name: 1, contact: 1, region: 1, warehouse: 1, status: 1, reviewed_at: 1 } }
      ),
      parcelsCollection
        .find({ assigned_rider_email: email, deliveryStatus: { $in: RIDER_ACTIVE_STATUSES } })
        .project({ cost: 1, lineHaulFee: 1, deliveryStatus: 1, routeType: 1, senderRegion: 1, receiverRegion: 1, senderServiceCenter: 1, receiverServiceCenter: 1 })
        .toArray(),
    ]);

    // What the rider will earn when the current jobs are done
    const upcoming = roundMoney(
      activeJobs.reduce((sum, p) => sum + riderPay(p, getCurrentLeg(p)).amount, 0)
    );

    res.send({
      rider,
      totalEarned: finance.totalEarned,
      cashedOut: finance.cashedOut,
      balance: finance.balance,
      jobsCompleted: finance.earnings.length,
      activeJobs: activeJobs.length,
      upcomingEarnings: upcoming,
      minCashout: MIN_CASHOUT,
      // Small list for "today / this month" and the recent jobs list
      earnings: finance.earnings.map((e) => ({
        _id: e._id,
        parcelName: e.parcelName,
        tracking_no: e.tracking_no,
        leg: e.leg,
        amount: e.amount,
        completed_at: e.completed_at,
      })),
      cashouts: finance.cashouts.map(publicCashout),
    });
  } catch (error) {
    console.error("Rider overview error:", error);
    res.status(500).send({ message: "Failed to load overview" });
  }
};

// ---------- CASHOUT (admins from the company balance, riders from their own) ----------
export const createCashout = async (req, res) => {
  const email = req.decodedToken.email?.toLowerCase();
  let user;
  try {
    user = await usersCollection.findOne({ email });
  } catch (error) {
    console.error("Cashout user lookup error:", error);
    return res.status(500).send({ message: "Failed to cash out" });
  }
  const role = user?.role;

  if (role !== "admin" && role !== "rider") {
    return res.status(403).send({ message: "Only admins and riders can cash out" });
  }

  const wallet = role === "admin" ? "company" : "rider";
  const amount = roundMoney(Number(req.body?.amount));
  const method = String(req.body?.method || "").toLowerCase();
  const accountNumber = String(req.body?.accountNumber || "").replace(/\s+/g, "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).send({ message: "Enter a valid amount" });
  }
  if (amount < MIN_CASHOUT) {
    return res.status(400).send({ message: `Minimum cashout is ৳${MIN_CASHOUT}` });
  }
  if (!CASHOUT_METHODS.includes(method)) {
    return res.status(400).send({ message: "Choose bKash, Nagad, Rocket or Bank" });
  }
  if (!/^[0-9]{6,20}$/.test(accountNumber)) {
    return res.status(400).send({ message: "Enter a valid account number (digits only)" });
  }

  // One cashout at a time per wallet (stops a double click from paying twice)
  const lockId = wallet === "company" ? "company" : `rider:${email}`;
  const staleBefore = new Date(Date.now() - 30000).toISOString();
  await cashoutLocksCollection.deleteOne({ _id: lockId, created_at: { $lt: staleBefore } });

  try {
    await cashoutLocksCollection.insertOne({ _id: lockId, created_at: new Date().toISOString() });
  } catch (lockError) {
    if (lockError.code === 11000) {
      return res.status(409).send({ message: "Another cashout is in progress. Try again in a moment." });
    }
    console.error("Cashout lock error:", lockError);
    return res.status(500).send({ message: "Failed to cash out" });
  }

  try {
    const available =
      wallet === "company" ? (await getCompanyFinance()).available : (await getRiderFinance(email)).balance;

    if (available < MIN_CASHOUT) {
      return res.status(400).send({
        message: `You need at least ৳${MIN_CASHOUT} to cash out. Available: ৳${available}`,
      });
    }
    if (amount > available) {
      return res.status(400).send({ message: `You can cash out at most ৳${available}` });
    }

    const cashout = {
      wallet,
      role,
      ownerEmail: email,
      ownerName: user?.name || req.decodedToken.name || email,
      amount,
      method,
      accountNumber,
      status: "completed",
      balanceBefore: available,
      balanceAfter: roundMoney(available - amount),
      created_at: new Date().toISOString(),
    };

    const result = await cashoutsCollection.insertOne(cashout);

    res.status(201).send({
      insertedId: result.insertedId,
      amount,
      balanceAfter: cashout.balanceAfter,
    });
  } catch (error) {
    console.error("Cashout error:", error);
    res.status(500).send({ message: "Failed to cash out" });
  } finally {
    await cashoutLocksCollection.deleteOne({ _id: lockId });
  }
};
