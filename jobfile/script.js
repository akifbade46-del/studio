import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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


// --- Auth Logic for app.html ---
function handleLogout() {
    signOut(auth).catch(error => {
        console.error('Logout Error:', error);
        alert('Could not log out. Please try again.');
    });
}

// Auth state listener for the main app page
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, get their data
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().status === 'active') {
            // User is valid, initialize the main app
            const currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
            initializeAppUI(currentUser);
        } else {
            // User is not active or doesn't exist in firestore, redirect to login
            window.location.href = 'index.html';
        }
    } else {
        // User is not signed in, redirect to login page
        window.location.href = 'index.html';
    }
});


// --- Make functions globally available for dynamic content ---
// This allows inline onclick attributes in dynamically generated HTML to call these functions.
import { previewJobFileById, confirmDelete, editClient, showStatusJobs, showUserJobs, showSalesmanJobs, showMonthlyJobs, sortAnalyticsTable, downloadAnalyticsCsv, clearForm, printPage, openModal, closeModal, initializeAppUI } from './ui.js';
import { loadJobFileById, checkJobFile, uncheckJobFile, approveJobFile, promptForRejection, restoreJobFile, confirmPermanentDelete, saveJobFile, openAdminPanel, saveUserChanges, backupAllData, handleRestoreFile, saveClient } from './firestore.js';
import { deleteChargeDescription, openChargeManager, saveChargeDescription, applyFiltersAndDisplay, openUserActivityLog } from './ui.js';
import { generateRemarks, suggestCharges } from './gemini.js';


window.previewJobFileById = previewJobFileById;
window.loadJobFileById = loadJobFileById;
window.confirmDelete = confirmDelete;
window.editClient = editClient;
window.checkJobFile = checkJobFile;
window.uncheckJobFile = uncheckJobFile;
window.approveJobFile = approveJobFile;
window.promptForRejection = promptForRejection;
window.restoreJobFile = restoreJobFile;
window.confirmPermanentDelete = confirmPermanentDelete;
window.deleteChargeDescription = deleteChargeDescription;
window.showStatusJobs = showStatusJobs;
window.showUserJobs = showUserJobs;
window.showSalesmanJobs = showSalesmanJobs;
window.showMonthlyJobs = showMonthlyJobs;
window.sortAnalyticsTable = sortAnalyticsTable;
window.downloadAnalyticsCsv = downloadAnalyticsCsv;
window.saveJobFile = saveJobFile;
window.clearForm = clearForm;
window.printPage = printPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.openAdminPanel = openAdminPanel;
window.saveUserChanges = saveUserChanges;
window.backupAllData = backupAllData;
window.handleRestoreFile = handleRestoreFile;
window.saveClient = saveClient;
window.openChargeManager = openChargeManager;
window.saveChargeDescription = saveChargeDescription;
window.applyFiltersAndDisplay = applyFiltersAndDisplay;
window.openUserActivityLog = openUserActivityLog;
window.generateRemarks = generateRemarks;
window.suggestCharges = suggestCharges;
window.handleLogout = handleLogout; // Expose logout function globally
