import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import useUserRole from "./useUserRole";

// Number of inter-region parcels waiting at a warehouse for a truck (admins only).
// Used for the "Warehouse Transfers" sidebar badge.
const useHubCount = () => {
    const axiosSecure = useAxiosSecure();
    const { isAdmin } = useUserRole();

    const { data: count = 0 } = useQuery({
        queryKey: ["hubCount"],
        enabled: isAdmin,
        refetchInterval: 30000,
        queryFn: async () => {
            const res = await axiosSecure.get("/admin/parcels/hub/count");
            return res.data.count;
        },
    });

    return count;
};

export default useHubCount;