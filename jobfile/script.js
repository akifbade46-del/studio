// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import App Logic Modules
import { setDb, setAuth, setCurrentUser } from './state.js';
import { initializeMainApp } from './main.js';
import { showLogin, showApp, showPublicJobView, showNotification, showLoader, hideLoader, closeModal, openModal } from './ui.js';

// --- MAIN SCRIPT ---
// This is the primary entry point for the application.

document.addEventListener('DOMContentLoaded', () => {
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
    let db, auth;
    
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setDb(db);
        setAuth(auth);

        const urlParams = new URLSearchParams(window.location.search);
        const jobIdFromUrl = urlParams.get('jobId');

        if (jobIdFromUrl) {
            showPublicJobView(jobIdFromUrl);
        } else {
            // --- Auth State Change Logic ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.status === 'active') {
                            const loggedInUser = { uid: user.uid, email: user.email, ...userData };
                            setCurrentUser(loggedInUser);
                            showApp();
                            initializeMainApp(); // Initialize the main app logic AFTER login
                        } else {
                            const message = userData.status === 'blocked' ? 'Your account has been blocked.' : 'Your account is awaiting admin approval.';
                            document.getElementById(userData.status === 'blocked' ? 'blocked-message' : 'approval-message').style.display = 'block';
                            showNotification(message, true);
                            await signOut(auth);
                            showLogin();
                        }
                    } else {
                        // First-time signup case, user document might not exist yet
                        // Or user data is missing.
                        showNotification("User data not found. Please sign up or contact admin.", true);
                        await signOut(auth);
                        showLogin();
                    }
                } else {
                    setCurrentUser(null);
                    showLogin();
                }
            });
            
            // --- Initialize Auth UI Listeners ---
            initializeAuthUI();
        }

    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Could not connect to the database.", true);
    }
});


function initializeAuthUI() {
    let isLoginView = true;
    const auth = getAuth();
    const db = getFirestore();

    const authLink = document.getElementById('auth-link');
    const authBtn = document.getElementById('auth-btn');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const sendResetLinkBtn = document.getElementById('send-reset-link-btn');

    // --- Login/Signup Form Toggle ---
    authLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginView = !isLoginView;
        toggleAuthView(isLoginView);
    });

    // --- Main Auth Button (Sign in / Sign up) ---
    authBtn.addEventListener('click', () => {
        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;
        if (isLoginView) {
            handleLogin(auth, email, password);
        } else {
            const displayName = document.getElementById('full-name').value;
            if (!email || !password || !displayName) {
                showNotification("Please fill all fields to sign up.", true);
                return;
            }
            handleSignUp(auth, db, email, password, displayName, () => {
                isLoginView = true;
                toggleAuthView(true);
            });
        }
    });

    // --- Forgot Password ---
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        openModal('forgot-password-modal');
    });
    document.getElementById('close-forgot-password-modal').addEventListener('click', () => closeModal('forgot-password-modal'));
    sendResetLinkBtn.addEventListener('click', () => handleForgotPassword(auth));
}

// --- Authentication Handler Functions ---
async function handleSignUp(auth, db, email, password, displayName, callback) {
    showLoader();
    try {
        // Check if it's the first user to make them an admin
        const usersCollectionRef = collection(db, 'users');
        const userQuerySnapshot = await getDocs(usersCollectionRef);
        const isFirstUser = userQuerySnapshot.empty;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        const newUser = {
            email: userCredential.user.email,
            displayName: displayName,
            role: isFirstUser ? 'admin' : 'user',
            status: isFirstUser ? 'active' : 'inactive',
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);

        showNotification("Account created! Please wait for admin approval.", false);
        await signOut(auth);
        callback(); // Switch view back to login
    } catch (error) {
        console.error("Sign up error:", error);
        showNotification(error.message, true);
    }
    hideLoader();
}

async function handleLogin(auth, email, password) {
    showLoader();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error("Login error:", error);
        let message = "Login failed. Please check your email and password.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Incorrect email or password. Please try again.";
        }
        showNotification(message, true);
    }
    hideLoader();
}

async function handleForgotPassword(auth) {
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

function toggleAuthView(isLogin) {
    const nameField = document.getElementById('signup-name-field');
    const emailField = document.getElementById('email-address');
    
    document.getElementById('auth-title').textContent = isLogin ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('auth-btn').textContent = isLogin ? 'Sign in' : 'Sign up';
    document.getElementById('auth-link').textContent = isLogin ? 'Create a new account' : 'Already have an account? Sign in';
    nameField.style.display = isLogin ? 'none' : 'block';
    emailField.classList.toggle('rounded-t-md', !isLogin);
    document.getElementById('approval-message').style.display = 'none';
    document.getElementById('blocked-message').style.display = 'none';
}

  