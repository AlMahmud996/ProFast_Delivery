import { Navigate, useLocation } from "react-router";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";

// Wrap admin-only pages with this.
// Not logged in -> login page. Logged in but not admin -> dashboard home.
const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const { isAdmin, roleLoading } = useUserRole();
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

    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default AdminRoute;