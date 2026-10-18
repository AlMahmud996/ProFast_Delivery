import { Link, NavLink } from "react-router"
import ProFastLogo from "../ProFastLogo/ProFastLogo"
import NavbarUser from "../Navbar/NavbarUser"
import NotificationBell from "../NotificationBell/NotificationBell"
import useAuth from "../../../hooks/useAuth"

const Navbar = () => {
    const { user } = useAuth();

    const navItems = <>
        <li><NavLink to="/">Home</NavLink></li>
        <li><NavLink to="/sendParcel">Send Parcel</NavLink></li>
        <li><NavLink to="/coverage">Coverage</NavLink></li>

        {
            user && (<li><NavLink to="/dashboard">Dashboard</NavLink></li>)
        }

        <li><NavLink to="/beARider">Be a Rider</NavLink></li>
        <li><NavLink to="/contact">Contact</NavLink></li>
    </>

    return (
        <div className="navbar bg-base-100 shadow-sm">
            <div className="navbar-start">
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
                        <svg aria-label="Menu" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /> </svg>
                    </div>
                    <ul
                        tabIndex={-1}
                        className="menu menu-sm dropdown-content bg-base-100 rounded-box z-50 mt-3 w-52 p-2 shadow">
                        {navItems}
                    </ul>
                </div>
                {/* Logo goes back to Home (was a <span>, so the "to" did nothing) */}
                <Link to="/" className="btn btn-ghost text-xl"><ProFastLogo></ProFastLogo></Link>
            </div>
            <div className="navbar-center hidden lg:flex">
                <ul className="menu menu-horizontal px-1">
                    {navItems}
                </ul>
            </div>
            <div className="navbar-end gap-1">
                {/* Bell with unread notifications (only shows when logged in) */}
                <NotificationBell />
                {/* Name + profile photo with a dropdown (Dashboard, Update Profile, Log out),
                    or a Login button when logged out */}
                <NavbarUser />
            </div>
        </div>
    )
}

export default Navbar