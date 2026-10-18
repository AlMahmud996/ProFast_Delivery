import { useState } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import Swal from "sweetalert2";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

const PaymentForm = () => {
    const { parcelId } = useParams();
    const stripe = useStripe();
    const elements = useElements();
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();
    const navigate = useNavigate();

    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");

    // Load the parcel so we can show its name and cost
    const { data: parcel, isLoading } = useQuery({
        queryKey: ["parcel", parcelId],
        queryFn: async () => {
            const res = await axiosSecure.get(`/parcels/${parcelId}`);
            return res.data;
        },
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!stripe || !elements) return;

        const card = elements.getElement(CardElement);
        if (!card) return;

        setProcessing(true);

        try {
            // 1) ask the server for a client secret (amount is decided on the server)
            const { data } = await axiosSecure.post("/create-payment-intent", {
                parcelId,
            });

            // 2) confirm the card with Stripe
            const result = await stripe.confirmCardPayment(data.clientSecret, {
                payment_method: {
                    card,
                    billing_details: {
                        name: user?.displayName || parcel.senderName,
                        email: user?.email,
                    },
                },
            });

            if (result.error) {
                setError(result.error.message);
                return;
            }

            if (result.paymentIntent.status === "succeeded") {
                // 3) tell the server to save the payment and create the tracking number
                const saved = await axiosSecure.post("/payments", {
                    parcelId,
                    transactionId: result.paymentIntent.id,
                });

                if (saved.data.success) {
                    await Swal.fire({
                        title: "Payment successful!",
                        html: `
                            <p style="margin-bottom:6px;">Tracking No: <b>${saved.data.tracking_no}</b></p>
                            <p style="font-size:13px;">Transaction ID: ${saved.data.transactionId}</p>
                        `,
                        icon: "success",
                        confirmButtonText: "Go to My Parcels",
                        confirmButtonColor: "#2E6F40",
                    });
                    navigate("/dashboard/myParcels"); // adjust to your My Parcels route
                }
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Payment failed. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    // Show "not found" instead of crashing
    if (!parcel || parcel.message) {
        return <p className="text-center py-20">Parcel not found.</p>;
    }

    if (parcel.paymentStatus === "paid") {
        return (
            <div className="alert alert-success">
                This parcel is already paid. Tracking No: {parcel.tracking_no}
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden w-full" // wide card, border and bigger shadow
        >
            <div className="h-1.5 bg-[#CAEB66]"></div> {/* brand colored accent bar on top of the card */}

            {/* Two columns on large screens, stacked on small screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2">

                {/* ============ LEFT: parcel summary ============ */}
                <div className="p-6 md:p-10 flex flex-col justify-between gap-8 bg-base-200/40 lg:border-r border-base-300"> {/* soft panel to separate summary from the payment side */}

                    <div>
                        <p className="text-sm text-gray-500">Parcel</p>

                        {/* XL title: parcel name */}
                        <h3 className="text-xl md:text-2xl font-bold mt-1 text-[#CAEB66]">
                            {parcel.parcelName}
                        </h3>

                        {/* Route in white */}
                        <p className="text-white mt-2 text-base">
                            {parcel.senderServiceCenter} → {parcel.receiverServiceCenter}
                        </p>
                    </div>

                    {/* Total charge (unchanged section) */}
                    <div>
                        <p className="text-sm text-gray-500">Total charge to pay</p>
                        <p className="text-3xl font-bold text-[#CAEB66]">৳{parcel.cost}</p>
                    </div>
                </div>

                {/* ============ RIGHT: card payment ============ */}
                <div className="p-6 md:p-10 flex flex-col gap-4">

                    <div>
                        <h4 className="text-lg font-semibold">Card details</h4>
                        <p className="text-sm text-gray-500">Enter your card information to pay securely.</p> {/* short helper text under the heading */}
                    </div>

                    {/* White box so the card field is readable on any theme */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-inner"> {/* inner shadow gives the field a slightly inset look */}
                        <CardElement
                            options={{
                                style: {
                                    base: { fontSize: "16px", color: "#111827" },
                                    invalid: { color: "#dc2626" },
                                },
                                hidePostalCode: true,
                            }}
                        />
                    </div>

                    {error && <p className="text-error text-sm">{error}</p>}

                    <button
                        type="submit"
                        disabled={!stripe || processing}
                        className="btn w-full bg-[#CAEB66] text-black hover:bg-[#b9da55] border-0 text-base" // full width pay button
                    >
                        {processing ? (
                            <span className="loading loading-spinner"></span>
                        ) : (
                            `Pay ৳${parcel.cost}`
                        )}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                        🔒 Payments are processed securely by Stripe {/* trust note near the pay button */}
                    </p>

                    {/* Test card hint, delete this block before going live */}
                    <div className="text-xs text-gray-500 border border-dashed border-base-300 rounded-lg p-3">
                        Test card: <span className="font-mono">4242 4242 4242 4242</span>, any future date, any CVC
                    </div>
                </div>
            </div>
        </form>
    );
};

export default PaymentForm;