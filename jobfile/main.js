import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    openModal, closeModal, clearForm, openClientManager, 
    clearClientForm, openAdminPanel, openUserActivityLog, 
    openRecycleBin, openChargeManager, openAnalyticsDashboard, closeAnalyticsDashboard,
    printPage, printPreview, previewJobFileById, applyFiltersAndDisplay,
    setupAutocomplete, addChargeRow, editClient, showUserJobs, showMonthlyJobs, showSalesmanJobs, showStatusJobs, printAnalytics,
    displayClients, displayChargeDescriptions,
    logUserActivity
} from './ui.js';
import { 
    saveJobFile, loadJobFileById, checkJobFile, uncheckJobFile, approveJobFile, 
    promptForRejection, rejectJobFile, confirmDelete, confirmPermanentDelete, 
    restoreJobFile, saveClient, backupAllData, handleRestoreFile,
    saveChargeDescription, deleteChargeDescription, loadJobFiles, loadClients, loadChargeDescriptions,
    saveUserChanges
} from './firestore.js';
import { generateRemarks, suggestCharges } from './gemini.js';
import { getClientsCache, getJobFilesCache } from './state.js';


// This function is called only after a successful login
export function initializeMainApp() {
    const auth = getAuth();
    
    // Load initial data
    loadJobFiles();
    loadClients().then(() => displayClients(getClientsCache())); // Load and then display
    loadChargeDescriptions();
    
    // Set initial form state
    clearForm();

    // Attach all event listeners
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    
    // Main action buttons
    document.getElementById('save-job-btn').addEventListener('click', saveJobFile);
    document.getElementById('new-job-btn').addEventListener('click', clearForm);
    document.getElementById('print-page-btn').addEventListener('click', printPage);

    // Modal Triggers
    document.getElementById('open-analytics-btn').addEventListener('click', openAnalyticsDashboard);
    document.getElementById('client-manager-btn').addEventListener('click', openClientManager);
    document.getElementById('file-manager-btn').addEventListener('click', () => openModal('file-manager-modal'));
    document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
    document.getElementById('activity-log-btn').addEventListener('click', openUserActivityLog);
    
    // Approval flow buttons
    document.getElementById('check-btn').addEventListener('click', () => checkJobFile());
    document.getElementById('approve-btn').addEventListener('click', () => approveJobFile());
    document.getElementById('reject-btn').addEventListener('click', () => promptForRejection(null));
    document.getElementById('confirm-reject-btn').addEventListener('click', rejectJobFile);
    document.getElementById('cancel-reject-modal-btn').addEventListener('click', () => closeModal('reject-reason-modal'));

    // Gemini AI feature buttons
    document.getElementById('generate-remarks-btn').addEventListener('click', generateRemarks);
    document.getElementById('suggest-charges-btn').addEventListener('click', suggestCharges);
    
    // Modal Close Buttons
    document.getElementById('close-analytics-btn').addEventListener('click', closeAnalyticsDashboard);
    document.getElementById('close-file-manager-modal').addEventListener('click', () => closeModal('file-manager-modal'));
    document.getElementById('close-preview-modal').addEventListener('click', () => closeModal('preview-modal'));
    document.getElementById('close-admin-panel-modal').addEventListener('click', () => closeModal('admin-panel-modal'));
    document.getElementById('close-client-manager-modal').addEventListener('click', () => closeModal('client-manager-modal'));
    document.getElementById('close-charge-manager-modal').addEventListener('click', () => closeModal('charge-manager-modal'));
    document.getElementById('close-activity-log-modal').addEventListener('click', () => closeModal('activity-log-modal'));
    document.getElementById('close-user-jobs-modal').addEventListener('click', () => closeModal('user-jobs-modal'));
    document.getElementById('confirm-cancel').addEventListener('click', () => closeModal('confirm-modal'));
    document.getElementById('close-recycle-bin-modal').addEventListener('click', () => closeModal('recycle-bin-modal'));
    
    // File Manager
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
    document.getElementById('recycle-bin-btn').addEventListener('click', openRecycleBin);

    // Client Manager
    document.getElementById('client-form').addEventListener('submit', saveClient);
    document.getElementById('clear-client-form-btn').addEventListener('click', clearClientForm);
    document.getElementById('client-search-bar').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredClients = getClientsCache().filter(client => client.name.toLowerCase().includes(searchTerm));
        displayClients(filteredClients);
    });

    // Charge Manager
    document.getElementById('manage-charges-btn').addEventListener('click', openChargeManager);
    document.getElementById('save-charge-description-btn').addEventListener('click', saveChargeDescription);
    document.getElementById('add-charge-btn').addEventListener('click', () => addChargeRow());
    
    // Admin Panel
    document.getElementById('save-user-changes-btn').addEventListener('click', saveUserChanges);
    document.getElementById('backup-data-btn').addEventListener('click', backupAllData);
    document.getElementById('restore-file-input').addEventListener('change', handleRestoreFile);

    // Print buttons
    document.getElementById('print-preview-btn').addEventListener('click', printPreview);
    document.getElementById('print-analytics-btn').addEventListener('click', printAnalytics);

    // Autocomplete setup
    setupAutocomplete('shipper-name', 'shipper-suggestions', 'Shipper');
    setupAutocomplete('consignee-name', 'consignee-suggestions', 'Consignee');
    
    // Make functions globally accessible for inline onclick handlers from dynamic HTML
    window.previewJobFileById = previewJobFileById;
    window.loadJobFileById = (docId) => {
        const job = getJobFilesCache().find(j => j.id === docId);
        if (job) logUserActivity(job.jfn);
        loadJobFileById(docId);
    };
    window.editClient = editClient;
    window.confirmDelete = confirmDelete;
    window.checkJobFile = checkJobFile;
    window.uncheckJobFile = uncheckJobFile;
    window.approveJobFile = approveJobFile;
    window.promptForRejection = promptForRejection;
    window.confirmPermanentDelete = confirmPermanentDelete;
    window.restoreJobFile = restoreJobFile;
    window.showUserJobs = showUserJobs;
    window.showMonthlyJobs = showMonthlyJobs;
    window.showSalesmanJobs = showSalesmanJobs;
    window.showStatusJobs = showStatusJobs;
    window.deleteChargeDescription = deleteChargeDescription;
}

  