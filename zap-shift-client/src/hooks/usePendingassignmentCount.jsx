import { useQuery } from "@tanstack/react-query";
import useAxiosSecure from "./useAxiosSecure";
import useUserRole from "./useUserRole";

// Number of paid parcels waiting for a pickup rider (admins only).
// Checks again every 30 seconds so the sidebar badge stays up to date.
const usePendingAssignmentCount = () => {
    const axiosSecure = useAxiosSecure();
    const { isAdmin } = useUserRole();

    const { data: count = 0 } = useQuery({
        queryKey: ["pendingAssignmentCount"],
        enabled: isAdmin, // normal users never call the admin route
        refetchInterval: 30000,
        queryFn: async () => {
            const res = await axiosSecure.get("/admin/parcels/pending-assignment/count");
            return res.data.count;
        },
    });

    return count;
};

export default usePendingAssignmentCount;