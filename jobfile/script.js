
import { initializeAppLogic } from './auth.js';
import { 
    openModal, closeModal, clearForm, printPage, 
    applyFiltersAndDisplay, openUserActivityLog, editClient,
    confirmDelete, promptForRejection, openChargeManager, saveChargeDescription, deleteChargeDescription,
    setupAutocomplete, openRecycleBin, confirmPermanentDelete, restoreJobFile,
    printPreview, printAnalytics, openAnalyticsDashboard, closeAnalyticsDashboard,
    clearClientForm, previewJobFileById, showStatusJobs, showUserJobs, showSalesmanJobs, showMonthlyJobs, sortAnalyticsTable, downloadAnalyticsCsv
} from './ui.js';
import { 
    saveJobFile, checkJobFile, uncheckJobFile, approveJobFile, rejectJobFile, 
    saveClient, openAdminPanel, saveUserChanges, backupAllData, handleRestoreFile,
    loadJobFileById
} from './firestore.js';
import { generateRemarks, suggestCharges } from './gemini.js';
import { setFileIdToReject, fileIdToReject } from './state.js';
import { getJobFileById } from './utils.js';

// --- Make functions globally available for dynamic content ---
// This allows inline onclick attributes in dynamically generated HTML to call these functions.
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

// --- Initialize ---
// This is the only function that needs to be called at the start.
// It will handle auth state and then call the relevant functions to set up the UI.
initializeAppLogic();
