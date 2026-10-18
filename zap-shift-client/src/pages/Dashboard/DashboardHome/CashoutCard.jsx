import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { FaMoneyBillWave, FaHistory } from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// ৳1,234.5 style money (kept private to this file)
const money = (n) =>
    `৳${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// e.g. "15 Oct 2026, 3:36 PM" (kept private to this file)
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

const METHODS = [
    { value: "bkash", label: "bKash" },
    { value: "nagad", label: "Nagad" },
    { value: "rocket", label: "Rocket" },
    { value: "bank", label: "Bank account" },
];

const methodLabel = (m) => METHODS.find((x) => x.value === m)?.label || m;

// Balance + Cash Out button + history. Used on both the admin and the rider home page.
// queryKey: the overview query to refresh after a cashout
const CashoutCard = ({ title, balance = 0, minCashout = 200, cashouts = [], queryKey, note }) => {
    const axiosSecure = useAxiosSecure();
    const queryClient = useQueryClient();
    const modalRef = useRef(null);

    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState("bkash");
    const [accountNumber, setAccountNumber] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const canCashOut = balance >= minCashout;
    const shortBy = Math.max(0, minCashout - balance);

    const openModal = () => {
        setAmount(String(Math.floor(balance)));
        setError("");
        modalRef.current?.showModal();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const value = Number(amount);
        if (!value || value < minCashout) return setError(`Minimum cashout is ${money(minCashout)}.`);
        if (value > balance) return setError(`You can cash out at most ${money(balance)}.`);
        if (!/^[0-9]{6,20}$/.test(accountNumber.replace(/\s+/g, "")))
            return setError("Enter a valid account number (digits only).");

        try {
            setSubmitting(true);
            const res = await axiosSecure.post("/cashouts", { amount: value, method, accountNumber });
            modalRef.current?.close();
            setAccountNumber("");
            Swal.fire({
                title: "Cashout successful",
                html: `${money(res.data.amount)} sent to your ${methodLabel(method)}.<br/>Remaining balance: <b>${money(res.data.balanceAfter)}</b>`,
                icon: "success",
            });
            queryClient.invalidateQueries({ queryKey });
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Cashout failed. Please try again.");
            queryClient.invalidateQueries({ queryKey }); // balance may have changed
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-base-100 rounded-xl shadow-sm p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
                    <p className="text-4xl font-extrabold text-[#CAEB66] mt-1">{money(balance)}</p>
                    {note && <p className="text-xs text-gray-500 mt-1 max-w-md">{note}</p>}
                </div>

                <div className="sm:text-right">
                    <button
                        onClick={openModal}
                        disabled={!canCashOut}
                        className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                    >
                        <FaMoneyBillWave /> Cash Out
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                        {canCashOut
                            ? `Minimum ${money(minCashout)}`
                            : `${money(shortBy)} more needed (minimum ${money(minCashout)})`}
                    </p>
                </div>
            </div>

            {/* History */}
            <div className="mt-6">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <FaHistory className="text-gray-400" /> Cashout history
                </h4>
                {cashouts.length === 0 ? (
                    <p className="text-sm text-gray-500">No cashouts yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Method</th>
                                    <th className="hidden sm:table-cell">Account</th>
                                    <th className="hidden md:table-cell">By</th>
                                    <th className="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cashouts.map((c) => (
                                    <tr key={c._id}>
                                        <td className="whitespace-nowrap">{formatDate(c.created_at)}</td>
                                        <td>{methodLabel(c.method)}</td>
                                        <td className="hidden sm:table-cell font-mono">{c.accountNumber}</td>
                                        <td className="hidden md:table-cell text-xs">{c.ownerName || c.ownerEmail}</td>
                                        <td className="text-right font-semibold">{money(c.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Cashout form */}
            <dialog ref={modalRef} className="modal">
                <div className="modal-box max-w-md">
                    <h3 className="text-2xl font-bold text-[#CAEB66]">Cash Out</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Available: <b>{money(balance)}</b> · Minimum {money(minCashout)}
                    </p>

                    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                        <div>
                            <label className="label text-sm">Amount (৳)</label>
                            <input
                                type="number"
                                min={minCashout}
                                max={balance}
                                step="1"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="input input-bordered w-full"
                            />
                            <div className="flex gap-2 mt-2">
                                {[minCashout, Math.floor(balance / 2), Math.floor(balance)]
                                    .filter((v, i, arr) => v >= minCashout && v <= balance && arr.indexOf(v) === i)
                                    .map((v) => (
                                        <button
                                            type="button"
                                            key={v}
                                            onClick={() => setAmount(String(v))}
                                            className="btn btn-xs btn-outline"
                                        >
                                            {v === Math.floor(balance) ? "All" : money(v)}
                                        </button>
                                    ))}
                            </div>
                        </div>

                        <div>
                            <label className="label text-sm">Send to</label>
                            <select
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="select select-bordered w-full"
                            >
                                {METHODS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label text-sm">
                                {method === "bank" ? "Bank account number" : `${methodLabel(method)} number`}
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                placeholder={method === "bank" ? "Account number" : "01XXXXXXXXX"}
                                className="input input-bordered w-full"
                            />
                        </div>

                        {error && <p className="text-error text-sm">{error}</p>}

                        <div className="modal-action">
                            <button type="button" onClick={() => modalRef.current?.close()} className="btn btn-ghost">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                            >
                                {submitting ? <span className="loading loading-spinner loading-sm"></span> : "Confirm Cashout"}
                            </button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </div>
    );
};

export default CashoutCard;