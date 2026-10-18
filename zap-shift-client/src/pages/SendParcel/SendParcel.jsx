import { useMemo } from "react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2"; // SweetAlert2 for the booking confirmation modal
import warehouses from "../../assets/data/warehouses.json"; // adjust path to where you saved the dataset
import useAxiosSecure from "../../hooks/useAxiosSecure"; // Custom hook to get the secure axios instance
import useAuth from "../../hooks/useAuth"; // gives us the logged-in user (adjust path if needed)
import { useNavigate } from "react-router";

const escapeHtml = (value = "") =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const getCostBreakdown = ({
    parcelType,
    weight,
    senderServiceCenter,
    receiverServiceCenter,
}) => {
    const isSameDistrict = senderServiceCenter === receiverServiceCenter;
    const isDocument = parcelType === "document";
    const w = isDocument ? 0 : parseFloat(weight) || 0;

    const baseCharge = isDocument
        ? isSameDistrict
            ? 60
            : 80
        : isSameDistrict
            ? 110
            : 150;

    const extraKg = !isDocument && w > 3 ? w - 3 : 0;
    const extraWeightCharge = Math.round(extraKg * 40);
    const outsideDistrictCharge = !isDocument && extraKg > 0 && !isSameDistrict ? 40 : 0;
    
    return {
        isSameDistrict,
        isDocument,
        baseCharge,
        extraKg: Number(extraKg.toFixed(1)),
        extraWeightCharge,
        outsideDistrictCharge,
        total: baseCharge + extraWeightCharge + outsideDistrictCharge,
    };
};

