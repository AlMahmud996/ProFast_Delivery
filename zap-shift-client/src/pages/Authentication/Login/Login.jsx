import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import SocialLogin from "../SocialLogin/SocialLogin";
import useAuth from "../../../hooks/useAuth";
import useAxios from "../../../hooks/useAxios";

const Login = () => {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm();

    const location = useLocation();
    const from = location.state?.from?.pathname || "/";
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const axiosInstance = useAxios();

    const [loginError, setLoginError] = useState("");

    const onSubmit = async (data) => {
        setLoginError("");

        try {
            const result = await signIn(data.email, data.password);
            const user = result.user;

            // Make sure the user is in the database: updates last login,
            // or creates the record if signup failed to save it earlier.
            try {
                await axiosInstance.post("/users", {
                    email: user.email,
                    name: user.displayName || "",
                    photoURL: user.photoURL || "",
                });
            } catch (dbError) {
                console.error("Saving user to database failed:", dbError);
            }

            navigate(from, { replace: true }); // go back to the page the user came from
        } catch (err) {
            console.error("Login failed:", err);

            if (err.code === "auth/invalid-credential") {
                setLoginError(
                    "Wrong email or password. If you signed up with Google, use the Google button below."
                );
            } else if (err.code === "auth/too-many-requests") {
                setLoginError("Too many failed attempts. Please wait a moment and try again.");
            } else {
                setLoginError(err.message);
            }
        }
    };

    return (
        <div>
            <div className="text-center lg:text-left">
                <h1 className="text-5xl font-bold">Login</h1>
                <p className="py-6">Welcome back! Please enter your details</p>
            </div>
            <div className="card bg-base-100 w-full max-w-sm shrink-0 rounded-xl">
                <div className="card-body">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <fieldset className="fieldset">
                            <label className="label">Email</label>
                            <input
                                {...register("email", { required: true })}
                                type="email"
                                className="input"
                                placeholder="Email"
                            />
                            {errors.email?.type === "required" && (
                                <p className="text-error">Email is required</p>
                            )}

                            <label className="label">Password</label>
                            <input
                                {...register("password", { required: true, minLength: 6 })}
                                type="password"
                                className="input"
                                placeholder="Password"
                            />
                            {errors.password?.type === "required" && (
                                <p className="text-error">Password is required</p>
                            )}
                            {errors.password?.type === "minLength" && (
                                <p className="text-error">Password must be at least 6 characters</p>
                            )}

                            <div>
                                <Link to="/register" className="link link-hover">
                                    New to this website? Sign Up Now
                                </Link>
                            </div>

                            {/* Firebase login error, shown to the user */}
                            {loginError && <p className="text-error">{loginError}</p>}

                            {/* type="submit" sends the form; the form's onSubmit does the login */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn text-black rounded-xl bg-[#CAEB66] mt-4"
                            >
                                {isSubmitting ? "Logging in..." : "Login"}
                            </button>
                        </fieldset>
                    </form>
                    <SocialLogin></SocialLogin>
                </div>
            </div>
        </div>
    );
};

export default Login;