import { useForm } from 'react-hook-form';
import useAuth from '../../../hooks/useAuth';
import { Link, useNavigate } from 'react-router';
import SocialLogin from '../SocialLogin/SocialLogin';
import axios from 'axios';
import { useState } from 'react';
import useAxios from '../../../hooks/useAxios';

const Register = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { createUser, updateUserProfile } = useAuth();
    const axiosInstance = useAxios();
    const navigate = useNavigate();

    const [profilePic, setProfilePic] = useState('');
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [authError, setAuthError] = useState('');

    const onSubmit = async (data) => {
        if (submitting) return;
        setAuthError('');
        setSubmitting(true);

        try {
            // 1) Create the Firebase account
            const result = await createUser(data.email, data.password);
            console.log('Firebase user created:', result.user.email);

            // 2) Save name and photo on the Firebase profile
            await updateUserProfile({
                displayName: data.name,
                photoURL: profilePic,
            });

            // 3) Save the user in MongoDB (the server always sets role "user")
            try {
                const userRes = await axiosInstance.post('/users', {
                    email: data.email,
                    name: data.name,
                    photoURL: profilePic,
                });
                console.log('Saved to database:', userRes.data);
            } catch (dbError) {
                // The account exists in Firebase, so don't block the user.
                // Logging in later saves them to the database (see Login.jsx).
                console.error('Saving user to database failed:', dbError);
            }

            navigate('/');
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                setAuthError('This email is already registered. Please log in.');
            } else {
                setAuthError(error.message);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleImageUpload = async (event) => {
        const image = event.target.files[0];
        if (!image) return;

        const formData = new FormData();
        formData.append('image', image);

        try {
            setUploading(true);
            const res = await axios.post(
                `https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMAGE_UPLOAD_KEY}`,
                formData
            );
            setProfilePic(res.data.data.url);
        } catch (err) {
            console.error('Image upload failed', err);
            setAuthError('Image upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <div className="text-center lg:text-left">
                <h1 className="text-5xl font-bold">Create An Account</h1>
                <p className="py-6">Please enter your details to create an account</p>
            </div>
            <div className="card bg-base-100 w-full max-w-sm shrink-0 rounded-xl">
                <div className="card-body">
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <fieldset className="fieldset">

                            <label className="label">Your Photo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="input w-full max-w-xs"
                            />
                            {uploading && <p className="text-sm">Uploading photo...</p>}

                            <label className="label">Name</label>
                            <input
                                {...register('name', { required: true })}
                                type="text"
                                className="input"
                                placeholder="Name"
                            />
                            {errors.name?.type === 'required' && <p className="text-error">Name is required</p>}

                            <label className="label">Email</label>
                            <input
                                {...register('email', { required: true })}
                                type="email"
                                className="input"
                                placeholder="Email"
                            />
                            {errors.email?.type === 'required' && <p className="text-error">Email is required</p>}

                            <label className="label">Password</label>
                            <input
                                {...register('password', { required: true, minLength: 6 })}
                                type="password"
                                className="input"
                                placeholder="Password"
                            />
                            {errors.password?.type === 'required' && <p className="text-error">Password is required</p>}
                            {errors.password?.type === 'minLength' && <p className="text-error">Password must be at least 6 characters</p>}

                            <div><Link to="/login" className="link link-hover">Have an account? Login</Link></div>

                            {authError && <p className="text-error">{authError}</p>}

                            <button
                                state={{ from: location }} replace
                                type="submit"
                                disabled={uploading || submitting}
                                className="btn text-black rounded-xl bg-[#CAEB66] mt-4"
                            >
                                {submitting ? 'Registering...' : 'Register'}
                            </button>
                        </fieldset>
                    </form>
                    <SocialLogin></SocialLogin>
                </div>
            </div>
        </div>
    );
};

export default Register;