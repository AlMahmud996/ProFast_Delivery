import { NavLink, Outlet } from "react-router"
import ProFastLogo from "../pages/shared/ProFastLogo/ProFastLogo"

import {
    FaHome,
    FaBoxOpen,
    FaMoneyCheckAlt,
    FaUserEdit,
    FaMotorcycle,
    FaUserClock,
    FaClipboardList,
    FaCheckCircle,
    FaWarehouse,
    FaSearchLocation,
} from "react-icons/fa";
import useUserRole from "../hooks/useUserRole";
import useHubCount from "../hooks/useHubCount";

// inside your dashboard layout component, at the top level:

const DashboardLayout = () => {
    const hubCount = useHubCount()
    const { isAdmin, isRider, roleLoading } = useUserRole();
    return (
        <div>
            <div className="drawer lg:drawer-open">
                <input id="my-drawer-3" type="checkbox" className="drawer-toggle" />
                <div className="drawer-content flex flex-col">
                    <div className="navbar bg-base-300 w-full lg:hidden">
                        <div className="flex-none ">
                            <label htmlFor="my-drawer-3" aria-label="open sidebar" className="btn btn-square btn-ghost drawer-button">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    className="inline-block h-6 w-6 stroke-current"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 6h16M4 12h16M4 18h16"
                                    ></path>
                                </svg>
                            </label>
                        </div>
                        <div className="mx-2 flex-1 px-2 lg:hidden">
                            Dashboard
                        </div>
                        <div className="hidden flex-none lg:hidden">
                        </div>
                    </div>
                    <Outlet></Outlet>
                </div>
                <div className="drawer-side">
                    <label htmlFor="my-drawer-3" aria-label="close sidebar" className="drawer-overlay"></label>
                    <ul className="menu bg-base-200 min-h-full w-80 p-4">
                        {/* Sidebar content here */}
                        <ProFastLogo></ProFastLogo>

                        {!roleLoading && (isAdmin || isRider) && (
                            <li>
                                <NavLink to="/dashboard" end>
                                    <FaHome /> Home
                                </NavLink>
                            </li>
                        )}

                        <li>
                            <NavLink to="/dashboard/myParcels">
                                <FaBoxOpen /> My Parcels
                            </NavLink>
                        </li>

                        <li>
                            <NavLink to="/dashboard/payment-history">
                                <FaMoneyCheckAlt /> Payment History
                            </NavLink>
                        </li>

                        {!isAdmin && (
                            <li>
                                <NavLink to="/dashboard/track">
                                    <FaSearchLocation /> Track a Parcel
                                </NavLink>
                            </li>
                        )}
                        {!roleLoading && isRider && (
                            <>
                                <li>
                                    <NavLink to="/dashboard/pending-deliveries">
                                        <FaClipboardList /> Pending Deliveries
                                    </NavLink>
                                </li>

                                <li>
                                    <NavLink to="/dashboard/completed-deliveries">
                                        <FaCheckCircle /> Completed Deliveries
                                    </NavLink>
                                </li>
                            </>
                        )}

                        {/* Admin only links */}
                        {!roleLoading && isAdmin && (
                            <>


                                <li>
                                    <NavLink to="/dashboard/parcel-tracker">
                                        <FaSearchLocation /> Parcel Tracker
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink to="/dashboard/active-riders">
                                        <FaMotorcycle /> Active Riders
                                    </NavLink>
                                </li>

                                <li>
                                    <NavLink to="/dashboard/pending-riders">
                                        <FaUserClock /> Pending Riders
                                    </NavLink>
                                </li>

                                <li>
                                    <NavLink to="/dashboard/hub-transfers">
                                        <FaWarehouse /> Warehouse Transfers
                                        {hubCount > 0 && (
                                            <span className="badge badge-sm bg-red-500 text-white border-0 ml-auto">{hubCount}</span>
                                        )}
                                    </NavLink>
                                </li>

                                <li>
                                    <NavLink to="/dashboard/assign-rider">
                                        <FaMotorcycle /> Assign a Rider
                                    </NavLink>
                                </li>
                            </>
                        )}

                        <li>
                            <NavLink to="/dashboard/profile">
                                <FaUserEdit /> Update Profile
                            </NavLink>
                        </li>



                    </ul>
                </div>
            </div>
        </div>
    )
}

export default DashboardLayout