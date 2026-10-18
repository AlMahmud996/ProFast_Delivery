import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import {
    FaBoxOpen,
    FaTruck,
    FaCheckCircle,
    FaPhoneAlt,
    FaMapMarkerAlt,
    FaArrowRight,
    FaWarehouse,
    FaTimesCircle,
    FaUndo,
} from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// e.g. "13 Oct 2026, 5:49 PM"
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

// Current status badge
const STATUS_BADGE = {
    rider_assigned: { text: "To pick up", color: "bg-amber-500" },
    picked_up: { text: "Picked up", color: "bg-indigo-600" },
    in_transit: { text: "On the way", color: "bg-purple-600" },
    delivery_rider_assigned: { text: "Collect at warehouse", color: "bg-amber-500" },
    out_for_delivery: { text: "Out for delivery", color: "bg-purple-600" },
    returning: { text: "Returning", color: "bg-red-600" },
    return_rider_assigned: { text: "Return: collect at warehouse", color: "bg-red-500" },
    return_out_for_delivery: { text: "Return: on the way", color: "bg-red-600" },
};

// Reasons a rider can choose for a failed delivery (same keys as the server)
const FAIL_REASONS = {
    unreachable: "Receiver not reachable",
    refused: "Receiver refused the parcel",
    wrong_address: "Wrong or incomplete address",
    not_home: "Receiver not at home",
    other: "Other reason",
};

// Steps that finish the rider's job (they get paid)
const FINISHING_STEPS = ["delivered", "at_origin_hub", "return_at_hub", "returned"];

// Button for the next step (the server sends `nextStep`)
const NEXT_ACTION = {
    picked_up: {
        label: "Mark Picked Up",
        icon: <FaBoxOpen />,
        confirm: "Confirm you have collected this parcel from the sender.",
    },
    in_transit: {
        label: "Start Delivery",
        icon: <FaTruck />,
        confirm: "Confirm you are now on the way to the receiver.",
    },
    at_origin_hub: {
        label: "Drop at Warehouse",
        icon: <FaWarehouse />,
        confirm: "Confirm you handed this parcel to the warehouse. This finishes your job.",
    },
    out_for_delivery: {
        label: "Collect & Start Delivery",
        icon: <FaTruck />,
        confirm: "Confirm you collected this parcel from the warehouse and are on the way.",
    },
    delivered: {
        label: "Mark Delivered",
        icon: <FaCheckCircle />,
        confirm: "Confirm the parcel has been handed to the receiver.",
    },
    // ----- returns -----
    return_at_hub: {
        label: "Return to Warehouse",
        icon: <FaWarehouse />,
        confirm: "Confirm you handed this returned parcel to the warehouse. This finishes your job.",
    },
    return_out_for_delivery: {
        label: "Collect & Return",
        icon: <FaUndo />,
        confirm: "Confirm you collected the returned parcel from the warehouse and are taking it to the sender.",
    },
    returned: {
        label: "Returned to Sender",
        icon: <FaUndo />,
        confirm: "Confirm the parcel has been handed back to the sender.",
    },
};

// What kind of job it is
const LEG_INFO = {
    full: { label: "Full delivery", color: "badge-success" },
    pickup: { label: "Pickup → Warehouse", color: "badge-warning" },
    delivery: { label: "Warehouse → Door", color: "badge-info" },
    return: { label: "Return → Sender", color: "badge-error" },
};

const FILTERS = [
    { key: "all", label: "All" },
    { key: "full", label: "Full delivery" },
    { key: "pickup", label: "Pickup" },
    { key: "delivery", label: "Delivery" },
    { key: "returns", label: "Returns" },
];

const matchesFilter = (p, filter) =>
    filter === "all" ? true : filter === "returns" ? p.isReturn || p.leg === "return" : p.leg === filter && !p.isReturn;

