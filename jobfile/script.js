import { initializeAppAndAuth, handleLogin, handleSignUp, handleForgotPassword, handleLogout } from './auth.js';
import { initializeFirestore, saveJobFile as saveJobFileToDb, checkJobFile as checkJobFileInDb, uncheckJobFile as uncheckJobFileInDb, approveJobFile as approveJobFileInDb, rejectJobFile as rejectJobFileInDb, listenForJobFiles, loadJobFileById as loadJobFileFromDb, moveToRecycleBin, listenForClients, saveClient, deleteClient, getUsers, saveUserChanges as saveUserChangesToDb, getBackupData, restoreBackupData, getRecycleBinFiles, restoreJobFile as restoreJobFileFromBin, permanentlyDeleteJobFile, loadChargeDescriptions } from './firestore.js';

// --- Global variables ---
let currentUser = null;
let jobFilesCache = [];
let clientsCache = [];
let chargeDescriptions = [];
let analyticsDataCache = null;
let currentFilteredJobs = [];
let fileIdToReject = null; 
let profitChartInstance = null;
let db;

// This function is called by auth.js when the user logs in successfully
export function onLoginSuccess(user, firestoreDb) {
    currentUser = user;
    db = firestoreDb; 
    initializeFirestore(db, currentUser);
    showApp();
    listenForJobFiles(onJobFilesUpdate);
    listenForClients(onClientsUpdate);
    loadChargeDescriptions().then(descriptions => {
        chargeDescriptions = descriptions;
    });
}

function onJobFilesUpdate(files) {
    jobFilesCache = files;
    const sortedDocs = [...jobFilesCache].sort((a,b) => (b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0) - (a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0));
    displayJobFiles(sortedDocs);
    updateStatusSummary('status-summary-main', jobFilesCache);
    // If analytics is open, refresh it
    if (document.getElementById('analytics-container').style.display === 'block' && analyticsDataCache) {
       filterAnalyticsByTimeframe('all', document.getElementById('analytics-date-type')?.value || 'bd');
    }
}

function onClientsUpdate(clients) {
    clientsCache = clients;
    const clientSearchBar = document.getElementById('client-search-bar');
    const searchTerm = clientSearchBar ? clientSearchBar.value : '';
    const filteredClients = searchTerm 
        ? clientsCache.filter(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : clientsCache;
    displayClients(filteredClients);
}

// --- UI Functions ---
function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('analytics-container').style.display = 'none';
    document.getElementById('user-display-name').textContent = currentUser.displayName;
    document.getElementById('user-role').textContent = currentUser.role;

    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'none');
    
    if (currentUser.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'block');
        document.getElementById('checker-info-banner').style.display = 'block';
    } else if (currentUser.role === 'checker') {
        document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'block');
        document.getElementById('checker-info-banner').style.display = 'block';
    }
    
    clearForm();
}

function clearForm() {
    const form = document.querySelector('#main-container');
    if (!form) return;
    form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(input => input.value = '');
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    
    const dateField = document.getElementById('date');
    if (dateField) dateField.valueAsDate = new Date();
    
    const jobFileNoInput = document.getElementById('job-file-no');
    if (jobFileNoInput) jobFileNoInput.disabled = false;

    populateTable();
    calculate();
    
    if(currentUser) {
        const preparedByInput = document.getElementById('prepared-by');
        if (preparedByInput) preparedByInput.value = currentUser.displayName;
    }
    
    const createdByInfo = document.getElementById('created-by-info');
    const lastUpdatedByInfo = document.getElementById('last-updated-by-info');
    if (createdByInfo) createdByInfo.textContent = '';
    if (lastUpdatedByInfo) lastUpdatedByInfo.textContent = '';


    const approvedByInput = document.getElementById('approved-by');
    const checkedByInput = document.getElementById('checked-by');
    if(approvedByInput) approvedByInput.value = '';
    if(checkedByInput) checkedByInput.value = '';
    
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Job File';
    }
    const approveBtn = document.getElementById('approve-btn');
    if (approveBtn) approveBtn.disabled = false;
    const rejectBtn = document.getElementById('reject-btn');
    if (rejectBtn) rejectBtn.disabled = false;


    const checkedStamp = document.getElementById('checked-stamp');
    const approvedStamp = document.getElementById('approved-stamp');
    const rejectedStamp = document.getElementById('rejected-stamp');
    const rejectionBanner = document.getElementById('rejection-banner');
    if(checkedStamp) checkedStamp.style.display = 'none';
    if(approvedStamp) approvedStamp.style.display = 'none';
    if(rejectedStamp) rejectedStamp.style.display = 'none';
    if(rejectionBanner) rejectionBanner.style.display = 'none';


    if(currentUser) {
        const isChecker = ['admin', 'checker'].includes(currentUser.role);
        const isAdmin = currentUser.role === 'admin';
        const checkBtnEl = document.getElementById('check-btn');
        const approvalButtonsEl = document.getElementById('approval-buttons');
        if(checkBtnEl) checkBtnEl.style.display = isChecker ? 'block' : 'none';
        if(approvalButtonsEl) approvalButtonsEl.style.display = isAdmin ? 'flex' : 'none';
    }

    window.showNotification("Form cleared. Ready for a new job file.");
}

