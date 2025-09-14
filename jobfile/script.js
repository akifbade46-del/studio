import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    setCurrentUser,
    setJobFilesCache,
    setClientsCache,
    setChargeDescriptions,
    setAnalyticsDataCache,
    setCurrentFilteredJobs,
    setFileIdToReject,
    setProfitChartInstance
} from './state.js';

import {
    clearForm,
    populateTable,
    addChargeRow,
    printPage,
    openModal,
    closeModal,
    applyFiltersAndDisplay,
    openClientManager,
    clearClientForm,
    filterClients,
    setupAutocomplete,
    openChargeManager,
    saveChargeDescription,
    closeAnalyticsDashboard,
    printAnalytics,
    openRecycleBin,
    printPreview,
    openUserActivityLog,
    displayJobFiles,
    displayClients,
    editClient,
    showStatusJobs,
    showUserJobs,
    showSalesmanJobs,
    showMonthlyJobs,
    sortAnalyticsTable,
    downloadAnalyticsCsv,
    previewJobFileById,
    checkJobFile,
    uncheckJobFile,
    approveJobFile,
    promptForRejection,
    restoreJobFile,
    confirmPermanentDelete,
    deleteChargeDescription,
    updateStatusSummary,
    openAnalyticsDashboard
} from './ui.js';

import { 
    saveJobFile, 
    loadJobFiles, 
    loadClients, 
    saveClient,
    openAdminPanel, 
    saveUserChanges, 
    backupAllData, 
    handleRestoreFile, 
    confirmDelete,
    rejectJobFile,
    loadJobFileById
} from './firestore.js';

import { generateRemarks, suggestCharges } from './gemini.js';

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

// --- Firebase Initialization & Auth Check ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function handleLogout() {
    signOut(auth).catch(error => console.error('Logout Error:', error));
}

function initializeAppUI(user, userData) {
    setCurrentUser({ uid: user.uid, ...userData });

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    }

    document.getElementById('user-display-name').textContent = userData.displayName;
    document.getElementById('user-role').textContent = userData.role;

    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'none');
    
    if (userData.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'block');
        document.getElementById('checker-info-banner').style.display = 'block';
    } else if (userData.role === 'checker') {
        document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'block');
        document.getElementById('checker-info-banner').style.display = 'block';
    }
    
    // --- Initialize Data Loading ---
    loadJobFiles();
    loadClients();
    
    const storedDescriptions = localStorage.getItem('chargeDescriptions');
    if (storedDescriptions) {
        setChargeDescriptions(JSON.parse(storedDescriptions));
    } else {
        const defaultDescriptions = [
            'Ex-works Charges:', 'Land/Air / Sea Freight:', 'Fuell Security / War Surcharge:', 'Formalities:', 'Delivery Order Fee:', 'Transportation Charges:', 'Inspection / Computer Print Charges:', 'Handling Charges:', 'Labor / Forklift Charges:', 'Documentation Charges:', 'Clearance Charges:', 'Customs Duty:', 'Terminal Handling Charges:', 'Legalization Charges:', 'Demurrage Charges:', 'Loading / Offloading Charges:', 'Destination Clearance Charges:', 'Packing Charges:', 'Port Charges:', 'Other Charges:', 'PAI Approval :', 'Insurance Fee :', 'EPA Charges :'
        ];
        setChargeDescriptions(defaultDescriptions);
        localStorage.setItem('chargeDescriptions', JSON.stringify(defaultDescriptions));
    }
    
    clearForm();
    setupAppEventListeners();
}

