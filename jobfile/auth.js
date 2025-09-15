import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showLoader, hideLoader, showNotification, openModal, closeModal } from './ui.js';
import { initializeMainApp } from './script.js';
import { state } from './state.js';

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

let isLoginView = true;

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');

// --- View Toggling ---
export function showAppView() {
    loginScreen.style.display = 'none';
    appContainer.style.display = 'block';
}

export function showLoginView() {
    loginScreen.style.display = 'flex';
    appContainer.style.display = 'none';
}

// --- Authentication Logic ---
async function handleSignUp(email, password, displayName) {
    showLoader();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const usersCollectionRef = collection(db, 'users');
        const userQuerySnapshot = await getDocs(usersCollectionRef);
        const isFirstUser = userQuerySnapshot.size === 0;

        const newUser = {
            email: user.email,
            displayName: displayName,
            role: isFirstUser ? 'admin' : 'user',
            status: isFirstUser ? 'active' : 'inactive',
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'users', user.uid), newUser);
        
        showNotification("Account created! Please wait for admin approval.", false);
        await signOut(auth);
        toggleAuthView(true);

    } catch (error) {
        console.error("Sign up error:", error);
        showNotification(error.message, true);
    }
    hideLoader();
}

async function handleLogin(email, password) {
    if (!email || !password) {
        showNotification("Please enter both email and password.", true);
        return;
    }
    showLoader();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the redirect or view change
    } catch (error) {
        hideLoader();
        console.error("Login error:", error);
        let message = "Login failed. Please check your credentials.";
        if (error.code === 'auth/invalid-credential') {
            message = "Incorrect email or password.";
        }
        showNotification(message, true);
    }
}

async function handleForgotPassword() {
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
        let message = "Could not send reset link.";
        if(error.code === 'auth/user-not-found'){
            message = "No account found with this email.";
        }
        showNotification(message, true);
    }
}

function toggleAuthView(showLogin) {
    isLoginView = showLogin;
    const nameField = document.getElementById('signup-name-field');
    const emailField = document.getElementById('email-address');

    nameField.style.display = showLogin ? 'none' : 'block';
    emailField.classList.toggle('rounded-t-md', !showLogin);
    
    document.getElementById('auth-title').textContent = showLogin ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('auth-btn').textContent = showLogin ? 'Sign in' : 'Sign up';
    document.getElementById('auth-link').textContent = showLogin ? 'Create a new account' : 'Already have an account? Sign in';
}

function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            showLoader();
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists() && userDoc.data().status === 'active') {
                const currentUser = { uid: user.uid, ...userDoc.data() };
                state.currentUser = currentUser; // Set state
                
                if (currentUser.role === 'warehouse_supervisor') {
                    window.location.href = '../pod/index.html';
                } else {
                    showAppView();
                    initializeMainApp(); // Initialize the main app logic
                }
            } else {
                if (userDoc.exists()) {
                    const status = userDoc.data().status;
                    if (status === 'inactive') {
                        document.getElementById('approval-message').style.display = 'block';
                    } else if (status === 'blocked') {
                        document.getElementById('blocked-message').style.display = 'block';
                    }
                } else {
                    showNotification("Your user profile was not found in the database.", true);
                }
                await signOut(auth);
                showLoginView();
                hideLoader();
            }
        } else {
            showLoginView();
            hideLoader();
        }
    });

    document.getElementById('auth-link').addEventListener('click', (e) => {
        e.preventDefault();
        toggleAuthView(!isLoginView);
    });

    document.getElementById('auth-btn').addEventListener('click', () => {
        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;

        if (isLoginView) {
            handleLogin(email, password);
        } else {
            const displayName = document.getElementById('full-name').value;
             if (!email || !password || !displayName) {
                 showNotification("Please fill all fields to sign up.", true);
                 return;
            }
            handleSignUp(email, password, displayName);
        }
    });

    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        openModal('forgot-password-modal');
    });
    
    document.getElementById('close-forgot-password-modal').addEventListener('click', () => closeModal('forgot-password-modal'));
    document.getElementById('send-reset-link-btn').addEventListener('click', handleForgotPassword);

    toggleAuthView(true);
}

// --- App Entry Point ---
initializeAuth();