function populateTable() {
    const table = document.getElementById('charges-table');
    if (!table) return;
    table.innerHTML = `
        <thead>
            <tr class="bg-gray-100">
                <th class="table-cell font-semibold w-2/5">Description</th>
                <th class="table-cell font-semibold">Cost</th>
                <th class="table-cell font-semibold">Selling</th>
                <th class="table-cell font-semibold">Profit</th>
                <th class="table-cell font-semibold">Notes</th>
                 <th class="table-cell font-semibold"></th>
            </tr>
        </thead>
        <tbody id="charges-table-body">
        </tbody>
        <tfoot>
             <tr id="total-row" class="bg-gray-100 font-bold">
                <td class="table-cell text-right">TOTAL:</td>
                <td id="total-cost" class="table-cell text-right">0.000</td>
                <td id="total-selling" class="table-cell text-right">0.000</td>
                <td id="total-profit" class="table-cell text-right">0.000</td>
                <td class="table-cell" colspan="2"></td>
            </tr>
        </tfoot>
    `;

    const tableBody = document.getElementById('charges-table-body');
    tableBody.addEventListener('input', e => {
        if (e.target.classList.contains('cost-input') || e.target.classList.contains('selling-input')) {
            calculate();
        }
    });
     for(let i=0; i<5; i++) addChargeRow();
}

function addChargeRow(data = {}) {
    const tableBody = document.getElementById('charges-table-body');
    if (!tableBody) return;
    const newRow = document.createElement('tr');

    newRow.innerHTML = `
        <td class="table-cell"><input type="text" class="description-input input-field" value="${data.l || ''}" autocomplete="off"></td>
        <td class="table-cell"><input type="number" step="0.001" class="cost-input input-field" value="${data.c || ''}"></td>
        <td class="table-cell"><input type="number" step="0.001" class="selling-input input-field" value="${data.s || ''}"></td>
        <td class="table-cell profit-output bg-gray-50 text-right">${((data.s || 0) - (data.c || 0)).toFixed(3)}</td>
        <td class="table-cell"><input type="text" class="notes-input input-field" value="${data.n || ''}"></td>
        <td class="table-cell text-center"><button class="text-red-500 hover:text-red-700">&times;</button></td>
    `;
    
    const deleteButton = newRow.querySelector('button');
    deleteButton.addEventListener('click', () => {
        newRow.remove();
        calculate();
    });

    tableBody.appendChild(newRow);
}

function calculate() {
    let totalCost = 0, totalSelling = 0, totalProfit = 0;
    document.querySelectorAll('#charges-table-body tr:not(#total-row)').forEach(row => {
        const cost = parseFloat(row.querySelector('.cost-input').value) || 0;
        const selling = parseFloat(row.querySelector('.selling-input').value) || 0;
        const profit = selling - cost;
        row.cells[3].textContent = profit.toFixed(3);
        totalCost += cost; totalSelling += selling; totalProfit += profit;
    });
    const totalCostEl = document.getElementById('total-cost');
    const totalSellingEl = document.getElementById('total-selling');
    const totalProfitEl = document.getElementById('total-profit');
    if (totalCostEl) totalCostEl.textContent = totalCost.toFixed(3);
    if (totalSellingEl) totalSellingEl.textContent = totalSelling.toFixed(3);
    if (totalProfitEl) totalProfitEl.textContent = totalProfit.toFixed(3);
}

function displayJobFiles(files) {
    const list = document.getElementById('job-files-list');
    if (!list) return;
    if (files.length === 0) {
         list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files match the current filters.</p>`;
         return;
    }
    let filesHtml = '';
    files.forEach((docData) => {
        const deleteButton = currentUser.role === 'admin' ? `<button onclick="confirmDelete('${docData.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Delete</button>` : '';
        const lastUpdated = docData.updatedAt?.toDate ? docData.updatedAt.toDate().toLocaleString() : 'N/A';
        
        filesHtml += `
            <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2">
                <div class="text-center sm:text-left">
                    <p class="font-bold text-indigo-700">${docData.jfn || 'No ID'}</p>
                    <p class="text-sm text-gray-600">Shipper: ${docData.sh || 'N/A'} | Consignee: ${docData.co || 'N/A'}</p>
                    <p class="text-xs text-gray-400">Last Updated: ${lastUpdated}</p>
                </div>
                <div class="space-x-2 flex-shrink-0">
                    <button onclick="previewJobFileById('${docData.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">Preview</button>
                    <button onclick="loadJobFileById('${docData.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-sm">Load</button>
                    ${deleteButton}
                </div>
            </div>
        `;
    });
    list.innerHTML = filesHtml;
}