function setupAppEventListeners() {
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('save-job-file-btn').addEventListener('click', saveJobFile);
    document.getElementById('new-job-btn').addEventListener('click', clearForm);
    document.getElementById('print-page-btn').addEventListener('click', printPage);
    document.getElementById('client-manager-btn').addEventListener('click', openClientManager);
    document.getElementById('file-manager-btn').addEventListener('click', () => openModal('file-manager-modal'));
    document.getElementById('analytics-btn').addEventListener('click', openAnalyticsDashboard);
    document.getElementById('approve-btn').addEventListener('click', () => approveJobFile());
    document.getElementById('reject-btn').addEventListener('click', () => promptForRejection(null));
    document.getElementById('confirm-reject-btn').addEventListener('click', rejectJobFile);
    document.getElementById('check-btn').addEventListener('click', () => checkJobFile());
    document.getElementById('generate-remarks-btn').addEventListener('click', generateRemarks);
    document.getElementById('suggest-charges-btn').addEventListener('click', suggestCharges);
    document.getElementById('add-charge-row-btn').addEventListener('click', () => addChargeRow());
    document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
    document.getElementById('save-user-changes-btn').addEventListener('click', saveUserChanges);
    document.getElementById('backup-data-btn').addEventListener('click', backupAllData);
    document.getElementById('restore-file-input').addEventListener('change', handleRestoreFile);
    document.getElementById('activity-log-btn').addEventListener('click', openUserActivityLog);
    document.getElementById('search-bar').addEventListener('input', applyFiltersAndDisplay);
    document.getElementById('filter-status').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('filter-date-from').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('filter-date-to').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        document.getElementById('search-bar').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        applyFiltersAndDisplay();
    });
    document.getElementById('client-form').addEventListener('submit', saveClient);
    document.getElementById('clear-client-form-btn').addEventListener('click', clearClientForm);
    document.getElementById('client-search-bar').addEventListener('input', (e) => filterClients(e.target.value));
    
    setupAutocomplete('shipper-name', 'shipper-suggestions', 'Shipper');
    setupAutocomplete('consignee-name', 'consignee-suggestions', 'Consignee');
    
    document.getElementById('charge-manager-btn').addEventListener('click', openChargeManager);
    document.getElementById('save-charge-description-btn').addEventListener('click', saveChargeDescription);
    document.getElementById('close-analytics-btn').addEventListener('click', closeAnalyticsDashboard);
    document.getElementById('print-analytics-btn').addEventListener('click', printAnalytics);
    document.getElementById('recycle-bin-btn').addEventListener('click', openRecycleBin);
    document.getElementById('print-preview-btn').addEventListener('click', printPreview);
    
    document.getElementById('close-file-manager-btn').addEventListener('click', () => closeModal('file-manager-modal'));
    document.getElementById('close-preview-btn').addEventListener('click', () => closeModal('preview-modal'));
    document.getElementById('close-admin-panel-btn').addEventListener('click', () => closeModal('admin-panel-modal'));
    document.getElementById('cancel-reject-btn').addEventListener('click', () => closeModal('reject-reason-modal'));
    document.getElementById('close-client-manager-btn').addEventListener('click', () => closeModal('client-manager-modal'));
    document.getElementById('close-charge-manager-btn').addEventListener('click', () => closeModal('charge-manager-modal'));
    document.getElementById('close-activity-log-btn').addEventListener('click', () => closeModal('activity-log-modal'));
    document.getElementById('close-user-jobs-btn').addEventListener('click', () => closeModal('user-jobs-modal'));
    document.getElementById('close-recycle-bin-btn').addEventListener('click', () => closeModal('recycle-bin-modal'));
    
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        const okButton = document.getElementById('confirm-ok');
        const newOkButton = okButton.cloneNode(true);
        okButton.parentNode.replaceChild(newOkButton, okButton);
        closeModal('confirm-modal');
    });

    window.addEventListener('afterprint', () => {
        document.getElementById('main-container').style.display = 'block';
        document.getElementById('print-output').style.display = 'none';
    });

    // Make functions globally available for inline event handlers from dynamic HTML
    window.previewJobFileById = previewJobFileById;
    window.loadJobFileById = loadJobFileById;
    window.confirmDelete = confirmDelete;
    window.editClient = editClient;
    window.showStatusJobs = showStatusJobs;
    window.showUserJobs = showUserJobs;
    window.showSalesmanJobs = showSalesmanJobs;
    window.showMonthlyJobs = showMonthlyJobs;
    window.sortAnalyticsTable = sortAnalyticsTable;
    window.downloadAnalyticsCsv = downloadAnalyticsCsv;
    window.checkJobFile = checkJobFile;
    window.uncheckJobFile = uncheckJobFile;
    window.approveJobFile = approveJobFile;
    window.promptForRejection = promptForRejection;
    window.restoreJobFile = restoreJobFile;
    window.confirmPermanentDelete = confirmPermanentDelete;
    window.deleteChargeDescription = deleteChargeDescription;
}

// This is the main entry point for the application page
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().status === 'active') {
            initializeAppUI(user, userDoc.data());
        } else {
            // User is not active or doesn't exist in Firestore, redirect to login
            window.location.href = 'index.html';
        }
    } else {
        // No user is logged in, redirect to login
        window.location.href = 'index.html';
    }
});
