import { useQuery } from "@tanstack/react-query";
import Swal from "sweetalert2";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// Date distance, e.g. "13 days ago"
const timeAgo = (iso) => {
    const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    const units = [
        ["year", 60 * 60 * 24 * 365],
        ["month", 60 * 60 * 24 * 30],
        ["day", 60 * 60 * 24],
        ["hour", 60 * 60],
        ["minute", 60],
    ];

    for (const [unit, secondsInUnit] of units) {
        if (Math.abs(seconds) >= secondsInUnit) {
            return rtf.format(Math.round(seconds / secondsInUnit), unit);
        }
    }
    return "just now";
};

// Full date, e.g. "06 Oct 2026, 1:11 PM"
const formatDate = (iso) =>
    new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

const PaymentHistory = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();

    const {
        data: payments = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["payments", user?.email],
        enabled: !!user?.email, // wait until the user is loaded
        retry: 1, // don't retry 3 times on an auth error
        queryFn: async () => {
            const res = await axiosSecure.get("/payments", {
                params: { email: user?.email },
            });
            return res.data;
        },
    });

    // Total amount paid, shown above the table
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Copy the transaction id to the clipboard
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
        } catch (error) {
            console.error(error);
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
                    {error?.response?.data?.message || "Failed to load payments."}
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
                Payment History
            </h2>
            <p className="text-gray-500 mb-6">
                {payments.length} {payments.length === 1 ? "payment" : "payments"} · Total paid{" "}
                <span className="text-[#CAEB66] font-semibold">৳{totalPaid}</span>
            </p>

            {payments.length === 0 ? (
                <div className="text-center py-16 bg-base-100 rounded-xl">
                    <p className="text-lg">You have not made any payment yet.</p>
                </div>
            ) : (
                <div className="overflow-x-auto bg-base-100 rounded-xl shadow-md">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Parcel</th>
                                <th>Tracking No</th>
                                <th>Transaction ID</th>
                                <th>Amount</th>
                                <th>Paid</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {payments.map((payment, index) => (
                                <tr key={payment._id}>
                                    <td>{index + 1}</td>

                                    <td className="font-semibold">{payment.parcelName}</td>

                                    <td className="font-mono">{payment.tracking_no}</td>

                                    {/* Transaction id with a copy button */}
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs break-all">
                                                {payment.transactionId}
                                            </span>
                                            <button
                                                onClick={() => copyText(payment.transactionId)}
                                                className="btn btn-xs btn-ghost"
                                                title="Copy transaction ID"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </td>

                                    <td className="font-semibold">৳{payment.amount}</td>

                                    {/* Date distance on top, exact date below */}
                                    <td className="whitespace-nowrap" title={formatDate(payment.paid_at)}>
                                        <p className="font-medium">{timeAgo(payment.paid_at)}</p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(payment.paid_at)}
                                        </p>
                                    </td>

                                    <td>
                                        <span className="badge text-white border-0 bg-green-600">
                                            Paid
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PaymentHistory;