import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { showLogin, showApp, showPublicFeedbackView, showPublicPodView, showNotification, showLoader, hideLoader, openModal, closeModal } from './ui.js';
import { setGlobalCurrentUser } from './state.js';

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

// --- App Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

export async function initializeAppLogic() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const podId = urlParams.get('podId');
        const feedbackId = urlParams.get('feedbackId');

        if (feedbackId) {
            showPublicFeedbackView(feedbackId);
        } else if (podId) {
            showPublicPodView(podId);
        } else {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists() && userDoc.data().status === 'active') {
                        const currentUser = { uid: user.uid, ...userDoc.data() };
                        setGlobalCurrentUser(currentUser);
                        showApp();
                    } else {
                        if (userDoc.exists()) {
                            showNotification("Your account is inactive or pending admin approval.", true);
                        }
                        setGlobalCurrentUser(null);
                        await signOut(auth);
                        showLogin();
                    }
                } else {
                    setGlobalCurrentUser(null);
                    showLogin();
                }
                document.body.classList.remove('loading');
            });
        }
        // Add auth-related event listeners here
        document.getElementById('auth-btn').addEventListener('click', handleLogin);
        document.getElementById('driver-signup-link').addEventListener('click', (e) => { e.preventDefault(); openModal('signup-modal'); });
        document.getElementById('forgot-password-link').addEventListener('click', (e) => { e.preventDefault(); openModal('forgot-password-modal'); });
        document.getElementById('signup-form').addEventListener('submit', handleSignup);
        document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);

    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Could not connect to the database.", true);
        document.body.classList.remove('loading');
    }
}

// --- Authentication Logic ---
async function handleLogin() {
    const email = document.getElementById('email-address').value;
    const password = document.getElementById('password').value;
    if (!email || !password) {
        showNotification("Please enter both email and password.", true);
        return;
    }
    showLoader();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle showing the app
    } catch (error) {
        console.error("Login failed:", error);
        let message = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Incorrect email or password.";
        }
        showNotification(message, true);
    } finally {
        hideLoader();
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    if(!name || !email || !password) {
        showNotification("Please fill out all fields.", true);
        return;
    }
    if(password.length < 6) {
        showNotification("Password must be at least 6 characters long.", true);
        return;
    }
    showLoader();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await setDoc(doc(db, "users", user.uid), {
            displayName: name,
            email: email,
            role: 'driver',
            status: 'inactive', // inactive until admin approves
            createdAt: serverTimestamp()
        });
        
        closeModal('signup-modal');
        showNotification("Account created! Please wait for admin approval.", false);
        await signOut(auth);

    } catch (error) {
        console.error("Signup failed:", error);
        if (error.code === 'auth/email-already-in-use') {
            showNotification("This email address is already in use.", true);
        } else {
            showNotification("Could not create account. Please try again.", true);
        }
    } finally {
        hideLoader();
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    if(!email) {
        showNotification("Please enter your email address.", true);
        return;
    }
    showLoader();
    try {
        await sendPasswordResetEmail(auth, email);
        closeModal('forgot-password-modal');
        showNotification("Password reset link sent! Check your email.", false);
    } catch (error) {
        console.error("Password reset failed:", error);
        showNotification("Could not send reset link. Check the email address.", true);
    } finally {
        hideLoader();
    }
}

export function handleLogout() {
    signOut(auth).catch((error) => {
        console.error("Logout failed:", error);
        showNotification("Logout failed. Please try again.", true);
    });
}
