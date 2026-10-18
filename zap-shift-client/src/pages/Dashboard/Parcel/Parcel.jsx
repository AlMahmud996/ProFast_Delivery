import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import Swal from "sweetalert2";
import {
    FaArrowLeft,
    FaMapMarkerAlt,
    FaMotorcycle,
    FaUser,
    FaCopy,
    FaCheckCircle,
} from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// e.g. "06 Oct 2026, 1:11 PM"
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

// Readable delivery status + badge color
const deliveryLabels = {
    pending_assignment: { text: "Waiting for rider", color: "bg-amber-500" },
    rider_assigned: { text: "Rider assigned", color: "bg-blue-600" },
    picked_up: { text: "Picked up", color: "bg-indigo-600" },
    in_transit: { text: "On the way", color: "bg-purple-600" },
    at_origin_hub: { text: "At origin warehouse", color: "bg-sky-600" },
    dispatched_to_hub: { text: "On the truck", color: "bg-purple-600" },
    at_destination_hub: { text: "At destination warehouse", color: "bg-sky-600" },
    delivery_rider_assigned: { text: "Delivery rider assigned", color: "bg-blue-600" },
    out_for_delivery: { text: "Out for delivery", color: "bg-purple-600" },
    delivered: { text: "Delivered", color: "bg-green-600" },
    returning: { text: "Returning to you", color: "bg-red-600" },
    return_at_hub: { text: "Return: at warehouse", color: "bg-red-500" },
    return_in_transit: { text: "Return: on the truck", color: "bg-red-500" },
    return_at_origin_hub: { text: "Return: at your warehouse", color: "bg-red-500" },
    return_rider_assigned: { text: "Return rider assigned", color: "bg-red-500" },
    return_out_for_delivery: { text: "Return: on the way to you", color: "bg-red-600" },
    returned: { text: "Returned to you", color: "bg-gray-600" },
};

