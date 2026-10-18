import { useState } from "react";
import { Link, useNavigate } from "react-router";
import Swal from "sweetalert2";
import { FaThLarge, FaSignOutAlt, FaUserEdit } from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import useUserRole from "../../../hooks/useUserRole";

// First letters of the name (or email) for when there is no photo, e.g. "Mosharof Dipo" -> "MD"
const getInitials = (name, email) => {
    const source = (name || email || "?").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
};

const roleBadge = {
    admin: "bg-purple-600",
    rider: "bg-blue-600",
    user: "bg-gray-500",
};

// Avatar: the profile photo, or the initials if there is no photo or it fails to load
const Avatar = ({ user, size = "w-10" }) => {
    const [broken, setBroken] = useState(false);
    const showPhoto = user?.photoURL && !broken;

    return (
        <div className={`avatar ${showPhoto ? "" : "avatar-placeholder placeholder"}`}>
            <div
                className={`${size} rounded-full ring-2 ring-[#CAEB66] ring-offset-2 ring-offset-base-100 ${
                    showPhoto ? "" : "bg-[#CAEB66] text-black"
                }`}
            >
                {showPhoto ? (
                    <img
                        src={user.photoURL}
                        alt={user.displayName || "Profile"}
                        referrerPolicy="no-referrer" // Google profile photos need this
                        onError={() => setBroken(true)}
                    />
                ) : (
                    <span className="font-bold">{getInitials(user?.displayName, user?.email)}</span>
                )}
            </div>
        </div>
    );
};

// Right side of the Navbar: name + photo when logged in, Login button when not
const NavbarUser = () => {
    const { user, loading, logOut } = useAuth();
    const { role } = useUserRole();
    const navigate = useNavigate();

    const handleLogout = async () => {
        const confirm = await Swal.fire({
            title: "Log out?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Log out",
            confirmButtonColor: "#ef4444",
        });
        if (!confirm.isConfirmed) return;

        try {
            await logOut();
            navigate("/");
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) {
        return <span className="loading loading-spinner loading-sm"></span>;
    }

    if (!user) {
        return (
            <Link to="/login" className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0 rounded-xl">
                Login
            </Link>
        );
    }

    const name = user.displayName || user.email?.split("@")[0];

    return (
        <div className="dropdown dropdown-end">
            {/* Visible part: name (hidden on small phones) + photo */}
            <div
                tabIndex={0}
                role="button"
                className="flex items-center gap-3 cursor-pointer rounded-full pl-3 pr-1 py-1 hover:bg-base-200 transition"
                title={user.email}
            >
                <div className="text-right leading-tight hidden sm:block">
                    <p className="font-semibold text-sm max-w-[10rem] truncate">{name}</p>
                    <p className="text-xs text-gray-500 capitalize">{role}</p>
                </div>
                <Avatar user={user} />
            </div>

            {/* Dropdown */}
            <div
                tabIndex={0}
                className="dropdown-content z-50 mt-3 w-64 rounded-box bg-base-100 shadow-lg border border-base-300 p-4"
            >
                <div className="flex items-center gap-3 pb-3 border-b border-base-300">
                    <Avatar user={user} size="w-12" />
                    <div className="min-w-0">
                        <p className="font-semibold truncate">{name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        <span className={`badge badge-xs text-white border-0 capitalize mt-1 ${roleBadge[role] || "bg-gray-500"}`}>
                            {role}
                        </span>
                    </div>
                </div>

                <ul className="menu p-0 pt-2">
                    <li>
                        <Link to="/dashboard">
                            <FaThLarge /> Dashboard
                        </Link>
                    </li>
                    <li>
                        <Link to="/dashboard/profile">
                            <FaUserEdit /> Update Profile
                        </Link>
                    </li>
                    <li>
                        <button onClick={handleLogout} className="text-error">
                            <FaSignOutAlt /> Log out
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default NavbarUser;