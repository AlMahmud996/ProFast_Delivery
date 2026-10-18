import { Link, useNavigate } from "react-router";
import { FaLock, FaHome, FaArrowLeft } from "react-icons/fa";

// Shown when a logged-in user opens a page their role can't access
const Forbidden = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
            <div className="text-center max-w-md">
                <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                    <FaLock className="text-4xl text-red-500" />
                </div>

                <p className="text-7xl font-extrabold text-[#CAEB66]">403</p>

                <h1 className="text-3xl font-bold mt-2">Access Forbidden</h1>

                <p className="text-gray-500 mt-4">
                    You don't have permission to view this page. It is only available to
                    administrators. If you think this is a mistake, contact an admin.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-outline"
                    >
                        <FaArrowLeft /> Go Back
                    </button>

                    <Link
                        to="/"
                        className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                    >
                        <FaHome /> Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Forbidden;