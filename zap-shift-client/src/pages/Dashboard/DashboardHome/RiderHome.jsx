import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { FaWallet, FaCalendarAlt, FaSun, FaClipboardList, FaMapMarkerAlt, FaArrowRight } from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";
import CashoutCard from "./CashoutCard";

// ৳1,234.5 style money (kept private to this file)
const money = (n) =>
    `৳${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// e.g. "15 Oct 2026, 3:36 PM" (kept private to this file)
const formatDate = (iso) =>
    iso
        ? new Date(iso).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
          })
        : "—";

const LEG_LABEL = {
    full: "Full delivery",
    pickup: "Pickup → Warehouse",
    delivery: "Warehouse → Door",
    return: "Return → Sender",
};

const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const RiderHome = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["riderOverview"],
        retry: 1,
        refetchInterval: 60000,
        queryFn: async () => (await axiosSecure.get("/rider/overview")).data,
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
                <p className="text-error text-lg">{error?.response?.data?.message || "Failed to load your overview."}</p>
                <button onClick={() => refetch()} className="btn mt-4">Try again</button>
            </div>
        );
    }

    // Today / this month in the rider's own time zone
    const now = new Date();
    const sum = (list) => list.reduce((t, e) => t + (e.amount || 0), 0);
    const thisMonth = data.earnings.filter((e) => {
        const d = new Date(e.completed_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const today = data.earnings.filter((e) => isSameDay(new Date(e.completed_at), now));
    const rider = data.rider || {};

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Greeting + rider info */}
            <div className="bg-base-100 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="avatar">
                    <div className="w-16 rounded-full ring-2 ring-[#CAEB66] ring-offset-2 ring-offset-base-100">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt={rider.name || "Rider"} referrerPolicy="no-referrer" />
                        ) : (
                            <div className="bg-[#CAEB66] text-black w-full h-full flex items-center justify-center text-xl font-bold">
                                {(rider.name || user?.email || "?").slice(0, 1).toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>
                <div className="grow">
                    <h2 className="text-2xl font-bold">Hi, {rider.name || user?.displayName || "Rider"} 👋</h2>
                    <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                        <FaMapMarkerAlt className="text-[#CAEB66]" />
                        {rider.warehouse} service center, {rider.region} · {rider.contact}
                    </p>
                    {rider.reviewed_at && (
                        <p className="text-xs text-gray-500 mt-0.5">Rider since {formatDate(rider.reviewed_at).split(",")[0]}</p>
                    )}
                </div>
                <Link
                    to="/dashboard/pending-deliveries"
                    className="btn btn-outline btn-sm self-start sm:self-center"
                >
                    <FaClipboardList /> {data.activeJobs} active {data.activeJobs === 1 ? "job" : "jobs"}
                </Link>
            </div>

            {/* Earnings stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon={<FaWallet />} label="Total earned" value={money(data.totalEarned)} sub={`${data.jobsCompleted} jobs done`} />
                <Stat icon={<FaCalendarAlt />} label="This month" value={money(sum(thisMonth))} sub={`${thisMonth.length} jobs`} />
                <Stat icon={<FaSun />} label="Today" value={money(sum(today))} sub={`${today.length} jobs`} />
                <Stat
                    icon={<FaClipboardList />}
                    label="Coming from active jobs"
                    value={money(data.upcomingEarnings)}
                    sub="Added when you finish them"
                />
            </div>

            {/* Balance + cashout */}
            <CashoutCard
                title="Your balance"
                balance={data.balance}
                minCashout={data.minCashout}
                cashouts={data.cashouts}
                queryKey={["riderOverview"]}
                note={`Earned ${money(data.totalEarned)} · Cashed out ${money(data.cashedOut)}`}
            />

            {/* Recent jobs */}
            <div className="bg-base-100 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Recent jobs</h3>
                    <Link to="/dashboard/completed-deliveries" className="text-sm text-[#CAEB66] hover:underline inline-flex items-center gap-1">
                        See all <FaArrowRight className="text-xs" />
                    </Link>
                </div>
                {data.earnings.length === 0 ? (
                    <p className="text-sm text-gray-500">No finished jobs yet. Your earnings will appear here.</p>
                ) : (
                    <ul className="divide-y divide-base-300">
                        {data.earnings.slice(0, 5).map((e) => (
                            <li key={e._id} className="py-2.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{e.parcelName}</p>
                                    <p className="text-xs text-gray-500">
                                        {LEG_LABEL[e.leg]} · {formatDate(e.completed_at)}
                                    </p>
                                </div>
                                <span className="font-bold text-[#CAEB66] whitespace-nowrap">+{money(e.amount)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const Stat = ({ icon, label, value, sub }) => (
    <div className="bg-base-100 rounded-xl p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-2">
            <span className="text-[#CAEB66]">{icon}</span> {label}
        </p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
);

export default RiderHome;