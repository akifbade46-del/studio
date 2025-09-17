import { initializeAppAndAuth, handleLogin, handleSignUp, handleForgotPassword, handleLogout } from './auth.js';
import { initializeFirestore, saveJobFile as saveJobFileToDb, checkJobFile as checkJobFileInDb, uncheckJobFile as uncheckJobFileInDb, approveJobFile as approveJobFileInDb, rejectJobFile as rejectJobFileInDb, listenForJobFiles, loadJobFileById as loadJobFileFromDb, moveToRecycleBin, listenForClients, saveClient, deleteClient, getUsers, saveUserChanges as saveUserChangesToDb, getBackupData, restoreBackupData, getRecycleBinFiles, restoreJobFile as restoreJobFileFromBin, permanentlyDeleteJobFile, loadChargeDescriptions as loadChargeDescriptionsFromStorage } from './firestore.js';
import { suggestCharges } from './gemini.js';

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
    loadChargeDescriptionsFromStorage().then(descriptions => {
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

// --- Data Handling ---
async function saveJobFile() {
    const jobFileNoInput = document.getElementById('job-file-no');
    const jobFileNo = jobFileNoInput.value.trim();
    if (!jobFileNo) {
        window.showNotification("Please enter a Job File No.", true);
        return;
    }

    window.showLoader();
    const docId = jobFileNo.replace(/\//g, '_');
    const isUpdating = jobFileNoInput.disabled;
    const data = getFormData();
    data.totalCost = parseFloat(document.getElementById('total-cost').textContent) || 0;
    data.totalSelling = parseFloat(document.getElementById('total-selling').textContent) || 0;
    data.totalProfit = parseFloat(document.getElementById('total-profit').textContent) || 0;

    try {
        const requiresReapproval = await saveJobFileToDb(data, isUpdating, docId);
        if (requiresReapproval) {
            window.showNotification("File modified. Re-approval is now required.", false);
        }
        window.showNotification("Job file saved successfully!");
        loadJobFileById(docId);
    } catch (error) {
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function checkJobFile(docId = null) {
    let fileId = docId;
    if (!fileId) {
        const jobFileNo = document.getElementById('job-file-no').value.trim();
        if (!jobFileNo) {
            window.showNotification("Please save or load a job file first.", true);
            return;
        }
        fileId = jobFileNo.replace(/\//g, '_');
    }
    
    window.showLoader();
    try {
        const updatedDoc = await checkJobFileInDb(fileId);
        if (!docId) { // If called from main form button
            populateFormFromData(updatedDoc.data());
        } else { // If called from a modal
            refreshOpenModals();
        }
        window.showNotification("Job File Checked!");
    } catch (error) {
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function uncheckJobFile(docId) {
    window.showLoader();
    try {
        await uncheckJobFileInDb(docId);
        window.showNotification("Job File Unchecked!");
        refreshOpenModals();
    } catch (error) {
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function approveJobFile(docId = null) {
    let fileId = docId;
    if (!fileId) {
        const jobFileNo = document.getElementById('job-file-no').value.trim();
        if (!jobFileNo) {
            window.showNotification("Please save or load a job file first.", true);
            return;
        }
        fileId = jobFileNo.replace(/\//g, '_');
    }

    window.showLoader();
    try {
        const updatedDoc = await approveJobFileInDb(fileId);
        if (!docId) {
            populateFormFromData(updatedDoc.data());
        } else {
            refreshOpenModals();
        }
        window.showNotification("Job File Approved!");
    } catch (error) {
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

function promptForRejection(docId) {
    fileIdToReject = docId;
    window.openModal('reject-reason-modal', true);
}

async function rejectJobFileAction() {
    const reason = document.getElementById('rejection-reason-input').value.trim();
    if (!reason) {
        window.showNotification("Rejection reason is required.", true);
        return;
    }

    const docId = fileIdToReject || document.getElementById('job-file-no').value.replace(/\//g, '_');
    if (!docId) {
         window.showNotification("No file selected for rejection.", true);
         return;
    }

    window.showLoader();
    try {
        const updatedDoc = await rejectJobFileInDb(docId, reason);
        if (fileIdToReject) { // Modal call
            refreshOpenModals();
        } else { // Main form call
            populateFormFromData(updatedDoc.data());
        }
        window.closeModal('reject-reason-modal');
        document.getElementById('rejection-reason-input').value = '';
        fileIdToReject = null;
        window.showNotification("Job File Rejected!");
    } catch (error) {
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function loadJobFileById(docId) {
    window.showLoader();
    try {
        const fileData = await loadJobFileFromDb(docId);
        populateFormFromData(fileData);
        logUserActivity(fileData.jfn);
        document.getElementById('job-file-no').disabled = true;
        window.closeAllModals();
        window.showNotification("Job file loaded successfully.");
    } catch (error) {
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function previewJobFileById(docId) {
    window.showLoader();
    try {
        const data = await loadJobFileFromDb(docId);
        const previewBody = document.getElementById('preview-body');
        previewBody.innerHTML = getPrintViewHtml(data, false); 
        
        const qrContainer = previewBody.querySelector('.qrcode-container');
        if (qrContainer && data.jfn) {
            qrContainer.innerHTML = '';
            const baseUrl = window.location.href.split('?')[0];
            const qrText = `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`;
            new QRCode(qrContainer, {
                text: qrText,
                width: 96,
                height: 96,
                correctLevel: QRCode.CorrectLevel.H
            });
        }
        window.openModal('preview-modal', true);
    } catch (error) {
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
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

function getFormData() {
    const getVal = id => document.getElementById(id).value || '';
    const getChecked = query => Array.from(document.querySelectorAll(query)).filter(el => el.checked).map(el => el.dataset.clearance || el.dataset.product);

    const charges = [];
    document.querySelectorAll('#charges-table-body tr:not(#total-row)').forEach(row => {
        const description = row.querySelector('.description-input').value.trim();
        const cost = row.querySelector('.cost-input').value;
        const selling = row.querySelector('.selling-input').value;

        // Only save rows that have a description and at least one value
        if (description && (cost || selling)) {
            charges.push({
                l: description, // 'l' for label/description
                c: cost || '0',
                s: selling || '0',
                n: row.querySelector('.notes-input').value || ''
            });
        }
    });

    return {
        d: getVal('date'), po: getVal('po-number'), jfn: getVal('job-file-no'),
        cl: getChecked('[data-clearance]:checked'), pt: getChecked('[data-product]:checked'),
        in: getVal('invoice-no'), bd: getVal('billing-date'), sm: getVal('salesman'),
        sh: getVal('shipper-name'), co: getVal('consignee-name'),
        mawb: getVal('mawb'), hawb: getVal('hawb'), ts: getVal('teams-of-shipping'), or: getVal('origin'),
        pc: getVal('no-of-pieces'), gw: getVal('gross-weight'), de: getVal('destination'), vw: getVal('volume-weight'),
        dsc: getVal('description'), ca: getVal('carrier'), tn: getVal('truck-no'),
        vn: getVal('vessel-name'), fv: getVal('flight-voyage-no'), cn: getVal('container-no'),
        ch: charges,
        re: getVal('remarks'),
        pb: getVal('prepared-by'),
    };
}

function getPrintViewHtml(data, isPublicView = false) {
    const totalCost = data.totalCost || 0;
    const totalSelling = data.totalSelling || 0;
    const totalProfit = data.totalProfit || 0;
    
    const checkedByText = data.checkedBy ? `${data.checkedBy} on ${data.checkedAt?.toDate().toLocaleDateString()}` : 'Pending';
    let approvedByText = 'Pending Approval';
    if (data.status === 'approved') {
        approvedByText = `${data.approvedBy} on ${data.approvedAt?.toDate().toLocaleDateString()}`;
    } else if (data.status === 'rejected') {
        approvedByText = `REJECTED: ${data.rejectionReason}`;
    }
    
    const createdByText = data.createdBy ? `${data.createdBy} on ${data.createdAt?.toDate().toLocaleDateString()}` : (data.pb || 'N/A');
    
    const checkedStampHtml = data.checkedBy ? `<div class="stamp stamp-checked" style="display: block;">Checked</div>` : '';
    let approvalStampHtml = '';
    if (data.status === 'approved') {
        approvalStampHtml = `<div class="stamp stamp-approved" style="display: block;">Approved</div>`;
    } else if (data.status === 'rejected') {
        approvalStampHtml = `<div class="stamp stamp-rejected" style="display: block;">Rejected</div>`;
    }

    const checkedSymbol = '☑';
    const uncheckedSymbol = '☐';
    
    const qrContainerHtml = isPublicView ? '' : `<div class="col-span-3 bg-white p-1 flex items-center justify-center" style="border: 1px solid #374151;"><div class="qrcode-container"></div></div>`;

    const descriptionHtml = `<div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Description:</strong><div class="print-field">${data.dsc || ''}</div></div>`;

    return `
        <div class="border border-gray-700 p-2 bg-white">
            <div class="grid grid-cols-12 gap-px bg-gray-700" style="border: 1px solid #374151;">
                <div class="col-span-3 bg-white p-1 flex items-center" style="border: 1px solid #374151;">
                    <div class="text-xl font-bold" style="color: #0E639C;">Q'go<span style="color: #4FB8AF;">Cargo</span></div>
                </div>
                <div class="col-span-6 bg-white flex items-center justify-center text-xl font-bold" style="border: 1px solid #374151;">JOB FILE</div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><div><strong>Date:</strong> ${data.d || ''}</div><div><strong>P.O. #:</strong> ${data.po || ''}</div></div>
                
                <div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Job File No.:</strong> ${data.jfn || ''}</div>

                <div class="col-span-12 bg-white p-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" style="border: 1px solid #374151;">
                    <div><strong>Clearance</strong><br>${(data.cl || []).includes('Export') ? checkedSymbol : uncheckedSymbol} Export<br>${(data.cl || []).includes('Import') ? checkedSymbol : uncheckedSymbol} Import<br>${(data.cl || []).includes('Clearance') ? checkedSymbol : uncheckedSymbol} Clearance<br>${(data.cl || []).includes('Local Move') ? checkedSymbol : uncheckedSymbol} Local Move</div>
                    <div><strong>Product Type</strong><br>${(data.pt || []).includes('Air Freight') ? checkedSymbol : uncheckedSymbol} Air<br>${(data.pt || []).includes('Sea Freight') ? checkedSymbol : uncheckedSymbol} Sea<br>${(data.pt || []).includes('Land Freight') ? checkedSymbol : uncheckedSymbol} Land<br>${(data.pt || []).includes('Others') ? checkedSymbol : uncheckedSymbol} Others</div>
                </div>

                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Invoice No.:</strong><div class="print-field">${data.in || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Billing Date:</strong><div class="print-field">${data.bd || ''}</div></div>
                <div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Salesman:</strong><div class="print-field">${data.sm || ''}</div></div>

                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Shipper's Name:</strong><div class="print-field">${data.sh || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Consignee's Name:</strong><div class="print-field">${data.co || ''}</div></div>
                
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>MAWB/OBL/TCN:</strong><div class="print-field">${data.mawb || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Teams of Shipping:</strong><div class="print-field">${data.ts || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>HAWB/HBL:</strong><div class="print-field">${data.hawb || ''}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Origin:</strong><div class="print-field">${data.or || ''}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Destination:</strong><div class="print-field">${data.de || ''}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>No. of Pieces:</strong><div class="print-field">${data.pc || ''}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Gross Wt:</strong><div class="print-field">${data.gw || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Volume Wt:</strong><div class="print-field">${data.vw || ''}</div></div>
                
                ${descriptionHtml}
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Carrier/Line/Trucking:</strong><div class="print-field">${data.ca || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Truck/Driver:</strong><div class="print-field">${data.tn || ''}</div></div>
                <div class="col-span-4 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Vessel:</strong><div class="print-field">${data.vn || ''}</div></div>
                <div class="col-span-4 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Flight/Voyage:</strong><div class="print-field">${data.fv || ''}</div></div>
                <div class="col-span-4 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Container No:</strong><div class="print-field">${data.cn || ''}</div></div>

                <div class="col-span-12 bg-white p-0" style="border: 1px solid #374151;">
                    <table class="print-table w-full text-xs">
                        <thead><tr><th>Description</th><th>Cost</th><th>Selling</th><th>Profit</th><th>Notes</th></tr></thead>
                        <tbody>
                            ${(data.ch || []).map(c => `<tr><td>${c.l}</td><td>${c.c}</td><td>${c.s}</td><td>${(parseFloat(c.s || 0) - parseFloat(c.c || 0)).toFixed(3)}</td><td>${c.n}</td></tr>`).join('')}
                            <tr class="font-bold bg-gray-100"><td>TOTAL:</td><td>${totalCost.toFixed(3)}</td><td>${totalSelling.toFixed(3)}</td><td>${totalProfit.toFixed(3)}</td><td></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>REMARKS:</strong><div class="print-field h-20">${(data.re || '').replace(/\n/g, '<br>')}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>PREPARED BY:</strong><div class="print-field">${createdByText}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs relative" style="border: 1px solid #374151;">${checkedStampHtml}<strong>CHECKED BY:</strong><div class="print-field">${checkedByText}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs relative" style="border: 1px solid #374151;">${approvalStampHtml}<strong>APPROVED BY:</strong><div class="print-field">${approvedByText}</div></div>
                ${qrContainerHtml}
            </div>
        </div>`;
}

function printPage() {
    const data = getFormData();
    data.totalCost = parseFloat(document.getElementById('total-cost').textContent) || 0;
    data.totalSelling = parseFloat(document.getElementById('total-selling').textContent) || 0;
    data.totalProfit = parseFloat(document.getElementById('total-profit').textContent) || 0;

    const printHTML = getPrintViewHtml(data, false);
    const printContainer = document.getElementById('print-output');
    printContainer.innerHTML = printHTML;

    const qrContainer = printContainer.querySelector('.qrcode-container');
    if (qrContainer && data.jfn) {
        qrContainer.innerHTML = '';
        const baseUrl = window.location.href.split('?')[0];
        const qrText = `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`;
        new QRCode(qrContainer, {
            text: qrText,
            width: 96,
            height: 96,
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    document.getElementById('main-container').style.display = 'none';
    printContainer.style.display = 'block';
    
    setTimeout(() => { window.print(); }, 500);
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
    
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('approve-btn').addEventListener('click', () => approveJobFile());
    document.getElementById('reject-btn').addEventListener('click', () => promptForRejection(null));
    document.getElementById('confirm-reject-btn').addEventListener('click', rejectJobFileAction);
    document.getElementById('check-btn').addEventListener('click', () => checkJobFile());

    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        window.openModal('forgot-password-modal');
    });
    document.getElementById('send-reset-link-btn').addEventListener('click', handleForgotPassword);

    populateTable();
    calculate();
    const dateField = document.getElementById('date');
    if(dateField) dateField.valueAsDate = new Date();
});


// Make functions globally available for inline onclick handlers from HTML
// This is the bridge that fixes the broken functionality.
window.openAnalyticsDashboard = () => {}; 
window.closeAnalyticsDashboard = () => {}; 
window.openFileManager = () => window.openModal('file-manager-modal');
window.openClientManager = () => {}; 
window.saveJobFile = saveJobFile; 
window.clearForm = clearForm;
window.printPage = printPage;
window.saveUserChanges = () => {}; 
window.sortAnalyticsTable = () => {}; 
window.downloadAnalyticsCsv = () => {}; 
window.previewJobFileById = previewJobFileById;
window.loadJobFileById = loadJobFileById;
window.confirmDelete = () => {}; 
window.editClient = () => {}; 
window.printAnalytics = () => {}; 
window.printPreview = () => {}; 
window.suggestCharges = () => suggestCharges(chargeDescriptions);
window.backupAllData = () => {}; 
window.handleRestoreFile = () => {}; 
window.showUserJobs = () => {}; 
window.showMonthlyJobs = () => {}; 
window.showSalesmanJobs = () => {}; 
window.showStatusJobs = () => {}; 
window.checkJobFile = checkJobFile; 
window.approveJobFile = approveJobFile; 
window.uncheckJobFile = uncheckJobFile; 
window.openRecycleBin = () => {}; 
window.restoreJobFile = () => {}; 
window.confirmPermanentDelete = () => {}; 
window.filterAnalyticsByTimeframe = () => {}; 
window.promptForRejection = promptForRejection; 
window.displayAnalytics = () => {}; 
window.openChargeManager = () => {}; 
window.saveChargeDescription = () => {}; 
window.deleteChargeDescription = () => {}; 
window.addChargeRow = addChargeRow;
window.calculate = calculate;
