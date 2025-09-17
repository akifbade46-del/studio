// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onLoginSuccess } from "./script.js";

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
export async function initializeAppAndAuth() {
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

    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Could not connect to the database.", true);
    }
}

function showLoginView() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('analytics-container').style.display = 'none';
}

async function showPublicView(jobId, firestoreDb) {
    db = firestoreDb;
    try {
        const docId = jobId.replace(/\//g, '_');
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const publicViewContainer = document.getElementById('public-view-container');
            // This will be fixed once script.js is modularized and getPrintViewHtml is available
            publicViewContainer.innerHTML = `
                <div class="border border-gray-700 p-4 bg-white text-center">
                    <h1 class="text-2xl font-bold">Job File: ${data.jfn}</h1>
                    <p>Shipper: ${data.sh}</p>
                    <p>Consignee: ${data.co}</p>
                    <p class="mt-4 text-sm text-gray-500">Public view is partially implemented.</p>
                </div>
            `;

        } else {
            document.body.innerHTML = `<div class="p-4 text-center text-yellow-700 bg-yellow-100">Job File with ID "${jobId}" not found.</div>`;
        }
    } catch (error) {
        console.error("Error fetching public job file:", error);
        document.body.innerHTML = `<div class="p-4 text-center text-red-700 bg-red-100">Error loading job file.</div>`;
    } finally {
        hideLoader();
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
    if (auth) {
      signOut(auth);
    }
}


// --- UI Helper Functions (moved here from index.html) ---
function showLoader() { 
    const loader = document.getElementById('loader-overlay');
    if(loader) loader.classList.add('visible'); 
}
function hideLoader() { 
    const loader = document.getElementById('loader-overlay');
    if(loader) loader.classList.remove('visible'); 
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if(!notification) return;
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#c53030' : '#2d3748';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function openModal(id, keepParent = false) {
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

function closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('visible');
}

function closeAllModals() {
    document.querySelectorAll('.overlay').forEach(modal => {
        modal.classList.remove('visible');
        modal.style.zIndex = '';
    });
}

function toggleAuthView(showLogin) {
    const nameField = document.getElementById('signup-name-field');
    const emailField = document.getElementById('email-address');
    
    document.getElementById('auth-title').textContent = showLogin ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('auth-btn').textContent = showLogin ? 'Sign in' : 'Sign up';
    document.getElementById('auth-link').textContent = showLogin ? 'Create a new account' : 'Already have an account? Sign in';
    
    if (nameField) nameField.style.display = showLogin ? 'none' : 'block';
    
    // This logic needs to be carefully checked. In the original HTML, the email field gets a top radius when name field is hidden.
    if (emailField) {
        if (showLogin) {
             emailField.classList.remove('rounded-t-md');
        } else {
             emailField.classList.add('rounded-t-md');
        }
    }
    
    const approvalMsg = document.getElementById('approval-message');
    if (approvalMsg) approvalMsg.style.display = 'none';
}


// --- App Initialization Trigger (now handled by script.js) ---

// Make UI functions globally available for inline event handlers and other scripts
window.showLoader = showLoader;
window.hideLoader = hideLoader;
window.showNotification = showNotification;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.toggleAuthView = toggleAuthView;
window.handleLogout = handleLogout;
