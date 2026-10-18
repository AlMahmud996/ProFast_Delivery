import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { FaTruck, FaWarehouse, FaCheckCircle, FaArrowRight, FaUndo } from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// e.g. "15 Oct 2026, 1:55 PM"
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

// Admin page for the truck leg of inter-region parcels:
// origin warehouse -> (Dispatch) -> on truck -> (Mark Arrived) -> destination warehouse
const HubTransfers = () => {
    const axiosSecure = useAxiosSecure();
    const queryClient = useQueryClient();
    const [updatingId, setUpdatingId] = useState(null);

    const {
        data: parcels = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["hubParcels"],
        retry: 1,
        refetchInterval: 30000,
        queryFn: async () => {
            const res = await axiosSecure.get("/admin/parcels/hub");
            return res.data;
        },
    });

    // Forward parcels and returns use the same two steps: wait for a truck, then on the truck
    const atWarehouse = parcels.filter((p) => ["at_origin_hub", "return_at_hub"].includes(p.deliveryStatus));
    const onTruck = parcels.filter((p) => ["dispatched_to_hub", "return_in_transit"].includes(p.deliveryStatus));

    // Refresh this page and the related sidebar badges
    const refreshAll = () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ["hubCount"] });
        queryClient.invalidateQueries({ queryKey: ["pendingAssignmentCount"] });
        queryClient.invalidateQueries({ queryKey: ["pendingAssignment"] });
    };

    const handleDispatch = async (parcel) => {
        const { isConfirmed, value } = await Swal.fire({
            title: parcel.isReturn ? "Send the return back by truck?" : "Dispatch by truck?",
            html: `<b>${parcel.parcelName}</b> · ${parcel.tracking_no}<br/>${parcel.fromWarehouse} warehouse → ${parcel.toWarehouse} warehouse${parcel.isReturn ? "<br/><small>(returning to the sender)</small>" : ""}`,
            input: "text",
            inputLabel: "Truck / vehicle number (optional)",
            inputPlaceholder: "e.g. DHAKA METRO-TA 11-2233",
            showCancelButton: true,
            confirmButtonText: "Dispatch",
            confirmButtonColor: "#84cc16",
        });

        if (!isConfirmed) return;

        try {
            setUpdatingId(parcel._id);
            const res = await axiosSecure.patch(`/admin/parcels/${parcel._id}/dispatch`, {
                vehicleNo: value,
            });
            if (res.data.modifiedCount > 0) {
                Swal.fire({ title: "Dispatched", icon: "success", timer: 1400, showConfirmButton: false });
                refreshAll();
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ title: "Could not dispatch", text: err?.response?.data?.message || "Something went wrong.", icon: "error" });
            refetch();
        } finally {
            setUpdatingId(null);
        }
    };

    const handleArrive = async (parcel) => {
        const confirm = await Swal.fire({
            title: "Mark as arrived?",
            html: `<b>${parcel.parcelName}</b> reached the <b>${parcel.toWarehouse}</b> warehouse.<br/><span style="font-size:14px">A rider based in ${parcel.toWarehouse} will be assigned automatically${parcel.isReturn ? " to bring it back to the sender" : ""}. If there is none, you'll choose one from a nearby district.</span>`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, arrived",
            confirmButtonColor: "#16a34a",
        });

        if (!confirm.isConfirmed) return;

        try {
            setUpdatingId(parcel._id);
            const res = await axiosSecure.patch(`/admin/parcels/${parcel._id}/arrive`);
            if (res.data.modifiedCount > 0) {
                Swal.fire({
                    title: "Arrived",
                    html: res.data.rider_name
                        ? `Delivery rider <b>${res.data.rider_name}</b> was assigned automatically.`
                        : `No rider is based in <b>${res.data.district || parcel.toWarehouse}</b>.<br/>Go to <b>Assign Rider</b> and choose one from a nearby district.`,
                    icon: res.data.rider_name ? "success" : "info",
                });
                refreshAll();
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ title: "Could not update", text: err?.response?.data?.message || "Something went wrong.", icon: "error" });
            refetch();
        } finally {
            setUpdatingId(null);
        }
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

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-[#CAEB66] mb-2">Warehouse Transfers</h2>
                <p className="text-gray-500">
                    Inter-region parcels move between warehouses by truck. Dispatch them, then mark them as
                    arrived. Returned parcels (failed delivery) go the same way, back to the sender's warehouse.
                </p>
            </div>

            <Section
                icon={<FaWarehouse />}
                title="Waiting for a truck"
                empty="No parcels waiting for a truck."
                parcels={atWarehouse}
                timeLabel="Reached warehouse"
                timeField="at_origin_hub_at"
                renderAction={(p) => (
                    <button
                        onClick={() => handleDispatch(p)}
                        disabled={updatingId === p._id}
                        className="btn btn-sm bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                    >
                        <FaTruck /> Dispatch
                    </button>
                )}
            />

            <Section
                icon={<FaTruck />}
                title="On the truck"
                empty="No parcels on the road."
                parcels={onTruck}
                timeLabel="Dispatched"
                timeField="dispatched_to_hub_at"
                showVehicle
                renderAction={(p) => (
                    <button
                        onClick={() => handleArrive(p)}
                        disabled={updatingId === p._id}
                        className="btn btn-sm bg-green-600 hover:bg-green-700 text-white border-0"
                    >
                        <FaCheckCircle /> Mark Arrived
                    </button>
                )}
            />
        </div>
    );
};

