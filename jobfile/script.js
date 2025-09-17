import { initializeAppAndAuth, handleLogin, handleSignUp, handleForgotPassword } from './auth.js';

// --- Global variables ---
let currentUser = null;
let jobFilesCache = [];
let clientsCache = [];
let chargeDescriptions = [];
let analyticsDataCache = null;
let currentFilteredJobs = [];
let fileIdToReject = null; 
let profitChartInstance = null;
let db; // Will be initialized onLoginSuccess

// This function is called by auth.js when the user logs in successfully
export function onLoginSuccess(user, firestoreDb) {
    currentUser = user;
    db = firestoreDb; // Initialize db
    
    showApp();
    
    // Placeholder for data loading functions which will be moved here
    // loadJobFiles(); 
    // loadClients();
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
    
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('job-file-no').disabled = false;
    populateTable();
    calculate();
    
    if(currentUser) {
        document.getElementById('prepared-by').value = currentUser.displayName;
    }
    
    document.getElementById('created-by-info').textContent = '';
    document.getElementById('last-updated-by-info').textContent = '';

    document.getElementById('approved-by').value = '';
    document.getElementById('checked-by').value = '';
    
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Job File';
    }
    const approveBtn = document.getElementById('approve-btn');
    if (approveBtn) approveBtn.disabled = false;
    const rejectBtn = document.getElementById('reject-btn');
    if (rejectBtn) rejectBtn.disabled = false;


    document.getElementById('checked-stamp').style.display = 'none';
    document.getElementById('approved-stamp').style.display = 'none';
    document.getElementById('rejected-stamp').style.display = 'none';
    document.getElementById('rejection-banner').style.display = 'none';

    if(currentUser) {
        const isChecker = ['admin', 'checker'].includes(currentUser.role);
        const isAdmin = currentUser.role === 'admin';
        document.getElementById('check-btn').style.display = isChecker ? 'block' : 'none';
        document.getElementById('approval-buttons').style.display = isAdmin ? 'flex' : 'none';
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
    document.getElementById('total-cost').textContent = totalCost.toFixed(3);
    document.getElementById('total-selling').textContent = totalSelling.toFixed(3);
    document.getElementById('total-profit').textContent = totalProfit.toFixed(3);
}

// --- App Initialization ---
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
    if (logoutBtn) logoutBtn.addEventListener('click', window.handleLogout);

    // Placeholder for other event listeners that will be moved here
    
    populateTable();
    calculate();
    const dateField = document.getElementById('date');
    if(dateField) dateField.valueAsDate = new Date();
});


