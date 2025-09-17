// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

let auth;
let db;

// --- Main Initialization Function ---
export async function initializeAppAndAuth(onLoginSuccess, showPublicView, showLoginView) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        const urlParams = new URLSearchParams(window.location.search);
        const jobIdFromUrl = urlParams.get('jobId');

        if (jobIdFromUrl) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'none';
            showLoader();
            showPublicView(jobIdFromUrl, db);
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
                    
                    const currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
                    
                    if (currentUser.status === 'inactive') {
                        showLoginView();
                        document.getElementById('approval-message').style.display = 'block';
                        document.getElementById('blocked-message').style.display = 'none';
                        signOut(auth);
                        return;
                    }

                    if (currentUser.status === 'blocked') {
                        showLoginView();
                        document.getElementById('approval-message').style.display = 'none';
                        document.getElementById('blocked-message').style.display = 'block';
                        signOut(auth);
                        return;
                    }
                    
                    console.log("User logged in:", currentUser);
                    onLoginSuccess(currentUser, db);

                } else {
                    console.log("User logged out");
                    showLoginView();
                }
            });
        }
        
        setupAuthEventListeners();

    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Could not connect to the database.", true);
    }
}


function setupAuthEventListeners() {
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

    // The main app script will handle logout now.
    // document.getElementById('logout-btn').addEventListener('click', handleLogout); 
    
    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        openModal('forgot-password-modal');
    });
    document.getElementById('send-reset-link-btn').addEventListener('click', handleForgotPassword);

    // Make modal close buttons work
    const allModals = document.querySelectorAll('.overlay');
    allModals.forEach(modal => {
        const closeButton = modal.querySelector('button[onclick^="closeModal"]');
        if (closeButton) {
            const modalId = modal.id;
            closeButton.removeAttribute('onclick');
            closeButton.addEventListener('click', () => closeModal(modalId));
        }
    });

}


// --- Authentication Logic ---
async function handleSignUp(email, password, displayName) {
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

async function handleLogin(email, password) {
    showLoader();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the rest
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
        let message = "Could not send reset link. Please try again.";
        if(error.code === 'auth/user-not-found'){
            message = "No account found with this email address.";
        }
        showNotification(message, true);
    }
}

export function handleLogout() {
    if (auth) {
      signOut(auth);
    }
}


// --- UI Helper Functions (Moved from index.html) ---

export function showLoader() { 
    const loader = document.getElementById('loader-overlay');
    if(loader) loader.classList.add('visible'); 
}
export function hideLoader() { 
    const loader = document.getElementById('loader-overlay');
    if(loader) loader.classList.remove('visible'); 
}

export function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if(!notification) return;
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#c53030' : '#2d3748';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

export function openModal(id, keepParent = false) {
    if (!keepParent) {
        closeAllModals();
    }
    const modal = document.getElementById(id);
    if (!modal) return;

    if (keepParent) {
        const highestZ = Array.from(document.querySelectorAll('.overlay.visible'))
            .reduce((max, el) => Math.max(max, parseInt(window.getComputedStyle(el).zIndex || 1000)), 1000);
        modal.style.zIndex = highestZ + 10;
    }
    modal.classList.add('visible');
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('visible');
}

export function closeAllModals() {
    document.querySelectorAll('.overlay').forEach(modal => {
        modal.classList.remove('visible');
        modal.style.zIndex = '';
    });
}

export function toggleAuthView(showLogin) {
    const nameField = document.getElementById('signup-name-field');
    const emailField = document.getElementById('email-address');
    
    document.getElementById('auth-title').textContent = showLogin ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('auth-btn').textContent = showLogin ? 'Sign in' : 'Sign up';
    document.getElementById('auth-link').textContent = showLogin ? 'Create a new account' : 'Already have an account? Sign in';
    
    if (nameField) nameField.style.display = showLogin ? 'none' : 'block';
    if (emailField) emailField.classList.toggle('rounded-t-md', !showLogin);
    
    const approvalMsg = document.getElementById('approval-message');
    if (approvalMsg) approvalMsg.style.display = 'none';
}

// Make these functions globally available for the main script
window.showLoader = showLoader;
window.hideLoader = hideLoader;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.toggleAuthView = toggleAuthView;
window.handleLogout = handleLogout;
