import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
    FaBoxOpen,
    FaShippingFast,
    FaCheckCircle,
    FaUndo,
    FaWallet,
    FaPlus,
    FaMapMarkerAlt,
    FaArrowRight,
    FaMotorcycle,
} from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// ৳1,234.5 style money (kept private to this file)
const money = (n) => `৳${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Home page for normal users (senders)
const UserHome = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["userOverview", user?.email],
        enabled: !!user?.email,
        retry: 1,
        refetchInterval: 60000,
        queryFn: async () => (await axiosSecure.get("/user/overview")).data,
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
                <p className="text-error text-lg">{error?.response?.data?.message || "Failed to load your home page."}</p>
                <button onClick={() => refetch()} className="btn mt-4">Try again</button>
            </div>
        );
    }

    const { counts } = data;
    const name = data.name || user?.displayName || "there";

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Greeting + quick actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold">Hi, {name.split(" ")[0]} 👋</h2>
                    <p className="text-gray-500">Here's what's happening with your parcels.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link to="/sendParcel" className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0">
                        <FaPlus /> Send a Parcel
                    </Link>
                    <Link to="/dashboard/track" className="btn btn-outline">
                        <FaMapMarkerAlt /> Track
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Stat icon={<FaBoxOpen />} label="All parcels" value={counts.total} to="/dashboard/myParcels" />
                <Stat icon={<FaShippingFast />} label="On the way" value={counts.active} highlight={counts.active > 0} />
                <Stat icon={<FaCheckCircle />} label="Delivered" value={counts.delivered} />
                <Stat icon={<FaUndo />} label="Returned" value={counts.returned} />
                <Stat icon={<FaWallet />} label="Total spent" value={money(data.totalSpent)} to="/dashboard/payment-history" />
            </div>

            {/* Unpaid parcels */}
            {counts.unpaid > 0 && (
                <div className="bg-base-100 rounded-xl shadow-sm p-5 ring-1 ring-amber-500/50">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">
                            Waiting for payment ({counts.unpaid}) · {money(data.amountDue)}
                        </h3>
                        <Link to="/dashboard/myParcels" className="text-sm text-[#CAEB66] hover:underline">
                            See all
                        </Link>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">These parcels won't be picked up until they're paid.</p>
                    <ul className="divide-y divide-base-300">
                        {data.unpaidParcels.map((p) => (
                            <li key={p._id} className="py-2.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{p.parcelName}</p>
                                    <p className="text-xs text-gray-500">
                                        {p.senderServiceCenter} → {p.receiverServiceCenter}
                                    </p>
                                </div>
                                <Link
                                    to={`/dashboard/pay/${p._id}`}
                                    className="btn btn-sm bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                                >
                                    Pay {money(p.cost)}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Parcels on the way */}
            <div className="bg-base-100 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">On the way</h3>
                    <Link to="/dashboard/myParcels" className="text-sm text-[#CAEB66] hover:underline inline-flex items-center gap-1">
                        My Parcels <FaArrowRight className="text-xs" />
                    </Link>
                </div>

                {data.activeParcels.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No parcels on the way right now.</p>
                        <Link to="/sendParcel" className="btn btn-sm mt-3 btn-outline">
                            <FaPlus /> Send one
                        </Link>
                    </div>
                ) : (
                    <ul className="divide-y divide-base-300">
                        {data.activeParcels.map((p) => (
                            <li key={p._id}>
                                <Link
                                    to={`/dashboard/parcel/${p._id}`}
                                    className="py-3 flex items-start justify-between gap-3 hover:bg-base-200 -mx-2 px-2 rounded-lg transition"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">
                                            {p.parcelName}{" "}
                                            <span className="text-xs text-gray-500 font-mono">#{p.tracking_no}</span>
                                        </p>
                                        <p className="text-sm text-gray-400 flex items-start gap-1.5 mt-0.5">
                                            <FaMapMarkerAlt className="text-[#CAEB66] mt-1 shrink-0 text-xs" />
                                            {p.location}
                                        </p>
                                        {p.rider && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                <FaMotorcycle /> {p.rider}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                        {p.senderServiceCenter} → {p.receiverServiceCenter}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const Stat = ({ icon, label, value, to, highlight }) => {
    const body = (
        <div
            className={`bg-base-100 rounded-xl p-5 shadow-sm h-full transition ${to ? "hover:ring-2 hover:ring-[#CAEB66]" : ""} ${
                highlight ? "ring-1 ring-[#CAEB66]" : ""
            }`}
        >
            <p className="text-xs uppercase tracking-wide text-gray-500 flex items-center gap-2">
                <span className="text-[#CAEB66]">{icon}</span> {label}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
    );
    return to ? <Link to={to}>{body}</Link> : body;
};

export default UserHome;