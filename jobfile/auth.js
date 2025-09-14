import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

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

// --- UI Helper Functions (for this page only) ---
const showLoader = () => document.getElementById('loader-overlay').classList.add('visible');
const hideLoader = () => document.getElementById('loader-overlay').classList.remove('visible');
const openModal = (id) => document.getElementById(id).classList.add('visible');
const closeModal = (id) => document.getElementById(id).classList.remove('visible');

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#c53030' : '#2d3748';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function toggleAuthView(showLoginView) {
    const nameField = document.getElementById('signup-name-field');
    const emailField = document.getElementById('email-address');
    
    document.getElementById('auth-title').textContent = showLoginView ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('auth-btn').textContent = showLoginView ? 'Sign in' : 'Sign up';
    document.getElementById('auth-link').textContent = showLoginView ? 'Create a new account' : 'Already have an account? Sign in';
    nameField.style.display = showLoginView ? 'none' : 'block';
    
    emailField.classList.toggle('rounded-t-md', !showLoginView);

    document.getElementById('approval-message').style.display = 'none';
    document.getElementById('blocked-message').style.display = 'none';
}


// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


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
        
        hideLoader();
        if (isFirstUser) {
             showNotification("Admin account created successfully! Please sign in.", false);
        } else {
            showNotification("Account created! Please wait for admin approval.", false);
        }
        await signOut(auth); 
        toggleAuthView(true);

    } catch (error) {
        hideLoader();
        console.error("Sign up error:", error);
        if (error.code === 'auth/email-already-in-use') {
            showNotification("This email address is already in use.", true);
        } else {
            showNotification(error.message, true);
        }
    }
}

async function handleLogin(email, password) {
    if (!email || !password) {
        showNotification("Please enter both email and password.", true);
        return;
    }
    showLoader();
    try {
        // This will trigger onAuthStateChanged if successful
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        hideLoader();
        console.error("Login error:", error.code, error.message);
        let message = "Login failed. Please check your credentials.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            message = "Incorrect email or password. Please try again.";
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
        let message = "Could not send reset link. Please try again.";
        if(error.code === 'auth/user-not-found'){
            message = "No account found with this email address.";
        }
        showNotification(message, true);
    }
}

function setupAuthEventListeners() {
    let isLoginView = true;

    document.getElementById('auth-link').addEventListener('click', (e) => {
        e.preventDefault();
        isLoginView = !isLoginView;
        toggleAuthView(isLoginView);
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
    document.getElementById('send-reset-link-btn').addEventListener('click', handleForgotPassword);
    document.getElementById('close-forgot-password-btn').addEventListener('click', () => closeModal('forgot-password-modal'));
}


function initializeAppLogic() {
    setupAuthEventListeners();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in according to Firebase Auth. Now verify against Firestore.
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.status === 'active') {
                    // All checks passed. User is valid and active.
                    if (userData.role === 'warehouse_supervisor') {
                        window.location.href = '../pod/index.html';
                    } else {
                        window.location.href = 'app.html';
                    }
                } else if (userData.status === 'inactive') {
                    document.getElementById('approval-message').style.display = 'block';
                    document.getElementById('blocked-message').style.display = 'none';
                    await signOut(auth); // Force logout, user is not approved
                    hideLoader();
                } else if (userData.status === 'blocked') {
                    document.getElementById('approval-message').style.display = 'none';
                    document.getElementById('blocked-message').style.display = 'block';
                    await signOut(auth); // Force logout, user is blocked
                    hideLoader();
                }
            } else {
                // User exists in Auth, but not in Firestore DB. This is an invalid state.
                showNotification("User account data not found. Please contact admin.", true);
                await signOut(auth); // Force logout
                hideLoader();
            }
        } else {
            // No user is signed in. Do nothing, just stay on the login page.
            hideLoader();
        }
    });
}

// Start the app logic for the login page
initializeAppLogic();
