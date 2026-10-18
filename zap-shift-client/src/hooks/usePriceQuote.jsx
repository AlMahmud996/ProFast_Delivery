import { useQuery } from "@tanstack/react-query";
import useAxios from "./useAxios";

// Asks the server for the exact price of a parcel while the Send Parcel form is filled in.
// The server uses the same calculation when the parcel is booked, so what the customer
// sees here is exactly what they pay.
//
// Usage:  const { quote, quoteLoading, quoteError } = usePriceQuote({ parcelType, weight,
//                 senderServiceCenter, receiverServiceCenter });
const usePriceQuote = ({ parcelType, weight, senderServiceCenter, receiverServiceCenter }) => {
    const axiosPublic = useAxios();

    const ready = !!parcelType && !!senderServiceCenter && !!receiverServiceCenter;
    const cleanWeight = parcelType === "document" ? 0 : Number(weight) || 0;

    const { data, isFetching, error } = useQuery({
        queryKey: ["priceQuote", parcelType, cleanWeight, senderServiceCenter, receiverServiceCenter],
        enabled: ready,
        staleTime: 5 * 60 * 1000,
        retry: false,
        queryFn: async () => {
            const res = await axiosPublic.post("/parcels/quote", {
                parcelType,
                weight: cleanWeight,
                senderServiceCenter,
                receiverServiceCenter,
            });
            return res.data;
        },
    });

    return {
        quote: ready ? data : null,
        quoteLoading: ready && isFetching,
        quoteError: error?.response?.data?.message || null,
    };
};

export default usePriceQuote;