// One table of parcels
const Section = ({ icon, title, empty, parcels, timeLabel, timeField, showVehicle, renderAction }) => (
    <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <span className="text-[#CAEB66]">{icon}</span> {title}
            <span className="badge">{parcels.length}</span>
        </h3>

        {parcels.length === 0 ? (
            <div className="text-center py-10 bg-base-100 rounded-xl text-gray-500">{empty}</div>
        ) : (
            <div className="overflow-x-auto bg-base-100 rounded-xl shadow-md">
                <table className="table table-zebra">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Parcel</th>
                            <th>Warehouse route</th>
                            <th className="hidden md:table-cell">Brought by</th>
                            {showVehicle && <th className="hidden sm:table-cell">Vehicle</th>}
                            <th className="hidden lg:table-cell">{timeLabel}</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parcels.map((p, i) => (
                            <tr key={p._id}>
                                <td>{i + 1}</td>
                                <td>
                                    <p className="font-semibold flex items-center gap-2">
                                        {p.parcelName}
                                        {p.isReturn && (
                                            <span className="badge badge-xs badge-error gap-1">
                                                <FaUndo className="text-[9px]" /> Return
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-500 font-mono">{p.tracking_no}</p>
                                </td>
                                <td className="text-sm">
                                    <span className="inline-flex items-center gap-1.5">
                                        {p.fromWarehouse}
                                        <FaArrowRight className="text-xs text-gray-400" />
                                        {p.toWarehouse}
                                    </span>
                                    <p className="text-xs text-gray-500">
                                        {p.isReturn ? `${p.receiverRegion} → ${p.senderRegion}` : `${p.senderRegion} → ${p.receiverRegion}`}
                                    </p>
                                </td>
                                <td className="hidden md:table-cell text-sm">
                                    {p.isReturn ? p.delivery_rider?.name || "—" : p.pickup_rider?.name || "—"}
                                </td>
                                {showVehicle && (
                                    <td className="hidden sm:table-cell text-sm font-mono">
                                        {(p.isReturn ? p.returnVehicleNo : p.vehicleNo) || "—"}
                                    </td>
                                )}
                                <td className="hidden lg:table-cell text-sm whitespace-nowrap">
                                    {formatDate(p[p.isReturn ? timeField.replace(/^at_origin_hub_at$/, "return_at_hub_at").replace(/^dispatched_to_hub_at$/, "return_in_transit_at") : timeField])}
                                </td>
                                <td>{renderAction(p)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

export default HubTransfers;