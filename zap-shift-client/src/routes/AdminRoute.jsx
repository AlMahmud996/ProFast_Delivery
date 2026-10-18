import { Navigate, useLocation } from "react-router";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";

// Wrap admin-only pages with this.
// Not logged in -> login page. Logged in but not admin -> Forbidden page.
const AdminRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const { isAdmin, roleLoading } = useUserRole();
    const location = useLocation();

    // Wait until we know who the user is AND their role
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
        return <Navigate to="/forbidden" replace />;
    }

    return children;
};

export default AdminRoute;