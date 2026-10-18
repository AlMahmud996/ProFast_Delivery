import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

const formatDate = (iso) =>
    new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

// Readable labels for the statuses in the requirement doc
const statusLabel = (status) =>
    ({
        unpaid: "Unpaid",
        paid: "Paid",
        "ready-to-pickup": "Ready to pick up",
        "in-transit": "In transit",
        "reached-service-center": "Reached service center",
        shipped: "Shipped",
        "ready-for-delivery": "Ready for delivery",
        delivered: "Delivered",
    }[status] || status);

const TrackParcel = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();

    // The tracking number lives in the URL (?no=123456), so the page can be linked to from My Parcels
    const [searchParams, setSearchParams] = useSearchParams();
    const trackingNo = searchParams.get("no") || "";

    const [input, setInput] = useState(trackingNo);
    const [inputError, setInputError] = useState("");

    // Timeline of the searched parcel
    const {
        data: result,
        isLoading: searching,
        error: searchError,
    } = useQuery({
        queryKey: ["tracking", trackingNo],
        enabled: !!trackingNo,
        retry: false, // a wrong tracking number should show "not found" at once
        queryFn: async () => {
            const res = await axiosSecure.get(`/tracking/${trackingNo}`);
            return res.data;
        },
    });

    // The user's own updates, shown as notifications
    const { data: updates = [], isLoading: loadingUpdates } = useQuery({
        queryKey: ["myTracking", user?.email],
        enabled: !!user?.email,
        queryFn: async () => {
            const res = await axiosSecure.get("/tracking", {
                params: { email: user?.email },
            });
            return res.data;
        },
    });

    const handleSearch = (e) => {
        e.preventDefault();
        const value = input.trim();

        if (!/^\d{6}$/.test(value)) {
            setInputError("Enter a valid 6 digit tracking number");
            return;
        }

        setInputError("");
        setSearchParams({ no: value });
    };

    const openDetails = (no) => {
        setInput(no);
        setInputError("");
        setSearchParams({ no });
        window.scrollTo({ top: 0, behavior: "smooth" }); // bring the user up to the timeline
    };

    const timeline = result?.timeline || [];
    const lastIndex = timeline.length - 1;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-2">Track a Parcel</h2>
            <p className="text-gray-500 mb-6">
                Enter the 6 digit tracking number you received after payment.
            </p>

            {/* ============ SEARCH ============ */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-2">
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={input}
                    onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} // digits only
                    placeholder="Tracking number, e.g. 482915"
                    className="input input-bordered w-full font-mono"
                />
                <button type="submit" className="btn bg-[#CAEB66] text-black">
                    Track
                </button>
            </form>
            {inputError && <p className="text-error text-sm mb-4">{inputError}</p>}

            {/* ============ RESULT ============ */}
            {trackingNo && (
                <div className="card bg-base-100 shadow-md border border-base-300 mt-6">
                    <div className="h-1.5 bg-[#CAEB66]"></div> {/* matches the accent bar on the payment card */}

                    <div className="card-body">
                        {searching && (
                            <div className="flex justify-center py-10">
                                <span className="loading loading-spinner loading-lg"></span>
                            </div>
                        )}

                        {/* Not found */}
                        {searchError && !searching && (
                            <p className="text-center py-8">
                                No parcel found with tracking number{" "}
                                <span className="font-mono font-semibold">{trackingNo}</span>.
                            </p>
                        )}

                        {result && (
                            <>
                                {/* Parcel summary */}
                                <div className="mb-6">
                                    <p className="text-sm text-gray-500">Parcel</p>
                                    <h3 className="text-2xl font-bold text-[#CAEB66]">
                                        {result.parcel.parcelName}
                                    </h3>
                                    <p className="text-white mt-1">
                                        {result.parcel.senderServiceCenter} → {result.parcel.receiverServiceCenter}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Tracking No:{" "}
                                        <span className="font-mono">{result.parcel.tracking_no}</span>
                                    </p>
                                </div>

                                {/* Timeline: oldest at the top, latest highlighted at the bottom */}
                                <ul className="relative border-l-2 border-base-300 ml-3 space-y-6">
                                    {timeline.map((item, index) => {
                                        const isLatest = index === lastIndex;

                                        return (
                                            <li key={item._id} className="ml-6 relative">
                                                <span
                                                    className={`absolute -left-[34px] top-1 w-4 h-4 rounded-full border-2 ${
                                                        isLatest
                                                            ? "bg-[#CAEB66] border-[#CAEB66]"
                                                            : "bg-base-100 border-base-300"
                                                    }`}
                                                ></span>

                                                <p className={`font-semibold ${isLatest ? "text-[#CAEB66]" : ""}`}>
                                                    {statusLabel(item.status)}
                                                </p>
                                                <p className="text-sm">{item.message}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {formatDate(item.created_at)}
                                                </p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ============ MY UPDATES (notification format) ============ */}
            <h3 className="text-xl font-bold mt-10 mb-4">My tracking updates</h3>

            {loadingUpdates ? (
                <div className="flex justify-center py-10">
                    <span className="loading loading-spinner"></span>
                </div>
            ) : updates.length === 0 ? (
                <div className="text-center py-10 bg-base-100 rounded-xl">
                    <p>No tracking updates yet. They appear here once you pay for a parcel.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {updates.map((item) => (
                        <div
                            key={item._id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-base-100 border border-base-300 rounded-xl p-4"
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="badge bg-[#CAEB66] text-black border-0">
                                        {statusLabel(item.status)}
                                    </span>
                                    <span className="font-mono text-xs text-gray-500">
                                        #{item.tracking_no}
                                    </span>
                                </div>
                                <p className="text-sm">{item.message}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {formatDate(item.created_at)}
                                </p>
                            </div>

                            <button
                                onClick={() => openDetails(item.tracking_no)}
                                className="btn btn-sm btn-outline"
                            >
                                View details
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TrackParcel;