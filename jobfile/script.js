import { initializeAppLogic } from './auth.js';

// --- Make functions globally available for dynamic content ---
// This allows inline onclick attributes in dynamically generated HTML to call these functions.
import { previewJobFileById, confirmDelete, editClient, showStatusJobs, showUserJobs, showSalesmanJobs, showMonthlyJobs, sortAnalyticsTable, downloadAnalyticsCsv, clearForm, printPage, openModal, closeModal } from './ui.js';
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


// --- Initialize ---
// This function will handle auth state and then call the relevant functions to set up the UI for the main app.
initializeAppLogic();
