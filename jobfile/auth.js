import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { showLogin, showApp, showNotification, showLoader, hideLoader, closeModal, openModal } from './ui.js';
import { setCurrentUser } from './state.js';
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

function setupAuthEventListeners() {
    document.getElementById('jfn-auth-link').addEventListener('click', (e) => {
        e.preventDefault();
        const isLoginView = e.target.textContent.includes('Sign in');
        toggleAuthView(!isLoginView);
    });

    document.getElementById('jfn-auth-btn').addEventListener('click', () => {
        const email = document.getElementById('jfn-email-address').value;
        const password = document.getElementById('jfn-password').value;
        const isLogin = document.getElementById('jfn-auth-btn').textContent.includes('Sign in');

        if (isLogin) {
            handleLogin(email, password);
        } else {
            const displayName = document.getElementById('jfn-full-name').value;
             if (!email || !password || !displayName) {
                 showNotification("Please fill all fields to sign up.", true);
                 return;
            }
            handleSignUp(email, password, displayName);
        }
    });
    
    document.getElementById('jfn-forgot-password-link').addEventListener('click', (e) => { e.preventDefault(); openModal('forgot-password-modal'); });
    document.getElementById('jfn-send-reset-link-btn').addEventListener('click', handleForgotPassword);
    document.getElementById('close-forgot-password-btn').addEventListener('click', () => closeModal('forgot-password-modal'));
}


export async function initializeAppLogic() {
    try {
        // This is the critical fix: Setup listeners immediately on app load.
        setupAuthEventListeners();

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
                    userDoc = await getDoc(userDocRef); // Re-fetch the doc
                }
                
                const currentUserData = { uid: user.uid, email: user.email, ...userDoc.data() };
                
                if (currentUserData.status === 'inactive') {
                    showLogin();
                    document.getElementById('jfn-approval-message').style.display = 'block';
                    document.getElementById('jfn-blocked-message').style.display = 'none';
                    signOut(auth);
                    return;
                }

                if (currentUserData.status === 'blocked') {
                    showLogin();
                    document.getElementById('jfn-approval-message').style.display = 'none';
                    document.getElementById('jfn-blocked-message').style.display = 'block';
                    signOut(auth);
                    return;
                }
                
                setCurrentUser(currentUserData);
                showApp();
                loadJobFiles();
                loadClients();
            } else {
                setCurrentUser(null);
                showLogin();
            }
        });
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
        await signOut(auth); // Sign out immediately so admin has to approve
        toggleAuthView(true); // Switch back to login view
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
    const email = document.getElementById('jfn-reset-email').value.trim();
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

export function toggleAuthView(showLoginView) {
    const nameField = document.getElementById('jfn-signup-name-field');
    const emailField = document.getElementById('jfn-email-address');
    const passwordField = document.getElementById('jfn-password');
    
    document.getElementById('jfn-auth-title').textContent = showLoginView ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('jfn-auth-btn').textContent = showLoginView ? 'Sign in' : 'Sign up';
    document.getElementById('jfn-auth-link').textContent = showLoginView ? 'Create a new account' : 'Already have an account? Sign in';
    nameField.style.display = showLoginView ? 'none' : 'block';
    
    // Adjust classes for rounded corners
    if (showLoginView) {
        emailField.classList.remove('rounded-t-md');
        emailField.classList.add('rounded-md');
        passwordField.classList.remove('rounded-b-md');
        passwordField.classList.add('rounded-md');
    } else {
        emailField.classList.add('rounded-t-md');
        emailField.classList.remove('rounded-md');
        passwordField.classList.add('rounded-b-md');
        passwordField.classList.remove('rounded-md');
    }

    document.getElementById('jfn-approval-message').style.display = 'none';
    document.getElementById('jfn-blocked-message').style.display = 'none';
}