import useUserRole from "../../../hooks/useUserRole";
import AdminHome from "./AdminHome";
import RiderHome from "./RiderHome";
import UserHome from "./UserHome";

// /dashboard -> a Home page for each role
const DashboardHome = () => {
    const { role, roleLoading } = useUserRole();

    if (roleLoading) {
        return (
            <div className="flex justify-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (role === "admin") return <AdminHome />;
    if (role === "rider") return <RiderHome />;
    return <UserHome />;
};

export default DashboardHome;