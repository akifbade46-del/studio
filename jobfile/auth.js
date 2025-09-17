import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showLoader, hideLoader, showNotification, toggleAuthView, showLogin, showApp } from './ui.js';
import { setCurrentUser, setDb, setAuth } from './state.js';

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

function initializeAuth() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setDb(db);
        setAuth(auth);
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists() && userDoc.data().status === 'active') {
                    const currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
                    setCurrentUser(currentUser);
                    showApp();
                    
                    // Dynamically import the main script after user is authenticated
                    const { initializeMainApp } = await import('./script.js');
                    initializeMainApp();
                } else {
                    const status = userDoc.exists() ? userDoc.data().status : 'not_found';
                    if (status === 'inactive') {
                        document.getElementById('approval-message').style.display = 'block';
                    } else if (status === 'blocked') {
                        document.getElementById('blocked-message').style.display = 'block';
                    }
                    await signOut(auth);
                    setCurrentUser(null);
                    showLogin();
                }
            } else {
                setCurrentUser(null);
                showLogin();
            }
        });

    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Could not connect to the database.", true);
    }
    
    // Attach listeners for login UI
    let isLogin = true;
    document.getElementById('auth-link').addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        toggleAuthView(isLogin);
    });

    document.getElementById('auth-btn').addEventListener('click', () => {
        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;
        if (isLogin) {
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
        const { openModal } = await import('./ui.js');
        openModal('forgot-password-modal');
    });
}


// --- Authentication Logic ---
async function handleSignUp(email, password, displayName) {
    showLoader();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const usersCollectionRef = collection(db, 'users');
        const userQuerySnapshot = await getDocs(usersCollectionRef);
        const isFirstUser = userQuerySnapshot.size === 0;

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
        toggleAuthView(true);
    } catch (error) {
        console.error("Sign up error:", error);
        showNotification(error.message, true);
    }
    hideLoader();
}

async function handleLogin(email, password) {
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
        const { closeModal } = await import('./ui.js');
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

// --- URL Handling and Initializer ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const jobIdFromUrl = urlParams.get('jobId');

    if (jobIdFromUrl) {
        // Public view logic
        const app = initializeApp(firebaseConfig);
        const publicDb = getFirestore(app);
        setDb(publicDb);
        const { showPublicJobView } = import('./ui.js').then(({ showPublicJobView }) => {
            showPublicJobView(jobIdFromUrl);
        });
    } else {
        // Regular app logic
        initializeAuth();
    }
});