const SendParcel = () => {
    const navigate = useNavigate();
    const {
        register,
        handleSubmit,
        watch,
        reset,
        setValue,
        setFocus,
        formState: { errors },
    } = useForm({
        defaultValues: {
            parcelType: "document",
        },
        shouldFocusError: true,
    });

    const { user } = useAuth(); // logged-in user, needed for created_by
    const axiosSecure = useAxiosSecure(); // Custom hook to get the secure axios instance

    const parcelType = watch("parcelType");
    const weight = watch("weight");
    const senderRegion = watch("senderRegion");
    const receiverRegion = watch("receiverRegion");
    const senderServiceCenter = watch("senderServiceCenter");
    const receiverServiceCenter = watch("receiverServiceCenter");

    const regions = useMemo(
        () => [...new Set(warehouses.map((w) => w.region))],
        []
    );

    const getDistricts = (region) =>
        warehouses.filter((w) => w.region === region && w.status === "active");

    const getCoveredAreas = (district) =>
        warehouses.find((w) => w.district === district)?.covered_area || []; // shows covered areas under the service center select

    const liveCost =
        senderServiceCenter && receiverServiceCenter
            ? getCostBreakdown({
                parcelType,
                weight,
                senderServiceCenter,
                receiverServiceCenter,
            })
            : null;

    const buildBreakdownHtml = (data, cost) => {
        const row = (label, value, bold = false) => `
            <tr style="${bold ? "font-weight:700;border-top:2px solid #ddd;" : ""}">
                <td style="padding:6px 0;text-align:left;">${label}</td>
                <td style="padding:6px 0;text-align:right;">${value}</td>
            </tr>`;

        return `
            <div style="text-align:left;font-size:14px;">

                <p style="margin-bottom:4px;"><b>Parcel:</b> ${escapeHtml(data.parcelName)}
                (${data.parcelType === "document" ? "Document" : `Non-document, ${parseFloat(data.weight)} kg`})</p>

                <p style="margin-bottom:4px;"><b>From:</b> ${escapeHtml(data.senderName)} &mdash;
                ${escapeHtml(data.senderServiceCenter)}, ${escapeHtml(data.senderRegion)}</p>

                <p style="margin-bottom:12px;"><b>To:</b> ${escapeHtml(data.receiverName)} &mdash;
                ${escapeHtml(data.receiverServiceCenter)}, ${escapeHtml(data.receiverRegion)}</p>

                <table style="width:100%;border-collapse:collapse;">
                    ${row(
            `Base charge (${cost.isDocument ? "document" : "up to 3 kg"}, ${cost.isSameDistrict ? "within district" : "outside district"
            })`,
            `৳${cost.baseCharge}`
        )}
                    ${cost.extraWeightCharge > 0
                ? row(
                    `Extra weight (${cost.extraKg} kg × ৳40)`,
                    `৳${cost.extraWeightCharge}`
                )
                : ""
            }
                    ${cost.outsideDistrictCharge > 0
                ? row("Outside district extra charge", `৳${cost.outsideDistrictCharge}`)
                : ""
            }
                    ${row("Total", `৳${cost.total}`, true)}
                </table>

                <p style="margin-top:12px;font-size:12px;color:#777;">
                    Want to change something? Click "Edit Parcel" to go back to the form, your data will stay as it is.
                </p>
            </div>`;
    };

    const onSubmit = async (data) => {
        const cost = getCostBreakdown(data);
        
        const result = await Swal.fire({
            title: "Confirm your booking",
            html: buildBreakdownHtml(data, cost),
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "Confirm Booking",
            cancelButtonText: "Edit Parcel", // cancel just closes the modal, so the user can modify the form
            confirmButtonColor: "#CAEB66",
            cancelButtonColor: "#6b7280",
            reverseButtons: true, // Edit on the left, Confirm on the right
            allowOutsideClick: false, // avoids closing the modal by accident
            customClass: {
                confirmButton: "swal-confirm-dark-text", // keeps the confirm button text readable on the light green
            },
            
            didOpen: () => {
                const btn = Swal.getConfirmButton();
                if (btn) btn.style.color = "#000"; // black text on #CAEB66 button
            },
            
        });

        // User chose to edit: keep all the form values and jump back to the form
        if (!result.isConfirmed) {
            window.scrollTo({ top: 0, behavior: "smooth" }); // bring the user back to the top of the form
            setFocus("parcelName"); // focus the first editable field
            return;
        }

        const parcelData = {
            ...data,
            created_by: user?.email?.toLowerCase(),
            weight: cost.isDocument ? 0 : parseFloat(data.weight),
            deliveryType: cost.isSameDistrict ? "within-district" : "outside-district",
            costBreakdown: cost,
            cost: cost.total,
            paymentStatus: "unpaid",
            deliveryStatus: "not_collected",
            creationDate: new Date().toISOString(),
            trackingId: `PCL-${Date.now()}`,
        };

        // FIX: one request, one alert. Success only shows when the save really worked
        try {
            const res = await axiosSecure.post("/parcels", parcelData);

            if (res.data.insertedId) {
                await Swal.fire({
                    title: "Parcel booked!",
                    text: "Your parcel has been saved. Please complete the payment to continue.",
                    icon: "success",
                    timer: 2500,
                    showConfirmButton: false,
                });
                reset({ parcelType: "document" });
                navigate('/dashboard/myParcels');
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                title: "Error",
                text: "There was an error saving your parcel. Please try again.",
                icon: "error",
            });
        }
    };

    return (
        <div className="min-h-screen bg-base-200 p-6 md:p-10">

            {/* Page Title */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-[#CAEB66]">
                    Add Parcel
                </h1>
                {/* Subtitle, as the requirement document asks for a heading and a subtitle */}
                <p className="text-white mt-2">
                    Door to door delivery, tell us where to pick up and where to deliver
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>

                <div className="card bg-base-100 shadow-md">
                    <div className="card-body">

                        {/* ================= PARCEL DETAILS ================= */}
                        <h2 className="text-xl font-bold text-[#CAEB66] mb-4">
                            Enter your parcel details
                        </h2>

                        {/* Parcel Type */}
                        <div className="flex gap-8 mb-5">

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="document"
                                    className="radio radio-success"
                                    {...register("parcelType", {
                                        required: "Parcel type is required",
                                    })}
                                />
                                <span>Document</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="non-document"
                                    className="radio radio-success"
                                    {...register("parcelType", {
                                        required: "Parcel type is required",
                                    })}
                                />
                                <span>Non-Document</span>
                            </label>

                        </div>

                        {/* Parcel Name + Weight */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

                            {/* Parcel Name */}
                            <div>
                                <label className="label">
                                    <span className="label-text font-medium">
                                        Parcel Name
                                    </span>
                                </label>

                                <input
                                    type="text"
                                    placeholder="Parcel Name"
                                    className="input input-bordered w-full"
                                    {...register("parcelName", {
                                        required: "Parcel name is required",
                                    })}
                                />

                                {errors.parcelName && (
                                    <p className="text-error text-sm mt-1">
                                        {errors.parcelName.message}
                                    </p>
                                )}
                            </div>

                            {/* Weight */}
                            <div>
                                <label className="label">
                                    <span className="label-text font-medium">
                                        Parcel Weight (KG)
                                    </span>
                                </label>

                                <input
                                    type="number"
                                    step="0.1"
                                    disabled={parcelType === "document"} // weight is only needed for non-document
                                    placeholder="Parcel Weight (KG)"
                                    className="input input-bordered w-full disabled:opacity-50"
                                    {...register("weight", {
                                        required:
                                            parcelType === "non-document"
                                                ? "Weight is required for non-document"
                                                : false,
                                        min: {
                                            value: 0.1,
                                            message: "Weight must be greater than 0",
                                        },
                                    })}
                                />

                                {errors.weight && (
                                    <p className="text-error text-sm mt-1">
                                        {errors.weight.message}
                                    </p>
                                )}
                            </div>

                        </div>


                        {/* ================= SENDER + RECEIVER ================= */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* ================= SENDER ================= */}
                            <div>

                                <h3 className="font-bold text-[#CAEB66] mb-4">
                                    Sender Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    {/* Sender Name */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Sender Name
                                            </span>
                                        </label>

                                        <input
                                            type="text"
                                            placeholder="Sender Name"
                                            className="input input-bordered w-full"
                                            {...register("senderName", {
                                                required: "Sender name is required",
                                            })}
                                        />

                                        {errors.senderName && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.senderName.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Sender Contact */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Sender Contact No
                                            </span>
                                        </label>

                                        <input
                                            type="tel"
                                            placeholder="Sender Contact No"
                                            className="input input-bordered w-full"
                                            {...register("senderContact", {
                                                required: "Sender contact is required",
                                                pattern: {
                                                    value: /^01[3-9]\d{8}$/, // Bangladeshi mobile number validation
                                                    message: "Enter a valid BD number (01XXXXXXXXX)",
                                                },
                                            })}
                                        />

                                        {errors.senderContact && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.senderContact.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Sender Region */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Your Region
                                            </span>
                                        </label>

                                        <select
                                            className="select select-bordered w-full"
                                            {...register("senderRegion", {
                                                required: "Sender region is required",
                                                // Reset the service center whenever the region changes
                                                onChange: () =>
                                                    setValue("senderServiceCenter", ""),
                                            })}
                                        >
                                            <option value="">
                                                Select your region
                                            </option>
                                            {regions.map((region) => (
                                                <option key={region} value={region}>
                                                    {region}
                                                </option>
                                            ))}
                                        </select>

                                        {errors.senderRegion && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.senderRegion.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Pickup Service Center (district) */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Sender Pickup Service Center
                                            </span>
                                        </label>

                                        <select
                                            disabled={!senderRegion} // locked until a region is selected
                                            className="select select-bordered w-full disabled:opacity-50"
                                            {...register("senderServiceCenter", {
                                                required:
                                                    "Pickup service center is required",
                                            })}
                                        >
                                            <option value="">
                                                Select Service Center
                                            </option>
                                            {getDistricts(senderRegion).map((item) => (
                                                <option
                                                    key={item.district}
                                                    value={item.district}
                                                >
                                                    {item.district}
                                                </option>
                                            ))}
                                        </select>

                                        {/* Covered areas hint */}
                                        {senderServiceCenter && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Covers:{" "}
                                                {getCoveredAreas(senderServiceCenter).join(", ")}
                                            </p>
                                        )}

                                        {errors.senderServiceCenter && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.senderServiceCenter.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Address */}
                                    <div className="md:col-span-2">
                                        <label className="label">
                                            <span className="label-text">
                                                Address
                                            </span>
                                        </label>

                                        <input
                                            type="text"
                                            placeholder="Address"
                                            className="input input-bordered w-full"
                                            {...register("senderAddress", {
                                                required: "Sender address is required",
                                            })}
                                        />

                                        {errors.senderAddress && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.senderAddress.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Pickup Instruction */}
                                    <div className="md:col-span-2">
                                        <label className="label">
                                            <span className="label-text">
                                                Pickup Instruction
                                            </span>
                                        </label>

                                        <textarea
                                            placeholder="Pickup Instruction"
                                            className="textarea textarea-bordered w-full h-28"
                                            {...register("pickupInstruction")}
                                        ></textarea>

                                        {errors.pickupInstruction && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.pickupInstruction.message}
                                            </p>
                                        )}
                                    </div>

                                </div>
                            </div>


                            {/* ================= RECEIVER ================= */}
                            <div>

                                <h3 className="font-bold text-[#CAEB66] mb-4">
                                    Receiver Details
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    {/* Receiver Name */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Receiver Name
                                            </span>
                                        </label>

                                        <input
                                            type="text"
                                            placeholder="Receiver Name"
                                            className="input input-bordered w-full"
                                            {...register("receiverName", {
                                                required: "Receiver name is required",
                                            })}
                                        />

                                        {errors.receiverName && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.receiverName.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Receiver Contact */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Receiver Contact No
                                            </span>
                                        </label>

                                        <input
                                            type="tel"
                                            placeholder="Receiver Contact No"
                                            className="input input-bordered w-full"
                                            {...register("receiverContact", {
                                                required: "Receiver contact is required",
                                                pattern: {
                                                    value: /^01[3-9]\d{8}$/, // Bangladeshi mobile number validation
                                                    message: "Enter a valid BD number (01XXXXXXXXX)",
                                                },
                                            })}
                                        />

                                        {errors.receiverContact && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.receiverContact.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Receiver Region */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Receiver Region
                                            </span>
                                        </label>

                                        <select
                                            className="select select-bordered w-full"
                                            {...register("receiverRegion", {
                                                required: "Receiver region is required",
                                                // Reset the service center whenever the region changes
                                                onChange: () =>
                                                    setValue("receiverServiceCenter", ""),
                                            })}
                                        >
                                            <option value="">
                                                Select receiver region
                                            </option>
                                            {regions.map((region) => (
                                                <option key={region} value={region}>
                                                    {region}
                                                </option>
                                            ))}
                                        </select>

                                        {errors.receiverRegion && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.receiverRegion.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Delivery Service Center (district) */}
                                    <div>
                                        <label className="label">
                                            <span className="label-text">
                                                Receiver Delivery Service Center
                                            </span>
                                        </label>

                                        <select
                                            disabled={!receiverRegion} // locked until a region is selected
                                            className="select select-bordered w-full disabled:opacity-50"
                                            {...register("receiverServiceCenter", {
                                                required:
                                                    "Delivery service center is required",
                                            })}
                                        >
                                            <option value="">
                                                Select Service Center
                                            </option>
                                            {getDistricts(receiverRegion).map((item) => (
                                                <option
                                                    key={item.district}
                                                    value={item.district}
                                                >
                                                    {item.district}
                                                </option>
                                            ))}
                                        </select>

                                        {/* Covered areas hint */}
                                        {receiverServiceCenter && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Covers:{" "}
                                                {getCoveredAreas(receiverServiceCenter).join(", ")}
                                            </p>
                                        )}

                                        {errors.receiverServiceCenter && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.receiverServiceCenter.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Address */}
                                    <div className="md:col-span-2">
                                        <label className="label">
                                            <span className="label-text">
                                                Receiver Address
                                            </span>
                                        </label>

                                        <input
                                            type="text"
                                            placeholder="Address"
                                            className="input input-bordered w-full"
                                            {...register("receiverAddress", {
                                                required: "Receiver address is required",
                                            })}
                                        />

                                        {errors.receiverAddress && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.receiverAddress.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Delivery Instruction */}
                                    <div className="md:col-span-2">
                                        <label className="label">
                                            <span className="label-text">
                                                Delivery Instruction
                                            </span>
                                        </label>

                                        <textarea
                                            placeholder="Delivery Instruction"
                                            className="textarea textarea-bordered w-full h-28"
                                            {...register("deliveryInstruction")}
                                        ></textarea>

                                        {errors.deliveryInstruction && (
                                            <p className="text-error text-sm mt-1">
                                                {errors.deliveryInstruction.message}
                                            </p>
                                        )}
                                    </div>

                                </div>
                            </div>

                        </div>


                        <div className="mt-8">

                            {/* Live delivery cost preview */}
                            {liveCost && (
                                <div className="alert mb-4 border border-[#CAEB66]">
                                    <span>
                                        Estimated delivery cost:{" "}
                                        <b className="text-[#CAEB66]">৳{liveCost.total}</b>{" "}
                                        ({liveCost.isSameDistrict ? "Within district" : "Outside district"})
                                    </span>
                                </div>
                            )}

                            <p className="text-sm text-gray-500 mb-4">
                                * PickUp Time 4pm–7pm Approx.
                            </p>

                            <button
                                type="submit"
                                className="btn bg-[#CAEB66] text-black hover:bg-[#022923] hover:text-white"
                            >
                                Proceed to Confirm Booking
                            </button>

                        </div>

                    </div>
                </div>

            </form>
        </div>
    );
};

export default SendParcel;