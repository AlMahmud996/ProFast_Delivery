import { useQuery } from "@tanstack/react-query";
import { Link, NavLink } from "react-router";
import Swal from "sweetalert2";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// Formats the ISO date, e.g. "06 Oct 2026, 1:11 PM"
const formatDate = (iso) =>
    new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

const MyParcels = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();

    const {
        data: parcels = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["myParcels", user?.email],
        enabled: !!user?.email,
        retry: 1, // don't retry 3 times on an auth error
        queryFn: async () => {
            const res = await axiosSecure.get("/parcels", {
                params: { email: user?.email },
            });
            return res.data;
        },
    });

    // Delete with a SweetAlert confirmation
    const handleDelete = async (parcel) => {
        const result = await Swal.fire({
            title: "Delete this parcel?",
            text: `${parcel.parcelName} (${parcel.trackingId}) will be removed. This cannot be undone.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, delete",
            confirmButtonColor: "#ef4444",
        });

        if (!result.isConfirmed) return;

        try {
            const res = await axiosSecure.delete(`/parcels/${parcel._id}`);
            if (res.data.deletedCount > 0) {
                Swal.fire({
                    title: "Deleted",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                });
                refetch(); // reload the table
            } else {
                Swal.fire({
                    title: "Not deleted",
                    text: "This parcel could not be deleted.",
                    icon: "info",
                });
            }
        } catch (error) {
            console.error(error);
            Swal.fire({
                title: "Error",
                text: "Could not delete the parcel.",
                icon: "error",
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    // Show the error instead of spinning forever
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
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-6">
                My Parcels ({parcels.length})
            </h2>

            {parcels.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-lg">You have not booked any parcel yet.</p>
                    <NavLink
                        to="/sendParcel"
                        className="btn mt-4 bg-[#CAEB66] text-black"
                    >
                        Send a Parcel
                    </NavLink>
                </div>
            ) : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-md">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th className="hidden sm:table-cell">Type</th>
                                <th>Title</th>
                                <th>Created At</th>
                                <th>Cost</th>
                                <th>Tracking ID</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {parcels.map((parcel, index) => {
                                const isPaid = parcel.paymentStatus === "paid";

                                return (
                                    <tr key={parcel._id}>
                                        <td>{index + 1}</td>

                                        {/* Document or non-document */}
                                        <td className="capitalize hidden sm:table-cell">
                                            {parcel.parcelType === "document"
                                                ? "Document"
                                                : "Non-Document"}
                                        </td>

                                        <td>
                                            <p className="font-semibold">{parcel.parcelName}</p>
                                            <p className="text-xs text-gray-500">
                                                {parcel.senderServiceCenter} → {parcel.receiverServiceCenter}
                                            </p>
                                        </td>

                                        <td className="whitespace-nowrap">
                                            {formatDate(parcel.creationDate)}
                                        </td>

                                        <td className="font-semibold">৳{parcel.cost}</td>

                                        {/* 6 digit tracking number once paid, booking ID before that */}
                                        <td className="font-mono text-sm">
                                            {parcel.tracking_no || parcel.trackingId}
                                        </td>

                                        <td>
                                            <span
                                                className={`badge text-white border-0 ${
                                                    isPaid ? "bg-green-600" : "bg-red-600"
                                                }`}
                                            >
                                                {isPaid ? "Paid" : "Unpaid"}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="flex gap-2">
                                                <Link
                                                    to={`/dashboard/parcel/${parcel._id}`}
                                                    className="btn btn-sm btn-outline"
                                                >
                                                    View
                                                </Link>

                                                {!isPaid && (
                                                    <>
                                                        <Link
                                                            to={`/dashboard/pay/${parcel._id}`}
                                                            className="btn btn-sm bg-[#CAEB66] text-black"
                                                        >
                                                            Pay
                                                        </Link>

                                                        <button
                                                            onClick={() => handleDelete(parcel)}
                                                            className="btn btn-sm btn-error text-white"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MyParcels;