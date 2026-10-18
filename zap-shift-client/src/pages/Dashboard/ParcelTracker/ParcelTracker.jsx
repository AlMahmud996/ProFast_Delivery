import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
    FaSearch,
    FaUser,
    FaMotorcycle,
    FaWarehouse,
    FaTruck,
    FaFlagCheckered,
    FaChevronLeft,
    FaChevronRight,
    FaMapMarkerAlt,
    FaTimesCircle,
} from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

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

const money = (n) => `৳${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const FILTERS = [
    { key: "all", label: "All" },
    { key: "needs_rider", label: "Needs rider" },
    { key: "with_rider", label: "With a rider" },
    { key: "warehouse", label: "Warehouse / truck" },
    { key: "returns", label: "Returns" },
    { key: "delivered", label: "Delivered" },
    { key: "unpaid", label: "Unpaid" },
];

// Colour for "who has the parcel now"
const HOLDER_STYLE = {
    sender: "bg-gray-500",
    rider: "bg-blue-600",
    warehouse: "bg-sky-600",
    truck: "bg-purple-600",
    receiver: "bg-green-600",
    unknown: "bg-gray-500",
};

const NODE_ICON = {
    person: <FaUser />,
    rider: <FaMotorcycle />,
    warehouse: <FaWarehouse />,
    truck: <FaTruck />,
};

// Waits until the admin stops typing before searching
const useDebounced = (value, ms = 400) => {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
};

const ParcelTracker = () => {
    const axiosSecure = useAxiosSecure();
    const modalRef = useRef(null);

    const [searchInput, setSearchInput] = useState("");
    const search = useDebounced(searchInput.trim());
    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState(null);

    // Back to page 1 when the search or filter changes (done in the handlers, not in an effect)
    const handleSearch = (e) => {
        setSearchInput(e.target.value);
        setPage(1);
    };
    const handleStatus = (key) => {
        setStatus(key);
        setPage(1);
    };

    const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
        queryKey: ["adminParcels", search, status, page],
        placeholderData: keepPreviousData,
        retry: 1,
        queryFn: async () =>
            (await axiosSecure.get("/admin/parcels", { params: { search, status, page, limit: 10 } })).data,
    });

    const { data: detail, isFetching: detailLoading } = useQuery({
        queryKey: ["parcelJourney", selectedId],
        enabled: !!selectedId,
        queryFn: async () => (await axiosSecure.get(`/admin/parcels/${selectedId}/journey`)).data,
    });

    const openParcel = (id) => {
        setSelectedId(id);
        modalRef.current?.showModal();
    };

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
                <p className="text-error text-lg">{error?.response?.data?.message || "Failed to load parcels."}</p>
                <button onClick={() => refetch()} className="btn mt-4">Try again</button>
            </div>
        );
    }

    const parcels = data?.parcels || [];

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-2">Parcel Tracker</h2>
            <p className="text-gray-500 mb-6">
                Every parcel, where it is right now, and who handled it: sender → riders → receiver.
            </p>

            {/* Search + filters */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
                <label className="input input-bordered flex items-center gap-2 w-full lg:w-96">
                    <FaSearch className="opacity-60" />
                    <input
                        type="search"
                        value={searchInput}
                        onChange={handleSearch}
                        placeholder="Tracking no, parcel, sender, receiver, rider"
                        className="grow"
                    />
                    {isFetching && <span className="loading loading-spinner loading-xs"></span>}
                </label>
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => handleStatus(f.key)}
                            className={`btn btn-sm ${
                                status === f.key ? "bg-[#CAEB66] text-black border-0 hover:bg-[#b8d955]" : "btn-outline"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {parcels.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-gray-500">No parcels found.</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-md">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>Parcel</th>
                                <th className="hidden md:table-cell">Sender</th>
                                <th>Where it is now</th>
                                <th className="hidden lg:table-cell">Riders</th>
                                <th className="hidden sm:table-cell">Receiver</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {parcels.map((p) => (
                                <tr key={p._id} className="hover cursor-pointer" onClick={() => openParcel(p._id)}>
                                    <td>
                                        <p className="font-semibold">{p.parcelName}</p>
                                        <p className="text-xs text-gray-500">
                                            <span className="font-mono">{p.tracking_no || p.trackingId}</span> ·{" "}
                                            {p.senderServiceCenter} → {p.receiverServiceCenter}
                                        </p>
                                    </td>
                                    <td className="hidden md:table-cell text-sm">
                                        <p>{p.senderName || "—"}</p>
                                        <p className="text-xs text-gray-500 truncate max-w-[12rem]">{p.senderEmail}</p>
                                    </td>
                                    <td className="text-sm max-w-xs">
                                        <span className={`badge badge-xs text-white border-0 mr-1.5 capitalize ${HOLDER_STYLE[p.location.holder]}`}>
                                            {p.location.holder}
                                        </span>
                                        {p.location.text}
                                        {p.failedAttemptCount > 0 && (
                                            <p className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                                                <FaTimesCircle /> {p.failedAttemptCount} failed attempt{p.failedAttemptCount > 1 ? "s" : ""}
                                            </p>
                                        )}
                                    </td>
                                    <td className="hidden lg:table-cell text-xs">
                                        <p>Pickup: {p.pickupRider || "—"}</p>
                                        {p.routeType === "inter_region" && <p>Delivery: {p.deliveryRider || "—"}</p>}
                                    </td>
                                    <td className="hidden sm:table-cell text-sm">{p.receiverName || "—"}</td>
                                    <td>
                                        <button className="btn btn-xs btn-outline">Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {data?.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm">
                    <p className="text-gray-500">
                        {data.total} parcels · page {data.page} of {data.totalPages}
                    </p>
                    <div className="join">
                        <button
                            className="btn btn-sm join-item"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <FaChevronLeft />
                        </button>
                        <button
                            className="btn btn-sm join-item"
                            disabled={page >= data.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <FaChevronRight />
                        </button>
                    </div>
                </div>
            )}

            {/* Journey modal */}
            <dialog ref={modalRef} className="modal" onClose={() => setSelectedId(null)}>
                <div className="modal-box max-w-3xl">
                    {!detail || detailLoading ? (
                        <div className="flex justify-center py-16">
                            <span className="loading loading-spinner loading-lg"></span>
                        </div>
                    ) : (
                        <JourneyDetail detail={detail} />
                    )}
                    <div className="modal-action">
                        <form method="dialog">
                            <button className="btn btn-ghost">Close</button>
                        </form>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </div>
    );
};

// Full picture of one parcel: chain of handlers, current location, timeline
const JourneyDetail = ({ detail }) => {
    const { parcel, location, journey, timeline } = detail;

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                    <h3 className="text-2xl font-bold text-[#CAEB66]">{parcel.parcelName}</h3>
                    <p className="text-sm text-gray-500">
                        <span className="font-mono">{parcel.tracking_no || parcel.trackingId}</span> ·{" "}
                        {parcel.senderServiceCenter} → {parcel.receiverServiceCenter} · {money(parcel.cost)} ·{" "}
                        {parcel.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                    </p>
                </div>
            </div>

            {/* Where it is now */}
            <div className="mt-4 rounded-xl border border-[#CAEB66]/50 bg-[#CAEB66]/10 p-4 flex items-start gap-3">
                <FaMapMarkerAlt className="text-[#CAEB66] mt-1 shrink-0" />
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Right now</p>
                    <p className="font-semibold">{location.text}</p>
                </div>
            </div>

            {/* Chain: who handled it */}
            <div className="mt-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Journey</p>
                <ol className="relative border-s border-base-300 ms-3 space-y-4">
                    {journey.map((node) => {
                        const color =
                            node.state === "done"
                                ? "bg-green-600 text-white"
                                : node.state === "current"
                                ? "bg-[#CAEB66] text-black ring-4 ring-[#CAEB66]/30"
                                : "bg-base-300 text-gray-500";
                        return (
                            <li key={node.key} className="ms-6">
                                <span className={`absolute -start-3.5 flex items-center justify-center w-7 h-7 rounded-full text-xs ${color}`}>
                                    {node.key === "receiver" ? <FaFlagCheckered /> : NODE_ICON[node.type]}
                                </span>
                                <p className={`text-xs uppercase tracking-wide ${node.state === "current" ? "text-[#CAEB66]" : "text-gray-500"}`}>
                                    {node.label}
                                    {node.state === "current" && " · here now"}
                                </p>
                                <p className={`font-medium ${node.state === "upcoming" ? "text-gray-500" : ""}`}>
                                    {node.name || (node.type === "rider" ? "Not assigned yet" : "—")}
                                </p>
                                {node.detail && <p className="text-xs text-gray-500">{node.detail}</p>}
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* Contacts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
                <div className="rounded-lg border border-base-300 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Sender</p>
                    <p className="font-semibold">{parcel.senderName || "—"}</p>
                    <p className="text-xs text-gray-500">{parcel.created_by}</p>
                    <p className="text-xs text-gray-500">{parcel.senderContact} · {parcel.senderAddress}</p>
                </div>
                <div className="rounded-lg border border-base-300 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Receiver</p>
                    <p className="font-semibold">{parcel.receiverName || "—"}</p>
                    <p className="text-xs text-gray-500">{parcel.receiverContact} · {parcel.receiverAddress}</p>
                </div>
            </div>

            {/* Timeline */}
            <div className="mt-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Timeline</p>
                {timeline.length === 0 ? (
                    <p className="text-sm text-gray-500">No updates yet.</p>
                ) : (
                    <ul className="space-y-2 text-sm max-h-60 overflow-y-auto pr-1">
                        {timeline.map((t) => (
                            <li key={t._id} className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-4">
                                <span>{t.message}</span>
                                <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(t.created_at)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default ParcelTracker;