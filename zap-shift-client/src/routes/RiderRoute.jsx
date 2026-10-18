import { Navigate, useLocation } from "react-router";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";

const RiderRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const { isRider, roleLoading } = useUserRole();
    const location = useLocation();

    if (loading || roleLoading) {
        return (
            <div className="flex justify-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!isRider) {
        return <Navigate to="/forbidden" replace />;
    }

    return children;
};

export default RiderRoute;