import { useQuery } from "@tanstack/react-query";
import useAuth from "./useAuth";
import useAxiosSecure from "./useAxiosSecure";

// Returns the logged-in user's role: "admin", "rider" or "user"
const useUserRole = () => {
    const { user, loading: authLoading } = useAuth();
    const axiosSecure = useAxiosSecure();

    const { data: role = "user", isLoading: roleLoading, refetch } = useQuery({
        queryKey: ["userRole", user?.email],
        enabled: !authLoading && !!user?.email, // wait until Firebase knows the user
        staleTime: 5 * 60 * 1000, // don't ask the server again on every page change
        queryFn: async () => {
            const res = await axiosSecure.get("/users/role");
            return res.data.role;
        },
    });

    return {
        role,
        isAdmin: role === "admin",
        isRider: role === "rider",
        roleLoading: authLoading || (!!user?.email && roleLoading),
        refetchRole: refetch,
    };
};

export default useUserRole;