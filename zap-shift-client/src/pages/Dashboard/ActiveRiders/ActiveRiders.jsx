import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { FaEye, FaUserSlash, FaSearch } from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// e.g. "13 Oct 2026, 12:20 PM"
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

const ActiveRiders = () => {
    const axiosSecure = useAxiosSecure();
    const modalRef = useRef(null);
    const [selectedRider, setSelectedRider] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);
    const [search, setSearch] = useState("");

    const {
        data: riders = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["activeRiders"],
        retry: 1,
        queryFn: async () => {
            const res = await axiosSecure.get("/riders/active");
            return res.data;
        },
    });

    // Search by name, email, region or wire-house
    const term = search.trim().toLowerCase();
    const filteredRiders = term
        ? riders.filter((r) =>
              [r.name, r.email, r.region, r.warehouse]
                  .filter(Boolean)
                  .some((field) => field.toLowerCase().includes(term))
          )
        : riders;

    // ---------- Modal ----------
    const openModal = (rider) => {
        setSelectedRider(rider);
        modalRef.current?.showModal();
    };

    const closeModal = () => {
        modalRef.current?.close();
        setSelectedRider(null);
    };

    // ---------- Deactivate ----------
    const handleDeactivate = async (rider) => {
        // Close the modal first so SweetAlert isn't hidden behind it
        const fromModal = !!selectedRider;
        modalRef.current?.close();

        const confirm = await Swal.fire({
            title: "Deactivate this rider?",
            text: `${rider.name} will no longer be able to take deliveries.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, deactivate",
            confirmButtonColor: "#ef4444",
        });

        if (!confirm.isConfirmed) {
            if (fromModal) modalRef.current?.showModal();
            return;
        }

        try {
            setUpdatingId(rider._id);
            const res = await axiosSecure.patch(`/riders/${rider._id}/status`, {
                status: "inactive",
            });

            if (res.data.modifiedCount > 0) {
                Swal.fire({
                    title: "Rider deactivated",
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
                text: err?.response?.data?.message || "Could not deactivate the rider.",
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
                    {error?.response?.data?.message || "Failed to load active riders."}
                </p>
                <button onClick={() => refetch()} className="btn mt-4">
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <h2 className="text-3xl font-bold text-[#CAEB66]">
                    Active Riders ({riders.length})
                </h2>

                {riders.length > 0 && (
                    <label className="input input-bordered flex items-center gap-2 w-full md:w-72">
                        <FaSearch className="opacity-60" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, region, wire-house"
                            className="grow"
                        />
                    </label>
                )}
            </div>

            {riders.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-lg">No active riders yet.</p>
                </div>
            ) : filteredRiders.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-lg">No riders match "{search}".</p>
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
                                <th className="hidden lg:table-cell">Approved</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredRiders.map((rider, index) => (
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
                                        {formatDate(rider.reviewed_at)}
                                    </td>

                                    <td>
                                        <span className="badge bg-green-600 text-white border-0">
                                            Active
                                        </span>
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
                                                onClick={() => handleDeactivate(rider)}
                                                disabled={updatingId === rider._id}
                                                className="btn btn-sm btn-error text-white"
                                                title="Deactivate"
                                            >
                                                <FaUserSlash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
                                Approved {formatDate(selectedRider.reviewed_at)}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <Info label="Email" value={selectedRider.email} />
                                <Info label="Age" value={selectedRider.age} />
                                <Info label="Contact" value={selectedRider.contact} mono />
                                <Info label="NID No" value={selectedRider.nid} mono />
                                <Info label="Region" value={selectedRider.region} />
                                <Info label="Wire-house" value={selectedRider.warehouse} />
                                <Info label="Applied" value={formatDate(selectedRider.created_at)} />
                                <Info label="Approved by" value={selectedRider.reviewed_by} />
                                <Info
                                    label="Status"
                                    value={
                                        <span className="badge bg-green-600 text-white border-0">
                                            Active
                                        </span>
                                    }
                                />
                            </div>

                            <div className="modal-action">
                                <button onClick={closeModal} className="btn btn-ghost">
                                    Close
                                </button>
                                <button
                                    onClick={() => handleDeactivate(selectedRider)}
                                    className="btn btn-error text-white"
                                >
                                    <FaUserSlash /> Deactivate
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

export default ActiveRiders;