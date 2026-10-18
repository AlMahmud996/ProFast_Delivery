import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import Swal from "sweetalert2";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";
// Service centers (region + district) from src/assets
import warehouseData from "../../../assets/warehouses.json";
// Change this path to wherever your rider illustration is saved
import riderImg from "../../../assets/agent-pending.png";

// Only active service centers can take riders
const serviceCenters = warehouseData.filter((c) => c.status === "active");

// Unique region list for the first dropdown, e.g. Barisal, Chattogram, Dhaka...
const regions = [...new Set(serviceCenters.map((c) => c.region))].sort();

const BeARider = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        watch,
        reset,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm({
        defaultValues: {
            name: user?.displayName || "",
            email: user?.email || "",
        },
    });

    // Wire-houses (districts) of the selected region for the second dropdown
    const selectedRegion = watch("region");
    const warehouses = serviceCenters
        .filter((c) => c.region === selectedRegion)
        .map((c) => c.district)
        .sort();

    const onSubmit = async (data) => {
        const riderApplication = {
            ...data,
            name: user?.displayName || data.name,
            email: user?.email?.toLowerCase(),
            age: Number(data.age),
            status: "pending",
            created_at: new Date().toISOString(),
        };

        try {
            const res = await axiosSecure.post("/riders", riderApplication);

            if (res.data.insertedId) {
                Swal.fire({
                    title: "Application submitted",
                    text: "We will review your application and contact you soon.",
                    icon: "success",
                });
                reset();
                navigate("/");
            }
        } catch (error) {
            console.error(error);
            Swal.fire({
                title: "Could not submit",
                text:
                    error?.response?.data?.message ||
                    "Something went wrong. Please try again.",
                icon: "error",
            });
        }
    };

    // White fields with dark text (overrides the dark theme colors)
    const inputClass =
        "input input-bordered w-full text-sm bg-white text-black border-gray-300 placeholder:text-gray-400";
    const selectClass =
        "select select-bordered w-full text-sm bg-white text-black border-gray-300 disabled:bg-white disabled:text-gray-400 disabled:border-gray-300";
    const labelClass = "label text-sm font-medium text-black";
    const errorClass = "text-error text-xs mt-1";

    return (
        <div className="bg-white rounded-3xl p-6 md:p-14 my-8 text-black">
            {/* Header */}
            <div className="max-w-xl">
                <h1 className="text-4xl md:text-5xl font-extrabold text-[#03373D]">
                    Be a Rider
                </h1>
                <p className="mt-4 text-gray-600">
                    Enjoy fast, reliable parcel delivery with real-time tracking and
                    zero hassle. From personal packages to business shipments — we
                    deliver on time, every time.
                </p>
            </div>

            <div className="divider my-8"></div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                {/* Form */}
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-[#03373D] mb-6">
                        Tell us about yourself
                    </h2>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Name + Age */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Your Name</label>
                                <input
                                    {...register("name", { required: true })}
                                    type="text"
                                    placeholder="Your Name"
                                    readOnly={!!user?.displayName}
                                    className={inputClass}
                                />
                                {errors.name && <p className={errorClass}>Name is required</p>}
                            </div>

                            <div>
                                <label className={labelClass}>Your age</label>
                                <input
                                    {...register("age", { required: true, min: 18, max: 65 })}
                                    type="number"
                                    placeholder="Your age"
                                    className={inputClass}
                                />
                                {errors.age?.type === "required" && (
                                    <p className={errorClass}>Age is required</p>
                                )}
                                {(errors.age?.type === "min" || errors.age?.type === "max") && (
                                    <p className={errorClass}>Age must be between 18 and 65</p>
                                )}
                            </div>
                        </div>

                        {/* Email + Region */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Your Email</label>
                                <input
                                    {...register("email", { required: true })}
                                    type="email"
                                    placeholder="Your Email"
                                    readOnly
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Your Region</label>
                                <select
                                    {...register("region", {
                                        required: true,
                                        // Clear the old wire-house when the region changes
                                        onChange: () => setValue("warehouse", ""),
                                    })}
                                    defaultValue=""
                                    className={selectClass}
                                >
                                    <option value="" disabled>
                                        Select your region
                                    </option>
                                    {regions.map((region) => (
                                        <option key={region} value={region}>
                                            {region}
                                        </option>
                                    ))}
                                </select>
                                {errors.region && <p className={errorClass}>Region is required</p>}
                            </div>
                        </div>

                        {/* NID + Contact */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>NID No</label>
                                <input
                                    {...register("nid", {
                                        required: true,
                                        pattern: /^(\d{10}|\d{13}|\d{17})$/,
                                    })}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="NID"
                                    className={inputClass}
                                />
                                {errors.nid?.type === "required" && (
                                    <p className={errorClass}>NID is required</p>
                                )}
                                {errors.nid?.type === "pattern" && (
                                    <p className={errorClass}>NID must be 10, 13 or 17 digits</p>
                                )}
                            </div>

                            <div>
                                <label className={labelClass}>Contact</label>
                                <input
                                    {...register("contact", {
                                        required: true,
                                        pattern: /^01[3-9]\d{8}$/,
                                    })}
                                    type="tel"
                                    placeholder="Contact"
                                    className={inputClass}
                                />
                                {errors.contact?.type === "required" && (
                                    <p className={errorClass}>Contact number is required</p>
                                )}
                                {errors.contact?.type === "pattern" && (
                                    <p className={errorClass}>Enter a valid number, e.g. 01712345678</p>
                                )}
                            </div>
                        </div>

                        {/* Wire-house */}
                        <div>
                            <label className={labelClass}>Which wire-house you want to work?</label>
                            <select
                                {...register("warehouse", { required: true })}
                                defaultValue=""
                                disabled={!selectedRegion}
                                className={selectClass}
                            >
                                <option value="" disabled>
                                    {selectedRegion ? "Select wire-house" : "Select a region first"}
                                </option>
                                {warehouses.map((district) => (
                                    <option key={district} value={district}>
                                        {district}
                                    </option>
                                ))}
                            </select>
                            {errors.warehouse && (
                                <p className={errorClass}>Wire-house is required</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn w-full bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0 mt-2"
                        >
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                    </form>
                </div>

                {/* Illustration */}
                <div className="flex justify-center">
                    <img
                        src={riderImg}
                        alt="Rider delivering a parcel"
                        className="w-full max-w-md"
                    />
                </div>
            </div>
        </div>
    );
};

export default BeARider;