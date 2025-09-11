
import { initializeAppLogic } from './auth.js';
import { 
    openModal, closeModal, clearForm, printPage, 
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
// This is the only function that needs to be called at the start.
// It will handle auth state and then call the relevant functions to set up the UI.
initializeAppLogic();


// --- Make functions globally available for dynamic content ---
// This allows inline onclick attributes in dynamically generated HTML to call these functions.
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
