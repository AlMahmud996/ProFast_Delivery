import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
    FaMotorcycle,
    FaUserClock,
    FaShippingFast,
    FaWarehouse,
    FaCheckCircle,
    FaExclamationTriangle,
    FaUndo,
} from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";
import CashoutCard from "./CashoutCard";
import AdminAnalytics from "./AdminAnalytics";

// ৳1,234.5 style money (kept private to this file)
const money = (n) =>
    `৳${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const AdminHome = () => {
    const axiosSecure = useAxiosSecure();

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["adminOverview"],
        retry: 1,
        refetchInterval: 60000,
        queryFn: async () => (await axiosSecure.get("/admin/overview")).data,
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-16">
                <p className="text-error text-lg">{error?.response?.data?.message || "Failed to load the overview."}</p>
                <button onClick={() => refetch()} className="btn mt-4">Try again</button>
            </div>
        );
    }

    const { finance: f, parcelStatus: s, riders, rules, lossParcels, recentCashouts } = data;

    const waitingRider = (s.pending_assignment || 0) + (s.at_destination_hub || 0) + (s.return_at_origin_hub || 0);
    const atWarehouse = (s.at_origin_hub || 0) + (s.return_at_hub || 0);
    const returning =
        (s.returning || 0) +
        (s.return_at_hub || 0) +
        (s.return_in_transit || 0) +
        (s.return_at_origin_hub || 0) +
        (s.return_rider_assigned || 0) +
        (s.return_out_for_delivery || 0);
    const onTheWay =
        (s.rider_assigned || 0) +
        (s.picked_up || 0) +
        (s.in_transit || 0) +
        (s.dispatched_to_hub || 0) +
        (s.delivery_rider_assigned || 0) +
        (s.out_for_delivery || 0);

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-[#CAEB66]">Admin Home</h2>
                <p className="text-gray-500">Company money, rider payouts and today's work at a glance.</p>
            </div>

            {lossParcels > 0 && (
                <div className="alert alert-warning text-sm">
                    <FaExclamationTriangle />
                    <span>
                        {lossParcels} paid {lossParcels === 1 ? "parcel costs" : "parcels cost"} the company more than the
                        customer paid (riders + truck). These were booked before the {money(rules.lineHaulFee)} line-haul
                        fee existed. New inter-division bookings include it, so they always make a profit.
                    </span>
                </div>
            )}

            {/* Company balance + cashout */}
            <CashoutCard
                title="Company balance (available to cash out)"
                balance={f.available}
                minCashout={rules.minCashout}
                cashouts={recentCashouts}
                queryKey={["adminOverview"]}
                note={`Money left after paying riders and trucks, keeping ${money(f.committed)} aside for parcels that are paid but not delivered yet.`}
            />

            {/* Where the money goes */}
            <div className="bg-base-100 rounded-xl shadow-sm p-5 md:p-6">
                <h3 className="text-lg font-semibold mb-4">Where the money goes</h3>
                <div className="space-y-1 text-sm max-w-xl">
                    <Line label={`Received from ${f.paidParcels} paid parcels`} value={f.revenue} strong />
                    {f.lineHaulCollected > 0 && (
                        <Line label="↳ of which line-haul fees (for trucks)" value={f.lineHaulCollected} muted />
                    )}
                    <Line label={`Riders: full deliveries (${rules.shares.full}%)`} value={-f.earnedByLeg.full} />
                    <Line label={`Riders: pickup to warehouse (${rules.shares.pickup}%)`} value={-f.earnedByLeg.pickup} />
                    <Line label={`Riders: warehouse to door (${rules.shares.delivery}%)`} value={-f.earnedByLeg.delivery} />
                    {f.earnedByLeg.return > 0 && (
                        <Line label={`Riders: returns to sender (${rules.shares.return ?? 30}%)`} value={-f.earnedByLeg.return} />
                    )}
                    <Line label={`Trucks: ${f.truckTrips} parcels × ${money(rules.truckCostPerParcel)}`} value={-f.truckCosts} />
                    <Line label="Company profit so far" value={f.profit} strong border />
                    <Line label="Kept aside for unfinished parcels" value={-f.committed} muted />
                    <Line label="Already cashed out by admins" value={-f.companyCashedOut} muted />
                    <Line label="Available to cash out" value={f.available} strong border highlight />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                    <MiniStat label="Riders earned (total)" value={money(f.riderEarned)} />
                    <MiniStat label="Riders cashed out" value={money(f.riderCashedOut)} />
                    <MiniStat label="Still owed to riders" value={money(f.riderOwed)} sub="Riders can cash this out" />
                </div>
            </div>

            {/* Work overview */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <WorkStat icon={<FaShippingFast />} label="Need a rider" value={waitingRider} to="/dashboard/assign-rider" alert={waitingRider > 0} />
                <WorkStat icon={<FaWarehouse />} label="Waiting for truck" value={atWarehouse} to="/dashboard/hub-transfers" alert={atWarehouse > 0} />
                <WorkStat icon={<FaMotorcycle />} label="On the way" value={onTheWay} />
                <WorkStat icon={<FaCheckCircle />} label="Delivered" value={s.delivered || 0} />
                <WorkStat icon={<FaUndo />} label="Returning" value={returning} to="/dashboard/parcel-tracker" alert={returning > 0} sub={`${s.returned || 0} returned`} />
                <WorkStat icon={<FaUserClock />} label="Rider applications" value={riders.pending} to="/dashboard/pending-riders" alert={riders.pending > 0} sub={`${riders.active} active riders`} />
            </div>

            {/* Revenue per day, parcels per region, top riders */}
            <AdminAnalytics />
        </div>
    );
};

// One row of the money breakdown
const Line = ({ label, value, strong, border, muted, highlight }) => (
    <div
        className={`flex justify-between gap-4 py-1.5 ${border ? "border-t border-base-300 pt-2 mt-1" : ""} ${
            muted ? "text-gray-500" : ""
        }`}
    >
        <span className={strong ? "font-semibold" : ""}>{label}</span>
        <span
            className={`whitespace-nowrap ${strong ? "font-bold" : ""} ${highlight ? "text-[#CAEB66] text-lg" : ""} ${
                value < 0 && !muted ? "text-red-400" : ""
            }`}
        >
            {value < 0 ? `− ${money(-value)}` : money(value)}
        </span>
    </div>
);

const MiniStat = ({ label, value, sub }) => (
    <div className="rounded-lg border border-base-300 p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
);

const WorkStat = ({ icon, label, value, to, alert, sub }) => {
    const body = (
        <div
            className={`bg-base-100 rounded-xl shadow-sm p-4 h-full transition ${to ? "hover:ring-2 hover:ring-[#CAEB66]" : ""} ${
                alert ? "ring-1 ring-amber-500" : ""
            }`}
        >
            <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-2">
                <span className={alert ? "text-amber-500" : "text-[#CAEB66]"}>{icon}</span> {label}
            </p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500">{sub}</p>}
        </div>
    );
    return to ? <Link to={to}>{body}</Link> : body;
};

export default AdminHome;