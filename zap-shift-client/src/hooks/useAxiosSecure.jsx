import axios from "axios";
import { getAuth } from "firebase/auth";

const axiosSecure = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

// Interceptor is added ONCE (outside the hook), not on every render.
// It runs before every request and attaches the Firebase ID token.
axiosSecure.interceptors.request.use(
    async (config) => {
        // Ask Firebase who is logged in right now
        const user = getAuth().currentUser;

        if (user) {
            // getIdToken() refreshes the token automatically when it expires
            const token = await user.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

const useAxiosSecure = () => {
    return axiosSecure;
};

export default useAxiosSecure;