
import { initializeAppLogic, handleLogin, handleSignUp, handleLogout, handleForgotPassword, toggleAuthView } from './auth.js';
import { 
    openModal, closeModal, clearForm, printPage, showNotification, 
    applyFiltersAndDisplay, openUserActivityLog, editClient,
    confirmDelete, promptForRejection, openChargeManager, saveChargeDescription, deleteChargeDescription,
    setupAutocomplete, openRecycleBin, confirmPermanentDelete, restoreJobFile,
    printPreview, printAnalytics, openAnalyticsDashboard, closeAnalyticsDashboard,
    clearClientForm
} from './ui.js';
import { 
    saveJobFile, checkJobFile, uncheckJobFile, approveJobFile, rejectJobFile, 
    saveClient, openAdminPanel, saveUserChanges, backupAllData, handleRestoreFile,
    loadJobFileById
} from './firestore.js';
import { generateRemarks, suggestCharges } from './gemini.js';
import { setFileIdToReject, fileIdToReject } from './state.js';
import { getJobFileById } from './utils.js';

// --- Initialize ---
initializeAppLogic();

// --- Auth ---
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

document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('jfn-forgot-password-link').addEventListener('click', (e) => { e.preventDefault(); openModal('forgot-password-modal'); });
document.getElementById('jfn-send-reset-link-btn').addEventListener('click', handleForgotPassword);
document.getElementById('close-forgot-password-btn').addEventListener('click', () => closeModal('forgot-password-modal'));


// --- Main Action Buttons ---
document.getElementById('save-job-file-btn').addEventListener('click', saveJobFile);
document.getElementById('new-job-btn').addEventListener('click', clearForm);
document.getElementById('print-page-btn').addEventListener('click', printPage);
document.getElementById('client-manager-btn').addEventListener('click', () => openModal('client-manager-modal'));
document.getElementById('file-manager-btn').addEventListener('click', () => openModal('file-manager-modal'));
document.getElementById('analytics-btn').addEventListener('click', openAnalyticsDashboard);

// --- Job File Actions ---
document.getElementById('approve-btn').addEventListener('click', () => approveJobFile());
document.getElementById('reject-btn').addEventListener('click', () => promptForRejection(null));
document.getElementById('confirm-reject-btn').addEventListener('click', () => {
    rejectJobFile(fileIdToReject);
    setFileIdToReject(null);
});
document.getElementById('check-btn').addEventListener('click', () => checkJobFile());

// --- AI Buttons ---
document.getElementById('generate-remarks-btn').addEventListener('click', generateRemarks);
document.getElementById('suggest-charges-btn').addEventListener('click', suggestCharges);

// --- Charges Table ---
document.getElementById('add-charge-row-btn').addEventListener('click', () => import('./ui.js').then(ui => ui.addChargeRow()));

// --- Admin Panel & Backup ---
document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
document.getElementById('save-user-changes-btn').addEventListener('click', saveUserChanges);
document.getElementById('backup-data-btn').addEventListener('click', backupAllData);
document.getElementById('restore-file-input').addEventListener('change', handleRestoreFile);
document.getElementById('activity-log-btn').addEventListener('click', openUserActivityLog);

// --- File Manager ---
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

// --- Client Manager ---
document.getElementById('client-form').addEventListener('submit', saveClient);
document.getElementById('clear-client-form-btn').addEventListener('click', clearClientForm);
document.getElementById('client-search-bar').addEventListener('input', (e) => {
    import('./ui.js').then(ui => ui.filterClients(e.target.value));
});
setupAutocomplete('shipper-name', 'shipper-suggestions', 'Shipper');
setupAutocomplete('consignee-name', 'consignee-suggestions', 'Consignee');

// --- Charge Manager ---
document.getElementById('charge-manager-btn').addEventListener('click', openChargeManager);
document.getElementById('save-charge-description-btn').addEventListener('click', saveChargeDescription);

// --- Analytics ---
document.getElementById('close-analytics-btn').addEventListener('click', closeAnalyticsDashboard);
document.getElementById('print-analytics-btn').addEventListener('click', printAnalytics);

// --- Recycle Bin ---
document.getElementById('recycle-bin-btn').addEventListener('click', openRecycleBin);

// --- Preview Modal ---
document.getElementById('print-preview-btn').addEventListener('click', printPreview);

// --- Window & Close Buttons ---
window.addEventListener('afterprint', () => {
    document.getElementById('main-container').style.display = 'block';
    document.getElementById('print-output').style.display = 'none';
    document.getElementById('analytics-container').style.display = 'block';
});

document.getElementById('close-file-manager-btn').addEventListener('click', () => closeModal('file-manager-modal'));
document.getElementById('close-preview-btn').addEventListener('click', () => closeModal('preview-modal'));
document.getElementById('close-admin-panel-btn').addEventListener('click', () => closeModal('admin-panel-modal'));
document.getElementById('cancel-reject-btn').addEventListener('click', () => closeModal('reject-reason-modal'));
document.getElementById('close-client-manager-btn').addEventListener('click', () => closeModal('client-manager-modal'));
document.getElementById('close-charge-manager-btn').addEventListener('click', () => closeModal('charge-manager-modal'));
document.getElementById('close-activity-log-btn').addEventListener('click', () => closeModal('activity-log-modal'));
document.getElementById('close-user-jobs-btn').addEventListener('click', () => closeModal('user-jobs-modal'));
document.getElementById('close-recycle-bin-btn').addEventListener('click', () => closeModal('recycle-bin-modal'));
document.getElementById('confirm-cancel').addEventListener('click', () => closeModal('confirm-modal'));

// --- Make functions globally available for dynamic content ---
window.previewJobFileById = (id) => import('./ui.js').then(ui => ui.previewJobFileById(id));
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
window.showStatusJobs = (status) => import('./ui.js').then(ui => ui.showStatusJobs(status));
window.showUserJobs = (userName) => import('./ui.js').then(ui => ui.showUserJobs(userName));
window.showSalesmanJobs = (salesman) => import('./ui.js').then(ui => ui.showSalesmanJobs(salesman));
window.showMonthlyJobs = (month, type) => import('./ui.js').then(ui => ui.showMonthlyJobs(month, type));
window.sortAnalyticsTable = (sortBy) => import('./ui.js').then(ui => ui.sortAnalyticsTable(sortBy));
window.downloadAnalyticsCsv = () => import('./ui.js').then(ui => ui.downloadAnalyticsCsv());