// Make functions globally available for inline onclick handlers from HTML
// This is a bridge until all event listeners are programmatically added.
// window.openAnalyticsDashboard = openAnalyticsDashboard;
// window.closeAnalyticsDashboard = closeAnalyticsDashboard;
window.openFileManager = () => window.openModal('file-manager-modal');
// window.openClientManager = openClientManager;
// window.saveJobFile = saveJobFile;
window.clearForm = clearForm;
// window.printPage = printPage;
// window.saveUserChanges = saveUserChanges;
// window.sortAnalyticsTable = sortAnalyticsTable;
// window.downloadAnalyticsCsv = downloadAnalyticsCsv;
// window.previewJobFileById = previewJobFileById;
// window.loadJobFileById = loadJobFileById;
// window.confirmDelete = confirmDelete;
// window.editClient = editClient;
// window.printAnalytics = printAnalytics;
// window.printPreview = printPreview;
// window.generateRemarks = generateRemarks;
// window.suggestCharges = suggestCharges;
// window.backupAllData = backupAllData;
// window.handleRestoreFile = handleRestoreFile;
// window.showUserJobs = showUserJobs;
// window.showMonthlyJobs = showMonthlyJobs;
// window.showSalesmanJobs = showSalesmanJobs;
// window.showStatusJobs = showStatusJobs;
// window.checkJobFile = checkJobFile;
// window.approveJobFile = approveJobFile;
// window.uncheckJobFile = uncheckJobFile;
// window.openRecycleBin = openRecycleBin;
// window.restoreJobFile = restoreJobFile;
// window.confirmPermanentDelete = confirmPermanentDelete;
// window.filterAnalyticsByTimeframe = filterAnalyticsByTimeframe;
// window.promptForRejection = promptForRejection;
// window.displayAnalytics = displayAnalytics;
// window.openChargeManager = openChargeManager;
// window.saveChargeDescription = saveChargeDescription;
// window.deleteChargeDescription = deleteChargeDescription;
window.addChargeRow = addChargeRow;</description>
    <content><![CDATA[import { initializeAppAndAuth, handleLogin, handleSignUp, handleForgotPassword } from './auth.js';

// --- Global variables ---
let currentUser = null;
let jobFilesCache = [];
let clientsCache = [];
let chargeDescriptions = [];
let analyticsDataCache = null;
let currentFilteredJobs = [];
let fileIdToReject = null; 
let profitChartInstance = null;
let db; // Will be initialized onLoginSuccess

// This function is called by auth.js when the user logs in successfully
export function onLoginSuccess(user, firestoreDb) {
    currentUser = user;
    db = firestoreDb; // Initialize db
    
    showApp();
    
    // Placeholder for data loading functions which will be moved here
    // loadJobFiles(); 
    // loadClients();
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
    
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('job-file-no').disabled = false;
    populateTable();
    calculate();
    
    if(currentUser) {
        document.getElementById('prepared-by').value = currentUser.displayName;
    }
    
    document.getElementById('created-by-info').textContent = '';
    document.getElementById('last-updated-by-info').textContent = '';

    document.getElementById('approved-by').value = '';
    document.getElementById('checked-by').value = '';
    
    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Job File';
    }
    const approveBtn = document.getElementById('approve-btn');
    if (approveBtn) approveBtn.disabled = false;
    const rejectBtn = document.getElementById('reject-btn');
    if (rejectBtn) rejectBtn.disabled = false;


    document.getElementById('checked-stamp').style.display = 'none';
    document.getElementById('approved-stamp').style.display = 'none';
    document.getElementById('rejected-stamp').style.display = 'none';
    document.getElementById('rejection-banner').style.display = 'none';

    if(currentUser) {
        const isChecker = ['admin', 'checker'].includes(currentUser.role);
        const isAdmin = currentUser.role === 'admin';
        document.getElementById('check-btn').style.display = isChecker ? 'block' : 'none';
        document.getElementById('approval-buttons').style.display = isAdmin ? 'flex' : 'none';
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
    document.getElementById('total-cost').textContent = totalCost.toFixed(3);
    document.getElementById('total-selling').textContent = totalSelling.toFixed(3);
    document.getElementById('total-profit').textContent = totalProfit.toFixed(3);
}

// --- App Initialization ---
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
    if (logoutBtn) logoutBtn.addEventListener('click', window.handleLogout);

    // Placeholder for other event listeners that will be moved here
    
    populateTable();
    calculate();
    const dateField = document.getElementById('date');
    if(dateField) dateField.valueAsDate = new Date();
});


// Make functions globally available for inline onclick handlers from HTML
// This is a bridge until all event listeners are programmatically added.
// window.openAnalyticsDashboard = openAnalyticsDashboard;
// window.closeAnalyticsDashboard = closeAnalyticsDashboard;
window.openFileManager = () => window.openModal('file-manager-modal');
// window.openClientManager = openClientManager;
// window.saveJobFile = saveJobFile;
window.clearForm = clearForm;
// window.printPage = printPage;
// window.saveUserChanges = saveUserChanges;
// window.sortAnalyticsTable = sortAnalyticsTable;
// window.downloadAnalyticsCsv = downloadAnalyticsCsv;
// window.previewJobFileById = previewJobFileById;
// window.loadJobFileById = loadJobFileById;
// window.confirmDelete = confirmDelete;
// window.editClient = editClient;
// window.printAnalytics = printAnalytics;
// window.printPreview = printPreview;
// window.generateRemarks = generateRemarks;
// window.suggestCharges = suggestCharges;
// window.backupAllData = backupAllData;
// window.handleRestoreFile = handleRestoreFile;
// window.showUserJobs = showUserJobs;
// window.showMonthlyJobs = showMonthlyJobs;
// window.showSalesmanJobs = showSalesmanJobs;
// window.showStatusJobs = showStatusJobs;
// window.checkJobFile = checkJobFile;
// window.approveJobFile = approveJobFile;
// window.uncheckJobFile = uncheckJobFile;
// window.openRecycleBin = openRecycleBin;
// window.restoreJobFile = restoreJobFile;
// window.confirmPermanentDelete = confirmPermanentDelete;
// window.filterAnalyticsByTimeframe = filterAnalyticsByTimeframe;
// window.promptForRejection = promptForRejection;
// window.displayAnalytics = displayAnalytics;
// window.openChargeManager = openChargeManager;
// window.saveChargeDescription = saveChargeDescription;
// window.deleteChargeDescription = deleteChargeDescription;
window.addChargeRow = addChargeRow;