const PendingDeliveries = () => {
    const axiosSecure = useAxiosSecure();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState("all");
    const [updatingId, setUpdatingId] = useState(null);

    const {
        data: parcels = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["riderPendingParcels"],
        retry: 1,
        refetchInterval: 60000, // new assignments show up without a refresh
        queryFn: async () => {
            const res = await axiosSecure.get("/rider/parcels/pending");
            return res.data;
        },
    });

    const visible = parcels.filter((p) => matchesFilter(p, filter));
    const totalExpected = parcels.reduce((sum, p) => sum + (p.estimatedEarning || 0), 0);

    const handleNextStep = async (parcel) => {
        const action = NEXT_ACTION[parcel.nextStep];
        if (!action) return;

        const finishesJob = FINISHING_STEPS.includes(parcel.nextStep);

        const confirm = await Swal.fire({
            title: `${action.label}?`,
            html: `<b>${parcel.parcelName}</b> · ${parcel.tracking_no}<br/><span style="font-size:14px">${action.confirm}</span>`,
            icon: finishesJob ? "question" : "info",
            showCancelButton: true,
            confirmButtonText: `Yes, ${action.label.toLowerCase()}`,
            confirmButtonColor: finishesJob ? "#16a34a" : "#84cc16",
        });

        if (!confirm.isConfirmed) return;

        try {
            setUpdatingId(parcel._id);
            const res = await axiosSecure.patch(`/rider/parcels/${parcel._id}/status`, {
                status: parcel.nextStep,
            });

            if (res.data.modifiedCount > 0) {
                const earned = res.data.earned;
                Swal.fire({
                    title: earned ? "Job complete!" : "Updated",
                    html: earned
                        ? `You earned <b>${money(earned.amount)}</b> (${earned.sharePercent}% of ${money(earned.payBase ?? parcel.cost)}${earned.capped ? ", maximum per job" : ""}).`
                        : `${parcel.parcelName} is now ${parcel.nextStep.replaceAll("_", " ")}.`,
                    icon: "success",
                    timer: earned ? 2500 : 1500,
                    showConfirmButton: false,
                });
                refetch();
                // Keep the Completed Deliveries page in sync
                if (earned) queryClient.invalidateQueries({ queryKey: ["riderCompletedDeliveries"] });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                title: "Could not update",
                text: err?.response?.data?.message || "Something went wrong.",
                icon: "error",
            });
            refetch(); // show the real current state
        } finally {
            setUpdatingId(null);
        }
    };

    // ---------- Failed delivery attempt ----------
    const handleFail = async (parcel) => {
        const attemptNo = (parcel.failedAttemptCount || 0) + 1;
        const isLast = attemptNo >= (parcel.maxAttempts || 2);

        const { isConfirmed, value } = await Swal.fire({
            title: `Failed attempt ${attemptNo} of ${parcel.maxAttempts || 2}`,
            html: `
                <p style="font-size:14px;margin-bottom:10px"><b>${parcel.parcelName}</b> · ${parcel.tracking_no}</p>
                <select id="fail-reason" class="swal2-select" style="width:80%;margin:0 auto 10px;display:block">
                    ${Object.entries(FAIL_REASONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
                </select>
                <textarea id="fail-note" class="swal2-textarea" placeholder="Note (required for 'Other')" maxlength="200" style="width:80%;margin:0 auto;display:block"></textarea>
                ${
                    isLast
                        ? `<p style="font-size:13px;color:#dc2626;margin-top:12px">This is the last attempt. The parcel will be <b>returned to the sender</b>.</p>`
                        : `<p style="font-size:13px;margin-top:12px">You can try delivering again later.</p>`
                }`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: isLast ? "Report & return parcel" : "Report failed attempt",
            confirmButtonColor: "#dc2626",
            preConfirm: () => {
                const reason = document.getElementById("fail-reason").value;
                const note = document.getElementById("fail-note").value.trim();
                if (reason === "other" && !note) {
                    Swal.showValidationMessage("Write a short note for 'Other reason'");
                    return false;
                }
                return { reason, note };
            },
        });

        if (!isConfirmed) return;

        try {
            setUpdatingId(parcel._id);
            const res = await axiosSecure.patch(`/rider/parcels/${parcel._id}/fail`, value);
            Swal.fire({
                title: res.data.returning ? "Parcel will be returned" : "Attempt recorded",
                text: res.data.returning
                    ? "Follow the new step on this card to send it back."
                    : `Attempt ${res.data.failedAttemptCount} of ${res.data.maxAttempts}. Try again when you can.`,
                icon: "info",
            });
            refetch();
        } catch (err) {
            console.error(err);
            Swal.fire({
                title: "Could not report",
                text: err?.response?.data?.message || "Something went wrong.",
                icon: "error",
            });
            refetch();
        } finally {
            setUpdatingId(null);
        }
    };

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
                    {error?.response?.data?.message || "Failed to load your deliveries."}
                </p>
                <button onClick={() => refetch()} className="btn mt-4">
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-[#CAEB66] mb-2">
                        Pending Deliveries ({parcels.length})
                    </h2>
                    <p className="text-gray-500">Jobs assigned to you. Oldest assignments are at the top.</p>
                </div>
                {parcels.length > 0 && (
                    <p className="text-sm text-gray-500">
                        You'll earn <span className="font-bold text-[#CAEB66]">{money(totalExpected)}</span> when
                        these are done
                    </p>
                )}
            </div>

            {parcels.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <FaCheckCircle className="text-5xl text-green-600 mx-auto mb-4" />
                    <p className="text-lg">No pending jobs. You're all caught up!</p>
                </div>
            ) : (
                <>
                    {/* Filter tabs */}
                    <div className="flex flex-wrap gap-2 mb-5">
                        {FILTERS.map((f) => {
                            const n = parcels.filter((p) => matchesFilter(p, f.key)).length;
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
                                    {f.label}
                                    <span className="badge badge-sm">{n}</span>
                                </button>
                            );
                        })}
                    </div>

                    {visible.length === 0 ? (
                        <div className="text-center py-12 bg-base-100 rounded-xl">
                            <p className="text-gray-500">No jobs of this type.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {visible.map((parcel) => (
                                <JobCard
                                    key={parcel._id}
                                    parcel={parcel}
                                    busy={updatingId === parcel._id}
                                    onNext={() => handleNextStep(parcel)}
                                    onFail={() => handleFail(parcel)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// One job card
const JobCard = ({ parcel, busy, onNext, onFail }) => {
    const badge = STATUS_BADGE[parcel.deliveryStatus] || { text: parcel.deliveryStatus, color: "bg-gray-500" };
    const leg = parcel.isReturn && parcel.leg !== "return"
        ? { label: "Returning to sender", color: "badge-error" }
        : LEG_INFO[parcel.leg] || LEG_INFO.full;
    const action = NEXT_ACTION[parcel.nextStep];
    const finishesJob = FINISHING_STEPS.includes(parcel.nextStep);
    const attempts = parcel.failedAttemptCount || 0;
    const lastFail = (parcel.failedAttempts || []).at(-1);

    // Is the rider heading to the first box (start) or already carrying it to the second (end)?
    const headingToStart = ["rider_assigned", "delivery_rider_assigned", "return_rider_assigned"].includes(
        parcel.deliveryStatus
    );

    // People and places
    const sender = {
        title: "Pickup from",
        name: parcel.senderName,
        phone: parcel.senderContact,
        address: parcel.senderAddress,
        note: parcel.pickupInstruction,
    };
    const receiver = {
        title: "Deliver to",
        name: parcel.receiverName,
        phone: parcel.receiverContact,
        address: parcel.receiverAddress,
        note: parcel.deliveryInstruction,
    };
    const originWarehouse = { title: "Drop at", name: `${parcel.senderServiceCenter} warehouse`, warehouse: true };
    const destinationWarehouse = { title: "Collect from", name: `${parcel.receiverServiceCenter} warehouse`, warehouse: true };

    // Start and end of THIS rider's job
    let start;
    let end;
    if (parcel.deliveryStatus === "returning") {
        // Failed twice: from the receiver's area back to the sender (local) or the warehouse (inter-region)
        start = { ...receiver, title: "Failed at" };
        end = parcel.routeType === "local"
            ? { ...sender, title: "Return to" }
            : { ...destinationWarehouse, title: "Return to" };
    } else if (parcel.leg === "return") {
        start = { ...originWarehouse, title: "Collect from" };
        end = { ...sender, title: "Return to" };
    } else if (parcel.leg === "pickup") {
        [start, end] = [sender, originWarehouse];
    } else if (parcel.leg === "delivery") {
        [start, end] = [destinationWarehouse, receiver];
    } else {
        [start, end] = [sender, receiver];
    }

    return (
        <div className={`bg-base-100 rounded-xl shadow-sm p-5 flex flex-col gap-4 ${parcel.isReturn ? "ring-1 ring-red-500/40" : ""}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-lg font-bold truncate">{parcel.parcelName}</h3>
                    <p className="text-xs text-gray-500">
                        <span className="font-mono">{parcel.tracking_no}</span>
                        {" · "}
                        {parcel.parcelType === "document" ? "Document" : "Non-Document"}
                        {parcel.weight ? ` · ${parcel.weight} kg` : ""}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`badge text-white border-0 ${badge.color}`}>{badge.text}</span>
                    <span className={`badge badge-sm ${leg.color}`}>{leg.label}</span>
                </div>
            </div>

            {/* Full route of the parcel */}
            <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{parcel.senderServiceCenter}</span>
                <FaArrowRight className="text-gray-400 text-xs" />
                <span className="font-medium">{parcel.receiverServiceCenter}</span>
                {parcel.routeType === "inter_region" && (
                    <span className="text-xs text-gray-500">(inter-region, by truck)</span>
                )}
            </div>

            {/* Failed attempts so far */}
            {attempts > 0 && (
                <div className="alert alert-warning py-2 text-sm">
                    <FaTimesCircle />
                    <span>
                        {attempts} of {parcel.maxAttempts} delivery attempts failed
                        {lastFail ? ` · last: ${lastFail.reasonText}${lastFail.note ? ` (${lastFail.note})` : ""}` : ""}
                    </span>
                </div>
            )}

            {/* Where to go: the next destination is highlighted */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Place {...start} active={headingToStart} />
                <Place {...end} active={!headingToStart} />
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-base-300">
                <div className="text-xs text-gray-500">
                    <p>Assigned {formatDate(parcel.assigned_at)}</p>
                    <p>
                        You earn <span className="font-bold text-[#CAEB66]">{money(parcel.estimatedEarning)}</span> (
                        {parcel.payCapped
                            ? "maximum per job"
                            : `${parcel.sharePercent}% of ${money(parcel.payBase ?? parcel.cost)}`}
                        )
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                    {parcel.canFail && (
                        <button onClick={onFail} disabled={busy} className="btn btn-sm btn-outline btn-error">
                            <FaTimesCircle /> Failed attempt
                        </button>
                    )}
                    {action && (
                        <button
                            onClick={onNext}
                            disabled={busy}
                            className={`btn btn-sm border-0 ${
                                finishesJob
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : "bg-[#CAEB66] hover:bg-[#b8d955] text-black"
                            }`}
                        >
                            {busy ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <>
                                    {action.icon} {action.label}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// A place the rider goes to (sender, receiver or warehouse)
const Place = ({ title, active, name, phone, address, note, warehouse }) => (
    <div
        className={`rounded-lg p-3 text-sm border ${
            active ? "border-[#CAEB66] bg-[#CAEB66]/10" : "border-base-300 opacity-70"
        }`}
    >
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</p>
        <p className="font-semibold flex items-center gap-1.5">
            {warehouse && <FaWarehouse className="text-[#CAEB66]" />}
            {name || "—"}
        </p>
        {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-[#CAEB66] hover:underline mt-1">
                <FaPhoneAlt className="text-xs" /> {phone}
            </a>
        )}
        {address && (
            <p className="flex items-start gap-1.5 mt-1 text-gray-500">
                <FaMapMarkerAlt className="text-xs mt-1 shrink-0" /> {address}
            </p>
        )}
        {note && <p className="text-xs italic mt-1 text-gray-500">Note: {note}</p>}
    </div>
);

export default PendingDeliveries;