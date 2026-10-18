import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaSearch, FaArrowRight, FaWallet, FaBoxOpen, FaCalendarAlt, FaSun } from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// e.g. "15 Oct 2026, 12:36 PM"
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

// ৳1,234.5 style money
const money = (n) => `৳${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Time between two dates, e.g. "3h 20m" or "2d 4h"
const duration = (from, to) => {
    if (!from || !to) return "—";
    const minutes = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

// What kind of job each record is
const LEG_INFO = {
    full: { label: "Full delivery", color: "bg-green-600", pickedLabel: "Picked up" },
    pickup: { label: "Pickup → Warehouse", color: "bg-amber-500", pickedLabel: "Picked up" },
    delivery: { label: "Warehouse → Door", color: "bg-blue-600", pickedLabel: "Collected" },
    return: { label: "Return → Sender", color: "bg-red-600", pickedLabel: "Collected" },
};

const FILTERS = [
    { key: "all", label: "All jobs" },
    { key: "full", label: "Full delivery" },
    { key: "pickup", label: "Pickup" },
    { key: "delivery", label: "Delivery" },
    { key: "return", label: "Return" },
];

const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const CompletedDeliveries = () => {
    const axiosSecure = useAxiosSecure();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["riderCompletedDeliveries"],
        retry: 1,
        queryFn: async () => {
            const res = await axiosSecure.get("/rider/completed-deliveries");
            return res.data;
        },
    });

    const history = data?.history || [];
    const shares = data?.shares || { full: 60, pickup: 30, delivery: 30 };
    const caps = data?.caps || {};

    // ---------- Earnings summary (in the rider's own time zone) ----------
    const now = new Date();
    const thisMonth = history.filter((h) => {
        const d = new Date(h.completed_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const today = history.filter((h) => isSameDay(new Date(h.completed_at), now));
    const sum = (list) => list.reduce((total, h) => total + (h.amount || 0), 0);

    // ---------- Filter + search ----------
    const term = search.trim().toLowerCase();
    const visible = history
        .filter((h) => filter === "all" || h.leg === filter)
        .filter(
            (h) =>
                !term ||
                [h.parcelName, h.tracking_no, h.receiverName, h.from, h.to]
                    .filter(Boolean)
                    .some((field) => String(field).toLowerCase().includes(term))
        );

    // ---------- States ----------
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
                <p className="text-error text-lg">
                    {error?.response?.data?.message || "Failed to load completed deliveries."}
                </p>
                <button onClick={() => refetch()} className="btn mt-4">
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-2">Completed Deliveries</h2>
            <p className="text-gray-500 mb-6">
                Your finished jobs and what you earned. You get {shares.full}% of the delivery charge for a
                full delivery in the same division{caps.full ? ` (up to ${money(caps.full)})` : ""},{" "}
                {shares.pickup}% for taking a parcel to the warehouse{caps.pickup ? ` (up to ${money(caps.pickup)})` : ""}, and{" "}
                {shares.delivery}% for delivering it from the warehouse to the door
                {caps.delivery ? ` (up to ${money(caps.delivery)})` : ""}. The line-haul fee pays for the truck.
            </p>

            {/* Earnings summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Stat icon={<FaWallet />} label="Total earned" value={money(data?.totalEarned)} highlight />
                <Stat icon={<FaCalendarAlt />} label="This month" value={money(sum(thisMonth))} sub={`${thisMonth.length} jobs`} />
                <Stat icon={<FaSun />} label="Today" value={money(sum(today))} sub={`${today.length} jobs`} />
                <Stat icon={<FaBoxOpen />} label="Jobs completed" value={data?.totalJobs || 0} />
            </div>

            {history.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-lg">No completed jobs yet.</p>
                    <p className="text-gray-500 text-sm mt-1">
                        Finish a job on the Pending Deliveries page and it will show here with your earning.
                    </p>
                </div>
            ) : (
                <>
                    {/* Filters + search */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                        <div className="flex flex-wrap gap-2">
                            {FILTERS.map((f) => {
                                const n = f.key === "all" ? history.length : history.filter((h) => h.leg === f.key).length;
                                return (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={`btn btn-sm ${
                                            filter === f.key
                                                ? "bg-[#CAEB66] text-black border-0 hover:bg-[#b8d955]"
                                                : "btn-outline"
                                        }`}
                                    >
                                        {f.label} <span className="badge badge-sm">{n}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <label className="input input-bordered flex items-center gap-2 w-full lg:w-80">
                            <FaSearch className="opacity-60" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search parcel, tracking no, receiver"
                                className="grow"
                            />
                        </label>
                    </div>

                    {visible.length === 0 ? (
                        <div className="text-center py-12 bg-base-100 rounded-xl">
                            <p className="text-gray-500">No jobs match your filter.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto bg-base-100 rounded-xl shadow-md">
                            <table className="table table-zebra">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Parcel</th>
                                        <th>Job</th>
                                        <th className="hidden md:table-cell">Your route</th>
                                        <th className="hidden sm:table-cell">Picked up</th>
                                        <th>Completed</th>
                                        <th className="hidden lg:table-cell">Time taken</th>
                                        <th className="text-right">Earned</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {visible.map((job, index) => {
                                        const info = LEG_INFO[job.leg] || LEG_INFO.full;
                                        return (
                                            <tr key={job._id}>
                                                <td>{index + 1}</td>

                                                <td>
                                                    <p className="font-semibold">{job.parcelName}</p>
                                                    <p className="text-xs text-gray-500">
                                                        <span className="font-mono">{job.tracking_no}</span>
                                                        {" · "}
                                                        {job.from} → {job.to}
                                                    </p>
                                                </td>

                                                <td>
                                                    <span className={`badge badge-sm text-white border-0 whitespace-nowrap ${info.color}`}>
                                                        {info.label}
                                                    </span>
                                                    {job.returned && job.leg !== "return" && (
                                                        <p className="text-[11px] text-red-400 mt-1">Delivery failed, returned</p>
                                                    )}
                                                </td>

                                                {/* Where this rider started and ended */}
                                                <td className="hidden md:table-cell text-sm max-w-xs">
                                                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                                                        <span>{job.startPoint}</span>
                                                        <FaArrowRight className="text-xs text-gray-400 shrink-0" />
                                                        <span>{job.endPoint}</span>
                                                    </span>
                                                    {job.receiverName && (
                                                        <p className="text-xs text-gray-500">Receiver: {job.receiverName}</p>
                                                    )}
                                                </td>

                                                <td className="hidden sm:table-cell whitespace-nowrap text-sm">
                                                    <p className="text-xs text-gray-500">{info.pickedLabel}</p>
                                                    {formatDate(job.picked_up_at)}
                                                </td>

                                                <td className="whitespace-nowrap text-sm">
                                                    {formatDate(job.completed_at)}
                                                </td>

                                                <td className="hidden lg:table-cell text-sm">
                                                    {duration(job.picked_up_at, job.completed_at)}
                                                </td>

                                                <td className="text-right whitespace-nowrap">
                                                    <p className="font-bold text-[#CAEB66]">{money(job.amount)}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {job.capped
                                                            ? "maximum per job"
                                                            : `${job.sharePercent}% of ${money(job.payBase ?? job.parcelCost)}`}
                                                    </p>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>

                                {/* Total of the rows shown */}
                                <tfoot>
                                    <tr>
                                        <td colSpan={7} className="text-right font-semibold">
                                            Total ({visible.length} {visible.length === 1 ? "job" : "jobs"})
                                        </td>
                                        <td className="text-right font-bold text-[#CAEB66] whitespace-nowrap">
                                            {money(sum(visible))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// Summary card
const Stat = ({ icon, label, value, sub, highlight = false }) => (
    <div className="bg-base-100 rounded-xl p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-2">
            <span className="text-[#CAEB66]">{icon}</span> {label}
        </p>
        <p className={`mt-1 font-bold ${highlight ? "text-3xl text-[#CAEB66]" : "text-2xl"}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
);

export default CompletedDeliveries;