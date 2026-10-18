import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
} from "firebase/auth";
import { AuthContext } from "./AuthContext";
import { auth } from "../../firebase/firebase.init";
import { useEffect, useState } from "react";

const googleProvider = new GoogleAuthProvider();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // Bumped after a profile update so the Navbar re-renders with the new name/photo
    const [, setProfileVersion] = useState(0);

    // Runs a Firebase auth action and turns "loading" off again if it fails.
    // (On success, onAuthStateChanged below turns it off. On failure it never
    // runs, so without this, "loading" would stay true forever.)
    const withLoading = async (action) => {
        setLoading(true);
        try {
            return await action();
        } catch (error) {
            setLoading(false);
            throw error; // let the page show its own error message
        }
    };

    const createUser = (email, password) =>
        withLoading(() => createUserWithEmailAndPassword(auth, email, password));

    const signIn = (email, password) =>
        withLoading(() => signInWithEmailAndPassword(auth, email, password));

    const signInWithGoogle = () =>
        withLoading(() => signInWithPopup(auth, googleProvider));

    // Firebase doesn't announce profile changes, so after saving the name/photo
    // we refresh the user and re-render everyone using useAuth (e.g. the Navbar).
    const updateUserProfile = async (profile) => {
        await updateProfile(auth.currentUser, profile);
        await auth.currentUser.reload();
        setUser(auth.currentUser);
        setProfileVersion((v) => v + 1);
    };

    const logOut = () => withLoading(() => signOut(auth));

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const authInfo = {
        user,
        loading,
        createUser,
        signIn,
        signInWithGoogle,
        logOut,
        updateUserProfile,
    };

    return <AuthContext value={authInfo}>{children}</AuthContext>;
};

export default AuthProvider;