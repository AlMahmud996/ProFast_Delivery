import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { FaMotorcycle, FaMapMarkerAlt } from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// e.g. "13 Oct 2026, 4:45 PM"
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

// Why the parcel needs an admin
const reasonLabel = (parcel) => {
    if (parcel.assignment_reason === "no_rider_in_district")
        return `No rider in ${parcel.leg === "return" ? parcel.senderServiceCenter : parcel.receiverServiceCenter}`;
    if (parcel.assignment_reason === "no_rider_available") return "No rider free in area";
    if (parcel.assignment_reason === "rider_unavailable") return "Previous rider unavailable";
    if (parcel.leg === "return") return "Return: back at warehouse";
    if (parcel.leg === "delivery") return "Arrived at warehouse";
    if (parcel.senderRegion && parcel.senderRegion === parcel.receiverRegion) return "Needs rider";
    return "Inter-region";
};

// Which job the rider will do
const LEG_LABEL = {
    pickup: { text: "Pickup", color: "badge-warning" },
    delivery: { text: "Delivery", color: "badge-info" },
    return: { text: "Return", color: "badge-error" },
};

const AssignRider = () => {
    const axiosSecure = useAxiosSecure();
    const queryClient = useQueryClient();
    const modalRef = useRef(null);

    const [selectedParcel, setSelectedParcel] = useState(null);
    const [selectedRiderId, setSelectedRiderId] = useState("");
    const [assigning, setAssigning] = useState(false);

    // Paid parcels waiting for a rider (refreshes every 30 seconds)
    const {
        data: parcels = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["pendingAssignment"],
        retry: 1,
        refetchInterval: 30000,
        queryFn: async () => {
            const res = await axiosSecure.get("/admin/parcels/pending-assignment");
            return res.data;
        },
    });

    // Riders for the parcel open in the modal
    const {
        data: riderData,
        isFetching: ridersLoading,
    } = useQuery({
        queryKey: ["availableRiders", selectedParcel?._id],
        enabled: !!selectedParcel,
        queryFn: async () => {
            const res = await axiosSecure.get("/admin/riders/available", {
                params: { parcelId: selectedParcel._id },
            });
            return res.data;
        },
    });

    const riders = riderData?.riders || [];

    // ---------- Modal ----------
    const openModal = (parcel) => {
        setSelectedParcel(parcel);
        setSelectedRiderId("");
        modalRef.current?.showModal();
    };

    const closeModal = () => {
        modalRef.current?.close();
        setSelectedParcel(null);
        setSelectedRiderId("");
    };

    // ---------- Assign ----------
    const handleAssign = async () => {
        const rider = riders.find((r) => r._id === selectedRiderId);
        if (!selectedParcel || !rider) return;

        // A rider from another district needs the admin's explicit OK
        if (!rider.sameDistrict) {
            const target = riderData?.pickupDistrict;
            modalRef.current?.close();
            const ok = await Swal.fire({
                title: "Send a rider from another district?",
                html: `<b>${rider.name}</b> is based in <b>${rider.warehouse}</b>${
                    rider.distanceKm != null ? ` (about ${rider.distanceKm} km away)` : ""
                }.<br/>They will have to travel to <b>${target}</b> for this job.`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Yes, assign",
                confirmButtonColor: "#84cc16",
            });
            if (!ok.isConfirmed) {
                modalRef.current?.showModal();
                return;
            }
        }

        try {
            setAssigning(true);
            const res = await axiosSecure.patch(
                `/admin/parcels/${selectedParcel._id}/assign-rider`,
                { riderId: rider._id }
            );

            if (res.data.modifiedCount > 0) {
                closeModal();
                Swal.fire({
                    title: "Rider assigned",
                    text:
                        selectedParcel.leg === "return"
                            ? `${rider.name} will bring "${selectedParcel.parcelName}" back to the sender.`
                            : selectedParcel.leg === "delivery"
                            ? `${rider.name} will deliver "${selectedParcel.parcelName}" from the warehouse.`
                            : `${rider.name} will pick up "${selectedParcel.parcelName}".`,
                    icon: "success",
                    timer: 1800,
                    showConfirmButton: false,
                });
                refetch();
                // Update the sidebar notification badge right away
                queryClient.invalidateQueries({ queryKey: ["pendingAssignmentCount"] });
            }
        } catch (err) {
            console.error(err);
            modalRef.current?.close();
            Swal.fire({
                title: "Could not assign",
                text: err?.response?.data?.message || "Something went wrong.",
                icon: "error",
            });
        } finally {
            setAssigning(false);
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
                    {error?.response?.data?.message || "Failed to load parcels."}
                </p>
                <button onClick={() => refetch()} className="btn mt-4">
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-2">
                Assign Rider ({parcels.length})
            </h2>
            <p className="text-gray-500 mb-6">
                <b>Pickup</b>: a rider collects the parcel from the sender. <b>Delivery</b>: an
                inter-region parcel reached the destination warehouse and needs a rider to take it to
                the door. Riders are assigned automatically when one is free; the rest need you.
            </p>

            {parcels.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-lg">All paid parcels have a rider. Nothing to assign.</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-md">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Parcel</th>
                                <th>Job</th>
                                <th>Route</th>
                                <th className="hidden md:table-cell">Reason</th>
                                <th className="hidden sm:table-cell">Cost</th>
                                <th className="hidden lg:table-cell">Paid</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {parcels.map((parcel, index) => (
                                <tr key={parcel._id}>
                                    <td>{index + 1}</td>

                                    <td>
                                        <p className="font-semibold">{parcel.parcelName}</p>
                                        <p className="text-xs text-gray-500 font-mono">
                                            {parcel.tracking_no}
                                        </p>
                                    </td>

                                    <td>
                                        <span className={`badge badge-sm ${LEG_LABEL[parcel.leg]?.color || "badge-warning"}`}>
                                            {LEG_LABEL[parcel.leg]?.text || "Pickup"}
                                        </span>
                                    </td>

                                    <td className="text-sm">
                                        <p>
                                            {parcel.senderServiceCenter} → {parcel.receiverServiceCenter}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {parcel.senderRegion || "?"} → {parcel.receiverRegion || "?"}
                                        </p>
                                    </td>

                                    <td className="hidden md:table-cell">
                                        <span className="badge badge-warning badge-sm whitespace-nowrap">
                                            {reasonLabel(parcel)}
                                        </span>
                                    </td>

                                    <td className="hidden sm:table-cell font-semibold">৳{parcel.cost}</td>

                                    <td className="hidden lg:table-cell whitespace-nowrap text-sm">
                                        {formatDate(parcel.paid_at || parcel.creationDate)}
                                    </td>

                                    <td>
                                        <button
                                            onClick={() => openModal(parcel)}
                                            className="btn btn-sm bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                                        >
                                            <FaMotorcycle /> Assign
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ---------- Rider picker modal ---------- */}
            <dialog ref={modalRef} className="modal" onClose={() => setSelectedParcel(null)}>
                <div className="modal-box max-w-2xl">
                    {selectedParcel && (
                        <>
                            <h3 className="text-2xl font-bold text-[#CAEB66]">
                                Assign a {selectedParcel.leg === "delivery" ? "delivery" : selectedParcel.leg === "return" ? "return" : "pickup"} rider
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {selectedParcel.parcelName} ·{" "}
                                <span className="font-mono">{selectedParcel.tracking_no}</span>
                            </p>
                            <p className="text-sm mt-2 flex items-center gap-2">
                                <FaMapMarkerAlt className="text-[#CAEB66]" />
                                {selectedParcel.leg === "return" ? (
                                    <>
                                        Collect from <b>{selectedParcel.senderServiceCenter} warehouse</b> and return to the sender
                                    </>
                                ) : selectedParcel.leg === "delivery" ? (
                                    <>
                                        Collect from <b>{selectedParcel.receiverServiceCenter} warehouse</b>
                                    </>
                                ) : (
                                    <>
                                        Pickup from <b>{selectedParcel.senderServiceCenter}</b>
                                    </>
                                )}
                                {riderData?.pickupRegion && (
                                    <span className="text-gray-500">({riderData.pickupRegion} region)</span>
                                )}
                            </p>

                            {/* Warn when nobody is based in the target district */}
                            {!ridersLoading && riderData && !riderData.hasRiderInDistrict && riders.length > 0 && (
                                <div className="alert alert-warning mt-4 py-2 text-sm">
                                    <span>
                                        No rider is based in <b>{riderData.pickupDistrict}</b>. Choose one from a
                                        nearby district; the nearest are listed first.
                                    </span>
                                </div>
                            )}

                            <div className="mt-5 max-h-80 overflow-y-auto space-y-2">
                                {ridersLoading ? (
                                    <div className="flex justify-center py-10">
                                        <span className="loading loading-spinner"></span>
                                    </div>
                                ) : riders.length === 0 ? (
                                    <p className="text-center py-10 text-gray-500">
                                        No active riders. Approve riders on the Pending Riders page first.
                                    </p>
                                ) : (
                                    riders.map((rider) => (
                                        <label
                                            key={rider._id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                                selectedRiderId === rider._id
                                                    ? "border-[#CAEB66] bg-[#CAEB66]/10"
                                                    : "border-base-300 hover:border-gray-400"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="rider"
                                                className="radio radio-sm"
                                                checked={selectedRiderId === rider._id}
                                                onChange={() => setSelectedRiderId(rider._id)}
                                            />
                                            <div className="grow min-w-0">
                                                <p className="font-semibold">{rider.name}</p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {rider.warehouse}, {rider.region} · {rider.contact}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {rider.sameDistrict ? (
                                                    <span className="badge badge-success badge-sm text-white">Same district</span>
                                                ) : (
                                                    <span
                                                        className={`badge badge-sm ${
                                                            rider.distanceKm != null && rider.distanceKm <= 60
                                                                ? "badge-info text-white"
                                                                : "badge-ghost"
                                                        }`}
                                                    >
                                                        {rider.distanceKm != null
                                                            ? `${rider.distanceKm} km away`
                                                            : rider.sameRegion
                                                            ? "Same region"
                                                            : "Other region"}
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-500">
                                                    {rider.busyParcels} active {rider.busyParcels === 1 ? "parcel" : "parcels"}
                                                </span>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>

                            <div className="modal-action">
                                <button onClick={closeModal} className="btn btn-ghost">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={!selectedRiderId || assigning}
                                    className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                                >
                                    {assigning ? (
                                        <span className="loading loading-spinner loading-sm"></span>
                                    ) : (
                                        "Assign Rider"
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Click outside the box to close */}
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </div>
    );
};

export default AssignRider;