const Parcel = () => {
    const { id } = useParams();
    const axiosSecure = useAxiosSecure();
    const navigate = useNavigate();

    // The parcel itself (server only returns it to its owner)
    const {
        data: parcel,
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ["parcel", id],
        retry: 1,
        queryFn: async () => {
            const res = await axiosSecure.get(`/parcels/${id}`);
            return res.data;
        },
    });

    // Tracking timeline, only once the parcel is paid and has a tracking number
    const { data: tracking } = useQuery({
        queryKey: ["parcelTracking", parcel?.tracking_no],
        enabled: !!parcel?.tracking_no,
        queryFn: async () => {
            const res = await axiosSecure.get(`/tracking/${parcel.tracking_no}`);
            return res.data;
        },
    });

    const timeline = tracking?.timeline || [];

    const copyText = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            Swal.fire({
                title: "Copied",
                icon: "success",
                timer: 1000,
                showConfirmButton: false,
                toast: true,
                position: "top-end",
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async () => {
        const result = await Swal.fire({
            title: "Delete this parcel?",
            text: `${parcel.parcelName} will be removed. This cannot be undone.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, delete",
            confirmButtonColor: "#ef4444",
        });

        if (!result.isConfirmed) return;

        try {
            const res = await axiosSecure.delete(`/parcels/${parcel._id}`);
            if (res.data.deletedCount > 0) {
                await Swal.fire({
                    title: "Deleted",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                });
                navigate("/dashboard/myParcels");
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ title: "Error", text: "Could not delete the parcel.", icon: "error" });
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

    if (isError || !parcel) {
        const status = error?.response?.status;
        return (
            <div className="text-center py-16">
                <p className="text-error text-lg">
                    {status === 403
                        ? "You can only view your own parcels."
                        : status === 404
                        ? "Parcel not found."
                        : error?.response?.data?.message || "Failed to load the parcel."}
                </p>
                <Link to="/dashboard/myParcels" className="btn mt-4">
                    <FaArrowLeft /> Back to My Parcels
                </Link>
            </div>
        );
    }

    const isPaid = parcel.paymentStatus === "paid";
    const delivery = isPaid
        ? deliveryLabels[parcel.deliveryStatus] || deliveryLabels.pending_assignment
        : null;

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* ---------- Header ---------- */}
            <div>
                <Link
                    to="/dashboard/myParcels"
                    className="text-sm text-gray-500 hover:text-[#CAEB66] inline-flex items-center gap-2"
                >
                    <FaArrowLeft /> My Parcels
                </Link>

                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-3">
                    <div>
                        <h2 className="text-3xl font-bold text-[#CAEB66]">{parcel.parcelName}</h2>
                        <p className="text-gray-500 mt-1">
                            {parcel.senderServiceCenter} → {parcel.receiverServiceCenter} · Booked{" "}
                            {formatDate(parcel.creationDate)}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <span
                            className={`badge text-white border-0 ${
                                isPaid ? "bg-green-600" : "bg-red-600"
                            }`}
                        >
                            {isPaid ? "Paid" : "Unpaid"}
                        </span>
                        {delivery && (
                            <span className={`badge text-white border-0 ${delivery.color}`}>
                                {delivery.text}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ---------- Summary cards ---------- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard label="Cost" value={`৳${parcel.cost}`} highlight />
                <SummaryCard
                    label="Type"
                    value={parcel.parcelType === "document" ? "Document" : "Non-Document"}
                />
                <SummaryCard
                    label="Weight"
                    value={parcel.parcelWeight ? `${parcel.parcelWeight} kg` : "—"}
                />
                <div className="bg-base-100 rounded-xl p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                        {parcel.tracking_no ? "Tracking No" : "Booking ID"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="font-mono font-semibold break-all">
                            {parcel.tracking_no || parcel.trackingId || "—"}
                        </p>
                        {(parcel.tracking_no || parcel.trackingId) && (
                            <button
                                onClick={() => copyText(parcel.tracking_no || parcel.trackingId)}
                                className="btn btn-ghost btn-xs"
                                title="Copy"
                            >
                                <FaCopy />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ---------- Sender / Receiver ---------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PartyCard
                    title="Sender"
                    icon={<FaUser />}
                    name={parcel.senderName}
                    contact={parcel.senderContact}
                    region={parcel.senderRegion}
                    center={parcel.senderServiceCenter}
                    address={parcel.senderAddress}
                    note={parcel.pickupInstruction}
                    noteLabel="Pickup instruction"
                />
                <PartyCard
                    title="Receiver"
                    icon={<FaMapMarkerAlt />}
                    name={parcel.receiverName}
                    contact={parcel.receiverContact}
                    region={parcel.receiverRegion}
                    center={parcel.receiverServiceCenter}
                    address={parcel.receiverAddress}
                    note={parcel.deliveryInstruction}
                    noteLabel="Delivery instruction"
                />
            </div>

            {/* ---------- Riders ---------- */}
            {isPaid && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RiderCard
                        title={parcel.routeType === "inter_region" ? "Pickup rider" : "Rider"}
                        rider={
                            parcel.pickup_rider ||
                            (parcel.assigned_rider_name && !parcel.delivery_rider
                                ? { name: parcel.assigned_rider_name, contact: parcel.assigned_rider_contact }
                                : null)
                        }
                        waitingText="We'll assign a pickup rider soon."
                    />
                    {parcel.routeType === "inter_region" && (
                        <RiderCard
                            title="Delivery rider"
                            rider={parcel.delivery_rider}
                            waitingText={`Assigned when the parcel reaches the ${parcel.receiverServiceCenter} warehouse.`}
                        />
                    )}
                    {parcel.return_rider && (
                        <RiderCard title="Return rider" rider={parcel.return_rider} waitingText="" />
                    )}
                </div>
            )}

            {/* ---------- Failed delivery attempts ---------- */}
            {parcel.failedAttempts?.length > 0 && (
                <div className="bg-base-100 rounded-xl p-5 shadow-sm border border-red-500/30">
                    <h3 className="text-lg font-semibold mb-3 text-red-400">
                        Delivery attempts failed ({parcel.failedAttempts.length})
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {parcel.failedAttempts.map((a, i) => (
                            <li key={i} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                <span>
                                    <b>Attempt {i + 1}:</b> {a.reasonText}
                                    {a.note ? ` (${a.note})` : ""}
                                    {a.rider_name ? ` · by ${a.rider_name}` : ""}
                                </span>
                                <span className="text-xs text-gray-500">{formatDate(a.at)}</span>
                            </li>
                        ))}
                    </ul>
                    {["returning", "return_at_hub", "return_in_transit", "return_at_origin_hub", "return_rider_assigned", "return_out_for_delivery", "returned"].includes(parcel.deliveryStatus) && (
                        <p className="text-sm text-gray-500 mt-3">
                            {parcel.deliveryStatus === "returned"
                                ? "The parcel was returned to you."
                                : "The parcel is on its way back to you."}
                        </p>
                    )}
                </div>
            )}

            {/* ---------- Timeline ---------- */}
            {isPaid && (
                <div className="bg-base-100 rounded-xl p-5 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Tracking history</h3>

                    {timeline.length === 0 ? (
                        <p className="text-sm text-gray-500">No updates yet.</p>
                    ) : (
                        <ol className="relative border-s border-base-300 ms-2 space-y-5">
                            {timeline.map((step, i) => {
                                const latest = i === timeline.length - 1;
                                return (
                                    <li key={step._id || i} className="ms-5">
                                        <span
                                            className={`absolute -start-2 w-4 h-4 rounded-full border-2 border-base-100 ${
                                                latest ? "bg-[#CAEB66]" : "bg-gray-400"
                                            }`}
                                        ></span>
                                        <p className={`font-medium ${latest ? "text-[#CAEB66]" : ""}`}>
                                            {step.message}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {formatDate(step.created_at)}
                                        </p>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            )}

            {/* ---------- Actions ---------- */}
            <div className="flex flex-wrap gap-3">
                {!isPaid ? (
                    <>
                        <Link
                            to={`/dashboard/pay/${parcel._id}`}
                            className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                        >
                            Pay ৳{parcel.cost}
                        </Link>
                        <button onClick={handleDelete} className="btn btn-error text-white">
                            Delete
                        </button>
                    </>
                ) : (
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                        <FaCheckCircle className="text-green-600" />
                        Paid on {formatDate(parcel.paid_at)}
                    </p>
                )}
            </div>
        </div>
    );
};

// Pickup or delivery rider
const RiderCard = ({ title, rider, waitingText }) => (
    <div className="bg-base-100 rounded-xl p-5 shadow-sm flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#CAEB66]/15 flex items-center justify-center shrink-0">
            <FaMotorcycle className="text-xl text-[#CAEB66]" />
        </div>
        <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
            {rider ? (
                <>
                    <p className="font-semibold">{rider.name}</p>
                    {rider.contact && <p className="text-sm text-gray-500 font-mono">{rider.contact}</p>}
                </>
            ) : (
                <>
                    <p className="font-semibold">Not assigned yet</p>
                    <p className="text-sm text-gray-500">{waitingText}</p>
                </>
            )}
        </div>
    </div>
);

// Small stat card
const SummaryCard = ({ label, value, highlight = false }) => (
    <div className="bg-base-100 rounded-xl p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`mt-1 font-semibold ${highlight ? "text-2xl text-[#CAEB66]" : "text-lg"}`}>
            {value}
        </p>
    </div>
);

// Sender or receiver details
const PartyCard = ({ title, icon, name, contact, region, center, address, note, noteLabel }) => (
    <div className="bg-base-100 rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <span className="text-[#CAEB66]">{icon}</span> {title}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Info label="Name" value={name} />
            <Info label="Contact" value={contact} mono />
            <Info label="Region" value={region} />
            <Info label="Service center" value={center} />
            <div className="sm:col-span-2">
                <Info label="Address" value={address} />
            </div>
            {note && (
                <div className="sm:col-span-2">
                    <Info label={noteLabel} value={note} />
                </div>
            )}
        </div>
    </div>
);

// One label/value pair
const Info = ({ label, value, mono = false }) => (
    <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`font-medium break-words ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
);

export default Parcel;