import { paymentsCollection, parcelsCollection, earningsCollection } from "../config/db.js"; // live bindings
import { getRegion } from "../utils/geo.js";
import { roundMoney } from "../utils/money.js";

// ================= ADMIN ANALYTICS =================

// Dates are grouped by Bangladesh time (UTC+6), so "today" matches the admin's clock
const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const bdDayKey = (iso) => new Date(new Date(iso).getTime() + BD_OFFSET_MS).toISOString().slice(0, 10);

export const getAnalytics = async (req, res) => {
  try {
    const days = Math.min(60, Math.max(7, Number(req.query.days) || 14));

    // Day keys for the chart, oldest first, ending today (Bangladesh time)
    const todayKey = bdDayKey(new Date().toISOString());
    const dayKeys = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(`${todayKey}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    // Start of the first day, as a UTC timestamp string
    const since = new Date(new Date(`${dayKeys[0]}T00:00:00Z`).getTime() - BD_OFFSET_MS).toISOString();
    const monthStart = new Date(new Date(`${todayKey.slice(0, 7)}-01T00:00:00Z`).getTime() - BD_OFFSET_MS).toISOString();

    const [payments, paidParcels, monthEarnings] = await Promise.all([
      paymentsCollection.find({ paid_at: { $gte: since } }).project({ amount: 1, paid_at: 1 }).toArray(),
      parcelsCollection
        .find({ paymentStatus: "paid" })
        .project({ senderRegion: 1, receiverRegion: 1, senderServiceCenter: 1, receiverServiceCenter: 1 })
        .toArray(),
      earningsCollection
        .find({ completed_at: { $gte: monthStart } })
        .project({ riderEmail: 1, riderName: 1, amount: 1, leg: 1 })
        .toArray(),
    ]);

    // Revenue + parcel count per day
    const byDay = Object.fromEntries(dayKeys.map((k) => [k, { revenue: 0, parcels: 0 }]));
    for (const p of payments) {
      const key = bdDayKey(p.paid_at);
      if (byDay[key]) {
        byDay[key].revenue += Number(p.amount) || 0;
        byDay[key].parcels += 1;
      }
    }
    const revenueByDay = dayKeys.map((date) => ({
      date,
      revenue: roundMoney(byDay[date].revenue),
      parcels: byDay[date].parcels,
    }));

    // Parcels sent from / to each region
    const regionMap = {};
    for (const p of paidParcels) {
      const from = getRegion(p, "sender") || "Unknown";
      const to = getRegion(p, "receiver") || "Unknown";
      regionMap[from] = regionMap[from] || { region: from, sent: 0, received: 0 };
      regionMap[to] = regionMap[to] || { region: to, sent: 0, received: 0 };
      regionMap[from].sent += 1;
      regionMap[to].received += 1;
    }
    const parcelsByRegion = Object.values(regionMap).sort(
      (a, b) => b.sent + b.received - (a.sent + a.received) || a.region.localeCompare(b.region)
    );

    // Riders who earned the most this month
    const riderMap = {};
    for (const e of monthEarnings) {
      const key = e.riderEmail || "unknown";
      riderMap[key] = riderMap[key] || { email: key, name: e.riderName || key, earned: 0, jobs: 0 };
      riderMap[key].earned += Number(e.amount) || 0;
      riderMap[key].jobs += 1;
    }
    const topRiders = Object.values(riderMap)
      .map((r) => ({ ...r, earned: roundMoney(r.earned) }))
      .sort((a, b) => b.earned - a.earned || b.jobs - a.jobs)
      .slice(0, 5);

    res.send({
      days,
      revenueByDay,
      totals: {
        revenue: roundMoney(revenueByDay.reduce((s, d) => s + d.revenue, 0)),
        parcels: revenueByDay.reduce((s, d) => s + d.parcels, 0),
      },
      parcelsByRegion,
      topRiders,
      month: todayKey.slice(0, 7),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).send({ message: "Failed to load analytics" });
  }
};
