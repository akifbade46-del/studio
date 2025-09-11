import { initializeAppLogic } from './auth.js';

// --- Make functions globally available for dynamic content ---
// This allows inline onclick attributes in dynamically generated HTML to call these functions.
import { previewJobFileById, confirmDelete, editClient, showStatusJobs, showUserJobs, showSalesmanJobs, showMonthlyJobs, sortAnalyticsTable, downloadAnalyticsCsv } from './ui.js';
import { loadJobFileById, checkJobFile, uncheckJobFile, approveJobFile, promptForRejection, restoreJobFile, confirmPermanentDelete } from './firestore.js';
import { deleteChargeDescription } from './ui.js';

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
