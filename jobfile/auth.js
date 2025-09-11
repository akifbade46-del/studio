import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { showLogin, showApp, showNotification, showLoader, hideLoader, showPublicJobView, closeModal } from './ui.js';
import { setCurrentUser, setJobFilesCache, setClientsCache } from './state.js';
import { loadJobFiles, loadClients } from './firestore.js';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAAulR2nJQm-4QtNyEqKTnnDPw-iKW92Mc",
    authDomain: "my-job-file-system.firebaseapp.com",
    projectId: "my-job-file-system",
    storageBucket: "my-job-file-system.appspot.com",
    messagingSenderId: "145307873304",
    appId: "1:145307873304:web:d661ea6ec118801b4a136d",
    measurementId: "G-8EHX5K7YHL"
};

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

export async function initializeAppLogic() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const jobIdFromUrl = urlParams.get('jobId');

        if (jobIdFromUrl) {
            showLoader();
            await showPublicJobView(jobIdFromUrl);
            hideLoader();
        } else {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const userDocRef = doc(db, 'users', user.uid);
                    let userDoc = await getDoc(userDocRef);
                    
                    if (!userDoc.exists()) {
                        const usersCollectionRef = collection(db, 'users');
                        const userQuerySnapshot = await getDocs(usersCollectionRef);
                        const isFirstUser = userQuerySnapshot.size === 0;

                        const newUser = {
                            email: user.email,
                            displayName: user.displayName || user.email.split('@')[0],
                            role: isFirstUser ? 'admin' : 'user',
                            status: isFirstUser ? 'active' : 'inactive',
                            createdAt: serverTimestamp()
                        };
                        await setDoc(userDocRef, newUser);
                        userDoc = await getDoc(userDocRef);
                    }
                    
                    const currentUserData = { uid: user.uid, email: user.email, ...userDoc.data() };
                    
                    if (currentUserData.status === 'inactive') {
                        showLogin();
                        document.getElementById('approval-message').style.display = 'block';
                        document.getElementById('blocked-message').style.display = 'none';
                        signOut(auth);
                        return;
                    }

                    if (currentUserData.status === 'blocked') {
                        showLogin();
                        document.getElementById('approval-message').style.display = 'none';
                        document.getElementById('blocked-message').style.display = 'block';
                        signOut(auth);
                        return;
                    }
                    
                    console.log("User logged in:", currentUserData);
                    setCurrentUser(currentUserData);
                    showApp();
                    loadJobFiles();
                    loadClients();
                } else {
                    setCurrentUser(null);
                    console.log("User logged out");
                    showLogin();
                }
            });
        }
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Could not connect to the database.", true);
    }
}

// --- Authentication Logic ---
export async function handleSignUp(email, password, displayName) {
    showLoader();
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showNotification("Account created! Please wait for admin approval.", false);
        await signOut(auth);
        toggleAuthView(true);
    } catch (error) {
        console.error("Sign up error:", error);
        showNotification(error.message, true);
    }
    hideLoader();
}

export async function handleLogin(email, password) {
    showLoader();
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login error:", error);
        let message = "Login failed. Please check your email and password.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Incorrect email or password. Please try again or reset your password.";
        }
        showNotification(message, true);
    }
    hideLoader();
}

export async function handleForgotPassword() {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) {
        showNotification("Please enter your email address.", true);
        return;
    }
    showLoader();
    try {
        await sendPasswordResetEmail(auth, email);
        hideLoader();
        closeModal('forgot-password-modal');
        showNotification("Password reset link sent! Check your email inbox.", false);
    } catch (error) {
        hideLoader();
        console.error("Password reset error:", error);
        let message = "Could not send reset link. Please try again.";
        if(error.code === 'auth/user-not-found'){
            message = "No account found with this email address.";
        }
        showNotification(message, true);
    }
}

export function handleLogout() {
    signOut(auth);
}

export function toggleAuthView(showLogin) {
    const nameField = document.getElementById('signup-name-field');
    const emailField = document.getElementById('email-address');
    
    document.getElementById('auth-title').textContent = showLogin ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('auth-btn').textContent = showLogin ? 'Sign in' : 'Sign up';
    document.getElementById('auth-link').textContent = showLogin ? 'Create a new account' : 'Already have an account? Sign in';
    nameField.style.display = showLogin ? 'none' : 'block';
    emailField.classList.toggle('rounded-t-md', !showLogin);
    document.getElementById('approval-message').style.display = 'none';
}

    