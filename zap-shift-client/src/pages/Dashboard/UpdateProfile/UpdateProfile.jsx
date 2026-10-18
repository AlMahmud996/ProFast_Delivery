import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { FaLock, FaUser, FaPhoneAlt, FaEnvelope, FaSave } from "react-icons/fa";
import useAuth from "../../../hooks/useAuth";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

const roleBadge = {
    admin: "bg-purple-600",
    rider: "bg-blue-600",
    user: "bg-gray-500",
};

const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Works for users, riders and admins. Only the name and phone number can be changed.
const UpdateProfile = () => {
    const { user } = useAuth();
    const axiosSecure = useAxiosSecure();

    const { data: profile, isLoading, isError, error: loadError, refetch } = useQuery({
        queryKey: ["myProfile"],
        retry: 1,
        queryFn: async () => (await axiosSecure.get("/users/me")).data,
    });

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-16">
                <p className="text-error text-lg">{loadError?.response?.data?.message || "Failed to load your profile."}</p>
                <button onClick={() => refetch()} className="btn mt-4">Try again</button>
            </div>
        );
    }

    const photo = user?.photoURL || profile.photoURL;
    const role = profile.role || "user";

    return (
        <div className="p-4 md:p-8 max-w-3xl">
            <h2 className="text-3xl font-bold text-[#CAEB66] mb-2">Update Profile</h2>
            <p className="text-gray-500 mb-6">You can change your name and phone number. Your email is your login and can't be changed.</p>

            <div className="bg-base-100 rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-5 md:p-6 flex items-center gap-4 border-b border-base-300">
                    <div className="avatar">
                        <div className="w-16 rounded-full ring-2 ring-[#CAEB66] ring-offset-2 ring-offset-base-100">
                            {photo ? (
                                <img src={photo} alt={profile.name || "Profile"} referrerPolicy="no-referrer" />
                            ) : (
                                <div className="bg-[#CAEB66] text-black w-full h-full flex items-center justify-center text-xl font-bold">
                                    {(profile.name || profile.email).slice(0, 1).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xl font-bold truncate">{profile.name || user?.displayName || "No name yet"}</p>
                        <p className="text-sm text-gray-500 truncate">{profile.email}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`badge badge-sm text-white border-0 capitalize ${roleBadge[role] || "bg-gray-500"}`}>
                                {role}
                            </span>
                            <span className="text-xs text-gray-500">Member since {formatDate(profile.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {/* The form only mounts after the profile has loaded, so it starts with the right values (no useEffect needed) */}
                <ProfileForm key={`${profile.name}|${profile.phone}`} profile={profile} role={role} />
            </div>
        </div>
    );
};

// The editable part: name + phone (email is shown but locked)
const ProfileForm = ({ profile, role }) => {
    const { user, updateUserProfile } = useAuth();
    const axiosSecure = useAxiosSecure();
    const queryClient = useQueryClient();

    // Start values come straight from the loaded profile
    const [name, setName] = useState(profile.name || user?.displayName || "");
    const [phone, setPhone] = useState(profile.phone || "");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const changed = name.trim() !== (profile.name || "") || phone.trim() !== (profile.phone || "");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const cleanName = name.trim().replace(/\s+/g, " ");
        const cleanPhone = phone.replace(/[\s-]/g, "");

        if (cleanName.length < 2) return setError("Name must be at least 2 characters.");
        if (cleanPhone && !/^01[3-9]\d{8}$/.test(cleanPhone))
            return setError("Enter a valid mobile number, e.g. 01712345678.");

        try {
            setSaving(true);
            const res = await axiosSecure.patch("/users/me", { name: cleanName, phone: cleanPhone });

            // Keep the Firebase name in sync, so the Navbar shows the new name right away
            if (user?.displayName !== res.data.name) {
                await updateUserProfile({ displayName: res.data.name });
            }

            queryClient.invalidateQueries({ queryKey: ["myProfile"] });
            queryClient.invalidateQueries({ queryKey: ["riderOverview"] });
            setSaving(false);
            Swal.fire({ title: "Profile updated", icon: "success", timer: 1400, showConfirmButton: false });
        } catch (err) {
            console.error(err);
            setSaving(false);
            setError(err?.response?.data?.message || "Could not update your profile.");
        }
    };

    return (
                <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5">
                    <div>
                        <label className="label text-sm font-medium flex items-center gap-2">
                            <FaEnvelope className="text-gray-400" /> Email
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                value={profile.email}
                                readOnly
                                disabled
                                className="input input-bordered w-full pr-10 cursor-not-allowed"
                            />
                            <FaLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" title="Can't be changed" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Your email is used to log in, so it can't be changed.</p>
                    </div>

                    <div>
                        <label className="label text-sm font-medium flex items-center gap-2">
                            <FaUser className="text-gray-400" /> Full name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={50}
                            placeholder="Your name"
                            className="input input-bordered w-full"
                        />
                    </div>

                    <div>
                        <label className="label text-sm font-medium flex items-center gap-2">
                            <FaPhoneAlt className="text-gray-400" /> Phone number
                        </label>
                        <input
                            type="tel"
                            inputMode="numeric"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="01XXXXXXXXX"
                            className="input input-bordered w-full"
                        />
                        {role === "rider" && (
                            <p className="text-xs text-gray-500 mt-1">
                                As a rider, this number is shown to senders and admins for your jobs.
                            </p>
                        )}
                    </div>

                    {error && <p className="text-error text-sm">{error}</p>}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving || !changed}
                            className="btn bg-[#CAEB66] hover:bg-[#b8d955] text-black border-0"
                        >
                            {saving ? <span className="loading loading-spinner loading-sm"></span> : <><FaSave /> Save changes</>}
                        </button>
                    </div>
                </form>
    );
};

export default UpdateProfile;