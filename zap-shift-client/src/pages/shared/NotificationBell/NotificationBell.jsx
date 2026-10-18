import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
    FaBell,
    FaBox,
    FaMotorcycle,
    FaUserPlus,
    FaExclamationTriangle,
    FaWarehouse,
    FaUndo,
    FaCheckDouble,
} from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// "5m ago", "3h ago", "2d ago"
const timeAgo = (iso) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
};

const TYPE_ICON = {
    parcel_update: { icon: <FaBox />, color: "text-[#CAEB66]" },
    new_job: { icon: <FaMotorcycle />, color: "text-blue-500" },
    needs_rider: { icon: <FaExclamationTriangle />, color: "text-amber-500" },
    rider_application: { icon: <FaUserPlus />, color: "text-purple-500" },
    waiting_truck: { icon: <FaWarehouse />, color: "text-sky-500" },
    returning: { icon: <FaUndo />, color: "text-red-500" },
};

// Bell with unread count in the Navbar. Checks for new notifications every 30 seconds.
const NotificationBell = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data } = useQuery({
        queryKey: ["notifications", user?.email],
        enabled: !!user?.email,
        refetchInterval: 30000,
        queryFn: async () => (await axiosSecure.get("/notifications", { params: { limit: 20 } })).data,
    });

    if (!user) return null;

    const items = data?.items || [];
    const unread = data?.unreadCount || 0;

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications", user.email] });

    const openNotification = async (n) => {
        // Close the dropdown
        document.activeElement?.blur();
        if (!n.read) {
            try {
                await axiosSecure.patch(`/notifications/${n._id}/read`);
                refresh();
            } catch (err) {
                console.error(err);
            }
        }
        if (n.link) navigate(n.link);
    };

    const markAllRead = async () => {
        try {
            await axiosSecure.patch("/notifications/read-all");
            refresh();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle" aria-label="Notifications">
                <div className="indicator">
                    <FaBell className="text-lg" />
                    {unread > 0 && (
                        <span className="badge badge-xs indicator-item bg-red-500 text-white border-0 min-w-4 h-4">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    )}
                </div>
            </div>

            <div
                tabIndex={0}
                className="dropdown-content z-50 mt-3 w-80 max-w-[90vw] rounded-box bg-base-100 shadow-lg border border-base-300"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
                    <p className="font-semibold">
                        Notifications {unread > 0 && <span className="text-xs text-gray-500">({unread} new)</span>}
                    </p>
                    {unread > 0 && (
                        <button onClick={markAllRead} className="btn btn-ghost btn-xs">
                            <FaCheckDouble /> Mark all read
                        </button>
                    )}
                </div>

                {items.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No notifications yet.</p>
                ) : (
                    <ul className="max-h-96 overflow-y-auto divide-y divide-base-300">
                        {items.map((n) => {
                            const t = TYPE_ICON[n.type] || TYPE_ICON.parcel_update;
                            return (
                                <li key={n._id}>
                                    <button
                                        onClick={() => openNotification(n)}
                                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-base-200 transition ${
                                            n.read ? "opacity-60" : ""
                                        }`}
                                    >
                                        <span className={`mt-1 shrink-0 ${t.color}`}>{t.icon}</span>
                                        <span className="min-w-0 grow">
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="font-medium text-sm">{n.title}</span>
                                                {!n.read && <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></span>}
                                            </span>
                                            <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</span>
                                            <span className="block text-[11px] text-gray-400 mt-1">
                                                {n.tracking_no ? `#${n.tracking_no} · ` : ""}
                                                {timeAgo(n.created_at)}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NotificationBell;