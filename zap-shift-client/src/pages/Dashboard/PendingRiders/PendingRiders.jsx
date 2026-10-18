import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { FaEye, FaCheck, FaTimes } from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// e.g. "13 Oct 2026, 12:20 PM"
const formatDate = (iso) =>
    new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

const PendingRiders = () => {
    const axiosSecure = useAxiosSecure();
    const modalRef = useRef(null);
    const [selectedRider, setSelectedRider] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    const {
        data: riders = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["pendingRiders"],
        retry: 1,
        queryFn: async () => {
            const res = await axiosSecure.get("/riders/pending");
            return res.data;
        },
    });

    // ---------- Modal ----------
    const openModal = (rider) => {
        setSelectedRider(rider);
        modalRef.current?.showModal();
    };

    const closeModal = () => {
        modalRef.current?.close();
        setSelectedRider(null);
    };

    // ---------- Approve / Reject ----------
    const handleDecision = async (rider, status, email) => {
        const isApprove = status === "active";

        // Close the modal first so SweetAlert isn't hidden behind it
        modalRef.current?.close();

        const confirm = await Swal.fire({
            title: isApprove ? "Approve this rider?" : "Reject this application?",
            text: `${rider.name} (${rider.email})`,
            icon: isApprove ? "question" : "warning",
            showCancelButton: true,
            confirmButtonText: isApprove ? "Yes, approve" : "Yes, reject",
            confirmButtonColor: isApprove ? "#16a34a" : "#ef4444",
        });

        if (!confirm.isConfirmed) {
            // Re-open the modal if the decision was made from inside it
            if (selectedRider) modalRef.current?.showModal();
            return;
        }

        try {
            setUpdatingId(rider._id);
            const res = await axiosSecure.patch(`/riders/${rider._id}/status`, {
                status, email
            });

            if (res.data.modifiedCount > 0) {
                Swal.fire({
                    title: isApprove ? "Rider approved" : "Application rejected",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                });
                setSelectedRider(null);
                refetch();
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                title: "Error",
                text: err?.response?.data?.message || "Could not update the application.",
                icon: "error",
            });
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
                    {error?.response?.data?.message || "Failed to load pending riders."}
                </p>
                <button onClick={() => refetch()} className="btn mt-4">
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-6">
                Pending Riders ({riders.length})
            </h2>

            {riders.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-lg">No pending rider applications.</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-md">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Rider</th>
                                <th className="hidden md:table-cell">Region</th>
                                <th>Wire-house</th>
                                <th className="hidden sm:table-cell">Contact</th>
                                <th className="hidden lg:table-cell">Applied</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {riders.map((rider, index) => {
                                const busy = updatingId === rider._id;

                                return (
                                    <tr key={rider._id}>
                                        <td>{index + 1}</td>

                                        <td>
                                            <p className="font-semibold">{rider.name}</p>
                                            <p className="text-xs text-gray-500">{rider.email}</p>
                                        </td>

                                        <td className="hidden md:table-cell">{rider.region}</td>

                                        <td>{rider.warehouse}</td>

                                        <td className="hidden sm:table-cell font-mono text-sm">
                                            {rider.contact}
                                        </td>

                                        <td className="hidden lg:table-cell whitespace-nowrap text-sm">
                                            {formatDate(rider.created_at)}
                                        </td>

                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openModal(rider)}
                                                    className="btn btn-sm btn-outline"
                                                    title="View details"
                                                >
                                                    <FaEye />
                                                </button>
                                                <button
                                                    onClick={() => handleDecision(rider, "active", rider.email)}
                                                    disabled={busy}
                                                    className="btn btn-sm bg-green-600 hover:bg-green-700 text-white border-0"
                                                    title="Approve"
                                                >
                                                    <FaCheck />
                                                </button>
                                                <button
                                                    onClick={() => handleDecision(rider, "rejected", rider.email)}
                                                    disabled={busy}
                                                    className="btn btn-sm btn-error text-white"
                                                    title="Reject"
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ---------- Details modal ---------- */}
            <dialog ref={modalRef} className="modal" onClose={() => setSelectedRider(null)}>
                <div className="modal-box max-w-lg">
                    {selectedRider && (
                        <>
                            <h3 className="text-2xl font-bold text-[#CAEB66]">
                                {selectedRider.name}
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Applied {formatDate(selectedRider.created_at)}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <Info label="Email" value={selectedRider.email} />
                                <Info label="Age" value={selectedRider.age} />
                                <Info label="Contact" value={selectedRider.contact} mono />
                                <Info label="NID No" value={selectedRider.nid} mono />
                                <Info label="Region" value={selectedRider.region} />
                                <Info label="Wire-house" value={selectedRider.warehouse} />
                                <Info
                                    label="Status"
                                    value={
                                        <span className="badge badge-warning capitalize">
                                            {selectedRider.status}
                                        </span>
                                    }
                                />
                            </div>

                            <div className="modal-action">
                                <button onClick={closeModal} className="btn btn-ghost">
                                    Close
                                </button>
                                <button
                                    onClick={() => handleDecision(selectedRider, "rejected")}
                                    className="btn btn-error text-white"
                                >
                                    <FaTimes /> Reject
                                </button>
                                <button
                                    onClick={() => handleDecision(selectedRider, "active")}
                                    className="btn bg-green-600 hover:bg-green-700 text-white border-0"
                                >
                                    <FaCheck /> Approve
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

// One label/value pair in the modal
const Info = ({ label, value, mono = false }) => (
    <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`font-medium break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
);

export default PendingRiders;