function updateStatusSummary(targetId, dataSource) {
    const summaryEl = document.getElementById(targetId);
    if (!summaryEl) return;
    const approvedCount = dataSource.filter(file => file.status === 'approved').length;
    const rejectedCount = dataSource.filter(file => file.status === 'rejected').length;
    const checkedCount = dataSource.filter(file => file.status === 'checked').length;
    const pendingCount = dataSource.filter(file => file.status === 'pending' || !file.status).length;

    summaryEl.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div onclick="showStatusJobs('approved')" class="bg-green-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-green-800">Approved</p><p class="text-2xl font-bold text-green-900">${approvedCount}</p></div>
            <div onclick="showStatusJobs('rejected')" class="bg-red-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-red-800">Rejected</p><p class="text-2xl font-bold text-red-900">${rejectedCount}</p></div>
            <div onclick="showStatusJobs('checked')" class="bg-blue-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-blue-800">Checked</p><p class="text-2xl font-bold text-blue-900">${checkedCount}</p></div>
            <div onclick="showStatusJobs('pending')" class="bg-yellow-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-yellow-800">Pending</p><p class="text-2xl font-bold text-yellow-900">${pendingCount}</p></div>
        </div>
    `;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAppAndAuth();
    
    let isLogin = true;

    document.getElementById('auth-link').addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        window.toggleAuthView(isLogin);
    });

    document.getElementById('auth-btn').addEventListener('click', () => {
        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;
        if (isLogin) {
            handleLogin(email, password);
        } else {
            const displayName = document.getElementById('full-name').value;
             if (!email || !password || !displayName) {
                 window.showNotification("Please fill all fields to sign up.", true);
                 return;
            }
            handleSignUp(email, password, displayName);
        }
    });

    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        window.openModal('forgot-password-modal');
    });
    document.getElementById('send-reset-link-btn').addEventListener('click', handleForgotPassword);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    populateTable();
    calculate();
    const dateField = document.getElementById('date');
    if(dateField) dateField.valueAsDate = new Date();
});


// Make functions globally available for inline onclick handlers from HTML
// This is the bridge that fixes the broken functionality.
window.openAnalyticsDashboard = () => {}; // Placeholder
window.closeAnalyticsDashboard = () => {}; // Placeholder
window.openFileManager = () => window.openModal('file-manager-modal');
window.openClientManager = () => {}; // Placeholder
window.saveJobFile = () => {}; // Placeholder
window.clearForm = clearForm;
window.printPage = () => {}; // Placeholder
window.saveUserChanges = () => {}; // Placeholder
window.sortAnalyticsTable = () => {}; // Placeholder
window.downloadAnalyticsCsv = () => {}; // Placeholder
window.previewJobFileById = () => {}; // Placeholder
window.loadJobFileById = () => {}; // Placeholder
window.confirmDelete = () => {}; // Placeholder
window.editClient = () => {}; // Placeholder
window.printAnalytics = () => {}; // Placeholder
window.printPreview = () => {}; // Placeholder
window.generateRemarks = () => {}; // Placeholder
window.suggestCharges = () => {}; // Placeholder
window.backupAllData = () => {}; // Placeholder
window.handleRestoreFile = () => {}; // Placeholder
window.showUserJobs = () => {}; // Placeholder
window.showMonthlyJobs = () => {}; // Placeholder
window.showSalesmanJobs = () => {}; // Placeholder
window.showStatusJobs = () => {}; // Placeholder
window.checkJobFile = () => {}; // Placeholder
window.approveJobFile = () => {}; // Placeholder
window.uncheckJobFile = () => {}; // Placeholder
window.openRecycleBin = () => {}; // Placeholder
window.restoreJobFile = () => {}; // Placeholder
window.confirmPermanentDelete = () => {}; // Placeholder
window.filterAnalyticsByTimeframe = () => {}; // Placeholder
window.promptForRejection = () => {}; // Placeholder
window.displayAnalytics = () => {}; // Placeholder
window.openChargeManager = () => {}; // Placeholder
window.saveChargeDescription = () => {}; // Placeholder
window.deleteChargeDescription = () => {}; // Placeholder
window.addChargeRow = addChargeRow;

    