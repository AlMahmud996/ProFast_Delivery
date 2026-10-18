import { FaTruck, FaInfoCircle } from "react-icons/fa";

const money = (n) => `৳${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Shows the server's price for the parcel on the Send Parcel form.
// Pass the values from usePriceQuote().
const PriceBreakdown = ({ quote, loading, error }) => {
    if (error) {
        return <div className="alert alert-error text-sm py-2">{error}</div>;
    }

    if (!quote && !loading) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 flex items-center gap-2">
                <FaInfoCircle /> Choose the parcel type and both service centers to see the price.
            </div>
        );
    }

    if (!quote) {
        return (
            <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-500">
                <span className="loading loading-spinner loading-sm"></span> Calculating price...
            </div>
        );
    }

    return (
        <div className={`rounded-xl border border-gray-200 bg-white text-black p-4 ${loading ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Price</h4>
                <span className="badge badge-sm bg-gray-100 border-0 text-gray-700">
                    {quote.routeType === "inter_region" ? "Inter-division" : "Same division"}
                </span>
            </div>

            <ul className="space-y-1.5 text-sm">
                {quote.breakdown.map((item) => (
                    <li key={item.label} className="flex justify-between gap-4">
                        <span className={`flex items-center gap-1.5 ${item.label.startsWith("Line-haul") ? "text-gray-600" : ""}`}>
                            {item.label.startsWith("Line-haul") && <FaTruck className="text-xs" />}
                            {item.label}
                        </span>
                        <span className="whitespace-nowrap">{money(item.amount)}</span>
                    </li>
                ))}
            </ul>

            <div className="flex justify-between items-baseline border-t border-gray-200 mt-3 pt-3">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-extrabold text-[#03373D]">{money(quote.total)}</span>
            </div>

            {quote.lineHaulFee > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                    Parcels between divisions travel by truck between our warehouses, so they include a{" "}
                    {money(quote.lineHaulFee)} line-haul fee.
                </p>
            )}
        </div>
    );
};

export default PriceBreakdown;