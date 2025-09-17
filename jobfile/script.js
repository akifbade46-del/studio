import { initializeAppAndAuth, handleLogin, handleSignUp, handleForgotPassword, handleLogout } from './auth.js';
import { initializeFirestore, saveJobFile as saveJobFileToDb, checkJobFile as checkJobFileInDb, uncheckJobFile as uncheckJobFileInDb, approveJobFile as approveJobFileInDb, rejectJobFile as rejectJobFileInDb, listenForJobFiles, loadJobFileById as loadJobFileFromDb, moveToRecycleBin, listenForClients, saveClient as saveClientToDb, deleteClient as deleteClientFromDb, getUsers, saveUserChanges as saveUserChangesToDb, getBackupData, restoreBackupData, getRecycleBinFiles, restoreJobFile as restoreJobFileFromBin, permanentlyDeleteJobFile as permanentlyDeleteFromBin, loadChargeDescriptions as loadChargeDescriptionsFromStorage } from './firestore.js';
import { suggestCharges as suggestChargesFromGemini } from './gemini.js';

// --- Global variables ---
let db;
let currentUser = null;
let jobFilesCache = [];
let clientsCache = [];
let chargeDescriptions = [];
let analyticsDataCache = null;
let currentFilteredJobs = [];
let fileIdToReject = null; 
let profitChartInstance = null;

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
    const sortedDocs = [...jobFilesCache].sort((a,b) => (b.updatedAt?.toDate() ? b.updatedAt.toDate().getTime() : 0) - (a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0));
    
    // Apply filters before displaying if file manager is open
    const fileManager = document.getElementById('file-manager-modal');
    if (fileManager && fileManager.classList.contains('visible')) {
        applyFiltersAndDisplay();
    } else {
        displayJobFiles(sortedDocs);
    }
    
    updateStatusSummary('status-summary-main', jobFilesCache);

    // If analytics is open, refresh it
    const analyticsContainer = document.getElementById('analytics-container');
    if (analyticsContainer && analyticsContainer.style.display === 'block') {
       const activeTimeframeButton = document.querySelector('.timeframe-btn.bg-indigo-700') || document.querySelector('[data-timeframe="all"]');
       const dateType = document.getElementById('analytics-date-type')?.value || 'bd';
       filterAnalyticsByTimeframe(activeTimeframeButton.dataset.timeframe, dateType);
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

// --- Data Handling (Connecting UI to Firestore) ---
async function saveJobFile() {
    const jobFileNoInput = document.getElementById('job-file-no');
    const jobFileNo = jobFileNoInput.value.trim();
    if (!jobFileNo) {
        showNotification("Please enter a Job File No.", true);
        return;
    }

    showLoader();
    const docId = jobFileNo.replace(/\//g, '_');
    const isUpdating = jobFileNoInput.disabled;
    const data = getFormData();

    try {
        const requiresReapproval = await saveJobFileToDb(data, isUpdating, docId);
        if (requiresReapproval) {
            showNotification("File modified. Re-approval is now required.", false);
        }
        showNotification("Job file saved successfully!");
        loadJobFileById(docId); // Reload to show the latest saved state
    } catch (error) {
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

async function checkJobFile(docId = null) {
    let fileId = docId;
    if (!fileId) {
        const jobFileNo = document.getElementById('job-file-no').value.trim();
        if (!jobFileNo) {
            showNotification("Please save or load a job file first.", true);
            return;
        }
        fileId = jobFileNo.replace(/\//g, '_');
    }
    
    showLoader();
    try {
        const updatedDoc = await checkJobFileInDb(fileId);
        if (!docId) {
            populateFormFromData(updatedDoc.data());
        } else {
            refreshOpenModals();
        }
        showNotification("Job File Checked!");
    } catch (error) {
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

async function uncheckJobFile(docId) {
    showLoader();
    try {
        await uncheckJobFileInDb(docId);
        showNotification("Job File Unchecked!");
        refreshOpenModals();
    } catch (error) {
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

async function approveJobFile(docId = null) {
    let fileId = docId;
    if (!fileId) {
        const jobFileNo = document.getElementById('job-file-no').value.trim();
        if (!jobFileNo) {
            showNotification("Please save or load a job file first.", true);
            return;
        }
        fileId = jobFileNo.replace(/\//g, '_');
    }

    showLoader();
    try {
        const updatedDoc = await approveJobFileInDb(fileId);
        if (!docId) {
            populateFormFromData(updatedDoc.data());
        } else {
            refreshOpenModals();
        }
        showNotification("Job File Approved!");
    } catch (error) {
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

function promptForRejection(docId) {
    fileIdToReject = docId;
    openModal('reject-reason-modal', true);
}

async function rejectJobFileAction() {
    const reason = document.getElementById('rejection-reason-input').value.trim();
    if (!reason) {
        showNotification("Rejection reason is required.", true);
        return;
    }

    const docId = fileIdToReject || document.getElementById('job-file-no').value.replace(/\//g, '_');
    if (!docId) {
         showNotification("No file selected for rejection.", true);
         return;
    }

    showLoader();
    try {
        const updatedDoc = await rejectJobFileInDb(docId, reason);
        if (fileIdToReject) {
            refreshOpenModals();
        } else {
            populateFormFromData(updatedDoc.data());
        }
        
        closeModal('reject-reason-modal');
        document.getElementById('rejection-reason-input').value = '';
        fileIdToReject = null;
        showNotification("Job File Rejected!");
    } catch (error) {
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

async function loadJobFileById(docId) {
    showLoader();
    try {
        const fileData = await loadJobFileFromDb(docId);
        populateFormFromData(fileData);
        logUserActivity(fileData.jfn);
        document.getElementById('job-file-no').disabled = true;
        closeAllModals();
        showNotification("Job file loaded successfully.");
    } catch (error) {
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

async function previewJobFileById(docId) {
    showLoader();
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
        openModal('preview-modal', true);
    } catch (error) {
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

function confirmDelete(docId, type = 'jobfile') {
    if (currentUser.role !== 'admin') {
        showNotification("Only admins can delete items.", true);
        return;
    }
    const modal = document.getElementById('confirm-modal');
    let message = '';
    let onOk;

    if (type === 'jobfile') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Job File Deletion';
        message = `Are you sure you want to move job file "${docId.replace(/_/g, '/')}" to the recycle bin?`;
        onOk = () => moveToRecycleBin(docId).then(() => showNotification("Job file moved to recycle bin.")).catch(err => showNotification(err.message, true));
    } else if (type === 'client') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Client Deletion';
        const client = clientsCache.find(c => c.id === docId);
        message = `Are you sure you want to delete the client "${client?.name || 'this client'}"? This action cannot be undone.`;
        onOk = () => deleteClientFromDb(docId).then(() => showNotification("Client deleted.")).catch(err => showNotification(err.message, true));
    }

    modal.querySelector('#confirm-message').innerHTML = message;
    modal.querySelector('#confirm-ok').className = 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded';
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const newOkButton = okButton.cloneNode(true);
    okButton.parentNode.replaceChild(newOkButton, okButton);
    
    newOkButton.addEventListener('click', () => {
        onOk();
        closeModal('confirm-modal');
    }, { once: true });
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
    const form = document.getElementById('main-container');
    form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(input => input.value = '');
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('job-file-no').disabled = false;
    populateTable();
    calculate();
    
    if (currentUser) {
        document.getElementById('prepared-by').value = currentUser.displayName;
    }
    
    document.getElementById('created-by-info').textContent = '';
    document.getElementById('last-updated-by-info').textContent = '';

    document.getElementById('approved-by').value = '';
    document.getElementById('checked-by').value = '';
    const checkBtn = document.getElementById('check-btn');
    checkBtn.disabled = false;
    checkBtn.textContent = 'Check Job File';

    document.getElementById('checked-stamp').style.display = 'none';
    document.getElementById('approved-stamp').style.display = 'none';
    document.getElementById('rejected-stamp').style.display = 'none';
    document.getElementById('rejection-banner').style.display = 'none';

    if (currentUser) {
        const isChecker = ['admin', 'checker'].includes(currentUser.role);
        const isAdmin = currentUser.role === 'admin';
        document.getElementById('check-btn').style.display = isChecker ? 'block' : 'none';
        document.getElementById('approval-buttons').style.display = isAdmin ? 'flex' : 'none';
    }

    showNotification("Form cleared. Ready for a new job file.");
}

function logUserActivity(jobFileNo) {
    if (!currentUser) return;
    const logEntry = { user: currentUser.displayName, file: jobFileNo, timestamp: new Date().toISOString() };
    let logs = [];
    try {
        const storedLogs = localStorage.getItem('userActivityLog');
        if (storedLogs) logs = JSON.parse(storedLogs);
    } catch (e) {
        logs = [];
    }
    logs.unshift(logEntry);
    if (logs.length > 200) logs.splice(200);
    localStorage.setItem('userActivityLog', JSON.stringify(logs));
}

function openUserActivityLog() {
    const logBody = document.getElementById('activity-log-body');
    let logs = [];
    try {
        const storedLogs = localStorage.getItem('userActivityLog');
        if (storedLogs) logs = JSON.parse(storedLogs);
    } catch (e) {
        logs = [];
    }

    if (logs.length === 0) {
        logBody.innerHTML = '<tr><td colspan="3" class="table-cell text-center p-4">No user activity recorded yet.</td></tr>';
    } else {
        logBody.innerHTML = logs.map(entry => `
            <tr class="border-b">
                <td class="table-cell">${entry.user || 'Unknown'}</td>
                <td class="table-cell font-medium">${entry.file || 'N/A'}</td>
                <td class="table-cell text-gray-600">${new Date(entry.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');
    }
    openModal('activity-log-modal');
}

function populateFormFromData(data) {
    const setVal = (id, value) => { if (document.getElementById(id)) document.getElementById(id).value = value || ''; };
    const setChecked = (type, values) => {
        document.querySelectorAll(`[data-${type}]`).forEach(el => {
            el.checked = (values || []).includes(el.dataset[type]);
        });
    };

    setVal('date', data.d); setVal('po-number', data.po); setVal('job-file-no', data.jfn);
    setVal('invoice-no', data.in); setVal('billing-date', data.bd);
    setVal('salesman', data.sm); setVal('shipper-name', data.sh); setVal('consignee-name', data.co);
    setVal('mawb', data.mawb); setVal('hawb', data.hawb); setVal('teams-of-shipping', data.ts);
    setVal('origin', data.or); setVal('no-of-pieces', data.pc); setVal('gross-weight', data.gw);
    setVal('destination', data.de); setVal('volume-weight', data.vw); setVal('description', data.dsc);
    setVal('carrier', data.ca); setVal('truck-no', data.tn); setVal('vessel-name', data.vn);
    setVal('flight-voyage-no', data.fv); setVal('container-no', data.cn);
    setVal('remarks', data.re); 
    
    setVal('prepared-by', data.pb || data.createdBy || '');

    document.getElementById('created-by-info').textContent = data.createdBy ? `Created by: ${data.createdBy} on ${data.createdAt?.toDate().toLocaleDateString()}` : '';
    document.getElementById('last-updated-by-info').textContent = data.lastUpdatedBy ? `Last updated by: ${data.lastUpdatedBy} on ${data.updatedAt?.toDate().toLocaleString()}` : '';
    
    document.getElementById('checked-stamp').style.display = 'none';
    document.getElementById('approved-stamp').style.display = 'none';
    document.getElementById('rejected-stamp').style.display = 'none';
    document.getElementById('rejection-banner').style.display = 'none';
    document.getElementById('check-btn').style.display = 'none';
    document.getElementById('approval-buttons').style.display = 'none';

    const checkBtn = document.getElementById('check-btn');
    if (data.checkedBy) {
        const checkedDate = data.checkedAt?.toDate() ? ` on ${data.checkedAt.toDate().toLocaleDateString()}` : '';
        setVal('checked-by', `${data.checkedBy}${checkedDate}`);
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checked';
        document.getElementById('checked-stamp').style.display = 'block';
    } else {
        setVal('checked-by', 'Pending Check');
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Job File';
    }

    if (data.status === 'approved') {
        const approvedDate = data.approvedAt?.toDate() ? ` on ${data.approvedAt.toDate().toLocaleDateString()}` : '';
        setVal('approved-by', `${data.approvedBy}${approvedDate}`);
        document.getElementById('approved-stamp').style.display = 'block';
    } else if (data.status === 'rejected') {
        const rejectedDate = data.rejectedAt?.toDate() ? ` on ${data.rejectedAt.toDate().toLocaleDateString()}` : '';
        setVal('approved-by', `Rejected by ${data.rejectedBy}${rejectedDate}`);
        document.getElementById('rejected-stamp').style.display = 'block';
        document.getElementById('rejection-banner').style.display = 'block';
        document.getElementById('rejection-reason').textContent = data.rejectionReason;
    } else {
        setVal('approved-by', 'Pending Approval');
    }

    if (currentUser.role === 'admin') {
        if (data.status !== 'approved' && data.status !== 'rejected') {
            document.getElementById('approval-buttons').style.display = 'flex';
        }
    }
    if (['admin', 'checker'].includes(currentUser.role)) {
        if (!data.checkedBy) {
             document.getElementById('check-btn').style.display = 'block';
        }
    }

    setChecked('clearance', data.cl);
    setChecked('product', data.pt);

    populateTable(); // This will create the table structure
     if (data.ch && data.ch.length > 0) {
         const tableBody = document.getElementById('charges-table-body');
         tableBody.innerHTML = ''; // Clear empty rows
         data.ch.forEach(charge => addChargeRow(charge));
     } else {
        // If there are no charges, ensure there are some empty rows to start with
        for(let i=0; i<5; i++) addChargeRow();
    }
    calculate();
}

// --- HTML Forms & Tables ---
function getFormData() {
    const getVal = id => document.getElementById(id).value.trim() || '';
    const getChecked = query => Array.from(document.querySelectorAll(query)).filter(el => el.checked).map(el => el.dataset.clearance || el.dataset.product);

    const charges = [];
    document.querySelectorAll('#charges-table-body tr:not(#total-row)').forEach(row => {
        const description = row.querySelector('.description-input').value.trim();
        const cost = row.querySelector('.cost-input').value;
        const selling = row.querySelector('.selling-input').value;

        if (description && (cost || selling)) {
            charges.push({
                l: description, c: cost || '0', s: selling || '0', n: row.querySelector('.notes-input').value.trim() || ''
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
        ch: charges, re: getVal('remarks'), pb: getVal('prepared-by'),
        totalCost: parseFloat(document.getElementById('total-cost').textContent) || 0,
        totalSelling: parseFloat(document.getElementById('total-selling').textContent) || 0,
        totalProfit: parseFloat(document.getElementById('total-profit').textContent) || 0,
    };
}

function calculate() {
    let totalCost = 0, totalSelling = 0;
    document.querySelectorAll('#charges-table-body tr:not(#total-row)').forEach(row => {
        const cost = parseFloat(row.querySelector('.cost-input').value) || 0;
        const selling = parseFloat(row.querySelector('.selling-input').value) || 0;
        row.cells[3].textContent = (selling - cost).toFixed(3);
        totalCost += cost; 
        totalSelling += selling;
    });
    document.getElementById('total-cost').textContent = totalCost.toFixed(3);
    document.getElementById('total-selling').textContent = totalSelling.toFixed(3);
    document.getElementById('total-profit').textContent = (totalSelling - totalCost).toFixed(3);
}

function populateTable() {
    const table = document.getElementById('charges-table');
    table.innerHTML = `
        <thead><tr class="bg-gray-100">
            <th class="table-cell font-semibold w-2/5">Description</th>
            <th class="table-cell font-semibold">Cost</th>
            <th class="table-cell font-semibold">Selling</th>
            <th class="table-cell font-semibold">Profit</th>
            <th class="table-cell font-semibold">Notes</th>
            <th class="table-cell font-semibold"></th>
        </tr></thead>
        <tbody id="charges-table-body"></tbody>
        <tfoot><tr id="total-row" class="bg-gray-100 font-bold">
            <td class="table-cell text-right">TOTAL:</td>
            <td id="total-cost" class="table-cell text-right">0.000</td>
            <td id="total-selling" class="table-cell text-right">0.000</td>
            <td id="total-profit" class="table-cell text-right">0.000</td>
            <td class="table-cell" colspan="2"></td>
        </tr></tfoot>
    `;
    table.querySelector('#charges-table-body').addEventListener('input', e => {
        if (e.target.classList.contains('cost-input') || e.target.classList.contains('selling-input')) {
            calculate();
        }
    });
    for(let i=0; i<5; i++) addChargeRow();
}

function addChargeRow(data = {}) {
    const tableBody = document.getElementById('charges-table-body');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td class="table-cell relative"><input type="text" class="description-input input-field" value="${data.l || ''}" autocomplete="off"><div class="autocomplete-suggestions hidden"></div></td>
        <td class="table-cell"><input type="number" step="0.001" class="cost-input input-field" value="${data.c || ''}"></td>
        <td class="table-cell"><input type="number" step="0.001" class="selling-input input-field" value="${data.s || ''}"></td>
        <td class="table-cell profit-output bg-gray-50 text-right">${((data.s || 0) - (data.c || 0)).toFixed(3)}</td>
        <td class="table-cell"><input type="text" class="notes-input input-field" value="${data.n || ''}"></td>
        <td class="table-cell text-center"><button class="text-red-500 hover:text-red-700 font-bold text-xl">&times;</button></td>
    `;
    setupChargeAutocomplete(newRow.querySelector('.description-input'));
    newRow.querySelector('button').addEventListener('click', () => { newRow.remove(); calculate(); });
    tableBody.appendChild(newRow);
}

function displayJobFiles(files) {
    const list = document.getElementById('job-files-list');
    if (files.length === 0) {
         list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files match the current filters.</p>`;
         return;
    }
    list.innerHTML = files.map(docData => {
        const deleteButton = currentUser.role === 'admin' ? `<button onclick="confirmDelete('${docData.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Delete</button>` : '';
        const lastUpdated = docData.updatedAt?.toDate ? docData.updatedAt.toDate().toLocaleString() : 'N/A';
        return `
            <div class="border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2">
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
    }).join('');
}


// --- Client Management ---
function openClientManager() { openModal('client-manager-modal'); }

async function saveClient(event) {
    event.preventDefault();
    const clientId = document.getElementById('client-id').value;
    const clientName = document.getElementById('client-name').value.trim();
    if (!clientName) { showNotification("Client name is required.", true); return; }

    const clientData = {
        name: clientName,
        address: document.getElementById('client-address').value.trim(),
        contactPerson: document.getElementById('client-contact-person').value.trim(),
        phone: document.getElementById('client-phone').value.trim(),
        type: document.getElementById('client-type').value,
        updatedAt: new Date()
    };

    showLoader();
    try {
        await saveClientToDb(clientData, clientId);
        showNotification(clientId ? "Client updated successfully!" : "Client added successfully!");
        clearClientForm();
    } catch (error) {
        showNotification("Could not save client.", true);
    } finally {
        hideLoader();
    }
}

function clearClientForm() {
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-form-title').textContent = 'Add New Client';
}

function editClient(clientId) {
    const client = clientsCache.find(c => c.id === clientId);
    if (client) {
        document.getElementById('client-id').value = client.id;
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-address').value = client.address || '';
        document.getElementById('client-contact-person').value = client.contactPerson || '';
        document.getElementById('client-phone').value = client.phone || '';
        document.getElementById('client-type').value = client.type || 'Shipper';
        document.getElementById('client-form-title').textContent = 'Edit Client';
    }
}

function displayClients(clients) {
    const list = document.getElementById('client-list');
    if (clients.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center p-4">No clients found.</p>`;
        return;
    }
    list.innerHTML = clients.map(client => `
        <div class="border p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold">${client.name}</p>
                    <p class="text-sm text-gray-600">${client.address || ''}</p>
                    <p class="text-xs text-gray-500">${client.contactPerson || ''} - ${client.phone || ''}</p>
                </div>
                <div class="flex-shrink-0 space-x-2">
                    <button onclick="editClient('${client.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs">Edit</button>
                    <button onclick="confirmDelete('${client.id}', 'client')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}


// --- Autocomplete ---
function setupAutocomplete(inputId, suggestionsId, type) {
    const input = document.getElementById(inputId);
    const suggestionsPanel = document.getElementById(suggestionsId);
    let activeSuggestionIndex = -1;

    const updateSelection = () => {
        suggestionsPanel.querySelectorAll('.autocomplete-suggestion').forEach((suggestion, index) => {
            suggestion.classList.toggle('selected', index === activeSuggestionIndex);
            if (index === activeSuggestionIndex) suggestion.scrollIntoView({ block: 'nearest' });
        });
    };

    input.addEventListener('input', () => {
        const value = input.value.toLowerCase();
        if (value.length < 2) { suggestionsPanel.classList.add('hidden'); return; }

        const filteredClients = clientsCache.filter(client => 
            client.name.toLowerCase().includes(value) && (client.type === type || client.type === 'Both')
        );

        if (filteredClients.length > 0) {
            suggestionsPanel.innerHTML = filteredClients.map(c => `<div class="autocomplete-suggestion">${c.name}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
            activeSuggestionIndex = -1;
        } else {
            suggestionsPanel.classList.add('hidden');
        }
    });

    input.addEventListener('keydown', (e) => {
        const suggestions = suggestionsPanel.querySelectorAll('.autocomplete-suggestion');
        if (suggestionsPanel.classList.contains('hidden')) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
            updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex > -1) suggestions[activeSuggestionIndex].click();
        } else if (e.key === 'Escape') {
            suggestionsPanel.classList.add('hidden');
        }
    });

    suggestionsPanel.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            input.value = e.target.textContent;
            suggestionsPanel.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.relative')) suggestionsPanel.classList.add('hidden');
    });
}

function setupChargeAutocomplete(inputElement) {
    const suggestionsPanel = inputElement.nextElementSibling;
    let activeSuggestionIndex = -1;

    const updateSelection = () => {
        suggestionsPanel.querySelectorAll('.autocomplete-suggestion').forEach((suggestion, index) => {
            suggestion.classList.toggle('selected', index === activeSuggestionIndex);
            if (index === activeSuggestionIndex) suggestion.scrollIntoView({ block: 'nearest' });
        });
    };

    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase();
        if (!value) { suggestionsPanel.classList.add('hidden'); return; }

        const filtered = chargeDescriptions.filter(d => d.toLowerCase().includes(value));
        if (filtered.length > 0) {
            suggestionsPanel.innerHTML = filtered.map(d => `<div class="autocomplete-suggestion">${d}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
            activeSuggestionIndex = -1;
        } else {
            suggestionsPanel.classList.add('hidden');
        }
    });

    inputElement.addEventListener('keydown', (e) => {
        const suggestions = suggestionsPanel.querySelectorAll('.autocomplete-suggestion');
        if (suggestionsPanel.classList.contains('hidden')) return;

        if (e.key === 'ArrowDown') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length; updateSelection(); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length; updateSelection(); } 
        else if (e.key === 'Enter') { e.preventDefault(); if (activeSuggestionIndex > -1) suggestions[activeSuggestionIndex].click(); } 
        else if (e.key === 'Escape') { suggestionsPanel.classList.add('hidden'); }
    });

    suggestionsPanel.addEventListener('click', e => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            inputElement.value = e.target.textContent;
            suggestionsPanel.classList.add('hidden');
        }
    });

    inputElement.addEventListener('blur', () => setTimeout(() => suggestionsPanel.classList.add('hidden'), 150));
}

// --- Analytics ---
function openAnalyticsDashboard() {
    filterAnalyticsByTimeframe('all', 'bd');
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('analytics-container').style.display = 'block';
    window.scrollTo(0, 0);
}

function closeAnalyticsDashboard() {
    document.getElementById('analytics-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
}

function filterAnalyticsByTimeframe(timeframe, dateType = 'bd') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    currentFilteredJobs = timeframe === 'all' 
        ? jobFilesCache
        : jobFilesCache.filter(job => {
            const dateField = dateType === 'bd' ? job.bd : job.d;
            if (!dateField) return false;
            const jobDate = new Date(dateField);
            if (timeframe === 'thisYear') return jobDate.getFullYear() === currentYear;
            if (timeframe === 'lastYear') return jobDate.getFullYear() === lastYear;
            if (timeframe.includes('-')) {
                const [year, month] = timeframe.split('-').map(Number);
                return jobDate.getFullYear() === year && jobDate.getMonth() === month - 1;
            }
            return true;
        });
    calculateAndDisplayAnalytics(currentFilteredJobs, dateType);
}

function calculateAndDisplayAnalytics(jobs, dateType) {
    let totalJobs = jobs.length;
    let totalRevenue = 0, totalCost = 0, totalProfit = 0;
    const profitByFile = [], profitByShipper = {}, profitByConsignee = {}, monthlyStatsByBilling = {}, monthlyStatsByOpening = {}, profitByUser = {}, profitBySalesman = {};

    jobs.forEach(job => {
        const profit = job.totalProfit || 0;
        totalRevenue += job.totalSelling || 0;
        totalCost += job.totalCost || 0;
        totalProfit += profit;
        
        let status = 'Pending';
        if (job.status === 'rejected') status = 'Rejected';
        else if (job.status === 'approved') status = 'Approved';
        else if (job.status === 'checked') status = 'Checked';

        profitByFile.push({ id: job.id, jfn: job.jfn, shipper: job.sh, consignee: job.co, profit, status, date: job.updatedAt?.toDate() || new Date(0), cost: job.totalCost || 0, dsc: job.dsc, mawb: job.mawb, createdBy: job.createdBy || 'N/A' });
        
        if (job.sh) profitByShipper[job.sh] = (profitByShipper[job.sh] || 0) + profit;
        if (job.co) profitByConsignee[job.co] = (profitByConsignee[job.co] || 0) + profit;
        
        const processMonth = (statsObj, dateStr, jobData) => {
            if (dateStr) {
                const month = dateStr.substring(0, 7);
                if (!statsObj[month]) statsObj[month] = { profit: 0, count: 0, jobs: [] };
                statsObj[month].profit += profit;
                statsObj[month].count++;
                statsObj[month].jobs.push(jobData);
            }
        };
        processMonth(monthlyStatsByBilling, job.bd, job);
        processMonth(monthlyStatsByOpening, job.d, job);
        
        const creator = job.createdBy || 'Unknown';
        if (!profitByUser[creator]) profitByUser[creator] = { count: 0, profit: 0, jobs: [] };
        profitByUser[creator].count++;
        profitByUser[creator].profit += profit;
        profitByUser[creator].jobs.push(job);
        
        const salesman = job.sm || 'N/A';
        if (salesman !== 'N/A') {
            if (!profitBySalesman[salesman]) profitBySalesman[salesman] = { count: 0, profit: 0, jobs: [] };
            profitBySalesman[salesman].count++;
            profitBySalesman[salesman].profit += profit;
            profitBySalesman[salesman].jobs.push(job);
        }
    });

    analyticsDataCache = {
        totalJobs, totalRevenue, totalCost, totalProfit, profitByFile,
        profitByShipper: Object.entries(profitByShipper).sort((a, b) => b[1] - a[1]),
        profitByConsignee: Object.entries(profitByConsignee).sort((a, b) => b[1] - a[1]),
        monthlyStatsByBilling: Object.entries(monthlyStatsByBilling).sort((a, b) => a[0].localeCompare(b[0])),
        monthlyStatsByOpening: Object.entries(monthlyStatsByOpening).sort((a, b) => a[0].localeCompare(b[0])),
        profitByUser: Object.entries(profitByUser).sort((a, b) => b[1].profit - a[1].profit),
        profitBySalesman: Object.entries(profitBySalesman).sort((a, b) => b[1].profit - a[1].profit)
    };

    displayAnalytics(analyticsDataCache, 'profit-desc', '', dateType);
}

function displayAnalytics(data, sortBy, searchTerm, monthlyReportType) {
    const body = document.getElementById('analytics-body');
    if (!body) return;

     if (!data || data.totalJobs === 0) {
        body.innerHTML = `<div class="text-center p-8"><p class="text-gray-500">No data available for the selected period.</p></div>`;
        return;
    }

    let filteredFiles = data.profitByFile;
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        filteredFiles = data.profitByFile.filter(file => 
            (file.jfn || '').toLowerCase().includes(lowerCaseSearchTerm) ||
            (file.shipper || '').toLowerCase().includes(lowerCaseSearchTerm) ||
            (file.consignee || '').toLowerCase().includes(lowerCaseSearchTerm) ||
            (file.mawb || '').toLowerCase().includes(lowerCaseSearchTerm) ||
            (file.createdBy || '').toLowerCase().includes(lowerCaseSearchTerm)
        );
    }
    
    const monthlyStats = monthlyReportType === 'billing' ? data.monthlyStatsByBilling : data.monthlyStatsByOpening;
    const monthlyReportTitle = monthlyReportType === 'billing' ? 'Profit By Month (Billing Date)' : 'Profit By Month (Opening Date)';

    const sortedFiles = [...filteredFiles];
    if (sortBy === 'profit-desc') sortedFiles.sort((a, b) => b.profit - a.profit);
    else if (sortBy === 'date-desc') sortedFiles.sort((a, b) => b.date - a.date);
    else if (sortBy === 'status') { const order = { 'Pending': 1, 'Checked': 2, 'Approved': 3, 'Rejected': 4 }; sortedFiles.sort((a, b) => (order[a.status] || 99) - (order[b.status] || 99)); }
    else if (sortBy === 'user') sortedFiles.sort((a, b) => (a.createdBy || '').localeCompare(b.createdBy || ''));

    const renderTableRows = (items, renderer) => items.length > 0 ? items.slice(0, 5).map(renderer).join('') : `<tr><td colspan="100%" class="text-center text-gray-400 p-2">No data</td></tr>`;

    body.innerHTML = `
        <!-- ... Timeframe filters will be added dynamically by event listeners ... -->
        <!-- Overall Summary -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center mt-6">
            <div class="bg-gray-100 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Jobs</p><p class="text-2xl font-bold">${data.totalJobs}</p></div>
            <div class="bg-blue-100 p-4 rounded-lg"><p class="text-sm text-blue-800">Total Revenue</p><p class="text-2xl font-bold text-blue-900">KD ${data.totalRevenue.toFixed(3)}</p></div>
            <div class="bg-red-100 p-4 rounded-lg"><p class="text-sm text-red-800">Total Cost</p><p class="text-2xl font-bold text-red-900">KD ${data.totalCost.toFixed(3)}</p></div>
            <div class="bg-green-100 p-4 rounded-lg"><p class="text-sm text-green-800">Total Profit</p><p class="text-2xl font-bold text-green-900">KD ${data.totalProfit.toFixed(3)}</p></div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow-sm"><div style="position: relative; height:300px;"><canvas id="profit-chart"></canvas></div></div>
        <div id="analytics-tables" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div><h4 class="text-lg font-semibold mb-2">Top Profitable Shippers</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Shipper</th><th>Total Profit</th></tr></thead><tbody>${renderTableRows(data.profitByShipper, ([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`)}</tbody></table></div></div>
            <div><h4 class="text-lg font-semibold mb-2">Top Profitable Consignees</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Consignee</th><th>Total Profit</th></tr></thead><tbody>${renderTableRows(data.profitByConsignee, ([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`)}</tbody></table></div></div>
            <div><h4 class="text-lg font-semibold mb-2">Top Salesmen by Profit</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Salesman</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead><tbody>${renderTableRows(data.profitBySalesman, ([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-salesman-jobs" data-salesman="${name}" class="bg-indigo-500 text-white font-bold py-1 px-2 rounded text-xs">View</button></td></tr>`)}</tbody></table></div></div>
            <div class="lg:col-span-3"><h4 class="text-lg font-semibold mb-2">${monthlyReportTitle}</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Month</th><th>Jobs</th><th>Profit</th><th>Actions</th></tr></thead><tbody>${renderTableRows(monthlyStats, ([month, stats]) => `<tr><td>${month}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-monthly-jobs" data-month="${month}" data-datetype="${monthlyReportType}" class="bg-indigo-500 text-white font-bold py-1 px-2 rounded text-xs">View</button></td></tr>`)}</tbody></table></div></div>
            <div class="lg:col-span-3"><h4 class="text-lg font-semibold mb-2">Top Users by Profit</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>User</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead><tbody>${renderTableRows(data.profitByUser, ([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-user-jobs" data-user="${name}" class="bg-indigo-500 text-white font-bold py-1 px-2 rounded text-xs">View</button></td></tr>`)}</tbody></table></div></div>
        </div>
        <div>
            <div class="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
                <h4 class="text-lg font-semibold">Job File Details</h4>
                <div class="flex items-center gap-2 flex-grow">
                    <input type="text" id="analytics-search-bar" class="input-field w-full sm:w-auto flex-grow" placeholder="Search files..." value="${searchTerm}">
                    <label for="sort-analytics" class="text-sm ml-4 mr-2">Sort by:</label>
                    <select id="sort-analytics" class="input-field w-auto inline-block text-sm"><option value="profit-desc" ${sortBy === 'profit-desc' ? 'selected' : ''}>Profit</option><option value="date-desc" ${sortBy === 'date-desc' ? 'selected' : ''}>Date</option><option value="status" ${sortBy === 'status' ? 'selected' : ''}>Status</option><option value="user" ${sortBy === 'user' ? 'selected' : ''}>User</option></select>
                    <button onclick="downloadAnalyticsCsv()" class="bg-gray-700 hover:bg-gray-800 text-white font-bold py-1 px-3 rounded text-sm">CSV</button>
                </div>
            </div>
            <div class="max-h-96 overflow-y-auto"><table class="analytics-table w-full text-sm">
                <thead><tr><th>Job Details</th><th>Cost / Profit</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>${sortedFiles.length > 0 ? sortedFiles.map(file => `
                    <tr>
                        <td>
                            <p class="font-bold">${file.jfn || file.id}</p><p class="text-xs">Shipper: ${file.shipper || 'N/A'}</p><p class="text-xs">Consignee: ${file.consignee || 'N/A'}</p>
                            <p class="text-xs text-gray-600">AWB: ${file.mawb || 'N/A'}</p><p class="text-xs font-bold mt-1">By: ${file.createdBy || 'N/A'}</p>
                        </td>
                        <td><p class="font-bold text-green-600">KD ${file.profit.toFixed(3)}</p><p class="text-xs text-red-600">Cost: KD ${file.cost.toFixed(3)}</p></td>
                        <td>${file.status}</td>
                        <td class="space-x-1">
                            <button onclick="previewJobFileById('${file.id}')" class="bg-blue-500 text-white font-bold py-1 px-2 rounded text-xs">Preview</button>
                            <button onclick="loadJobFileById('${file.id}')" class="bg-green-500 text-white font-bold py-1 px-2 rounded text-xs">Load</button>
                            ${currentUser.role === 'admin' ? `<button onclick="confirmDelete('${file.id}')" class="bg-red-500 text-white font-bold py-1 px-2 rounded text-xs">Del</button>` : ''}
                        </td>
                    </tr>`).join('') : `<tr><td colspan="4" class="text-center py-4">No files match your search.</td></tr>`}
                </tbody>
            </table></div>
        </div>
    `;

    renderProfitChart(data, monthlyReportType);
    
    // Add event listeners after innerHTML is set
    document.getElementById('analytics-search-bar').addEventListener('input', (e) => displayAnalytics(analyticsDataCache, document.getElementById('sort-analytics').value, e.target.value, document.getElementById('analytics-date-type').value));
    document.getElementById('sort-analytics').addEventListener('change', (e) => displayAnalytics(analyticsDataCache, e.target.value, document.getElementById('analytics-search-bar').value, document.getElementById('analytics-date-type').value));
    document.getElementById('analytics-tables').addEventListener('click', e => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const { action, user, month, datetype, salesman } = button.dataset;
        if (action === 'view-user-jobs') showUserJobs(user);
        else if (action === 'view-monthly-jobs') showMonthlyJobs(month, datetype);
        else if (action === 'view-salesman-jobs') showSalesmanJobs(salesman);
    });
}

function renderProfitChart(data, monthlyReportType) {
    if (profitChartInstance) profitChartInstance.destroy();
    const ctx = document.getElementById('profit-chart')?.getContext('2d');
    if (!ctx) return;
    
    const monthlyStats = monthlyReportType === 'billing' ? data.monthlyStatsByBilling : data.monthlyStatsByOpening;
    let year = new Date().getFullYear();
    if (currentFilteredJobs.length > 0) {
        const dateField = monthlyReportType === 'billing' ? currentFilteredJobs[0].bd : currentFilteredJobs[0].d;
        if (dateField) year = new Date(dateField).getFullYear();
    }

    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const profits = Array(12).fill(0);
    monthlyStats.forEach(([monthStr, stats]) => {
        const [statYear, statMonth] = monthStr.split('-').map(Number);
        if (statYear === year) profits[statMonth - 1] = stats.profit;
    });

    profitChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: `Monthly Profit for ${year}`, data: profits, backgroundColor: profits.map(p => p >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'), borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: v => 'KD ' + v } } }, plugins: { legend: {display: false}, tooltip: { callbacks: { label: c => `KD ${c.parsed.y.toFixed(3)}` } } } }
    });
}

// ... more analytics functions (sort, download csv)
function sortAnalyticsTable(sortBy) {
    const searchTerm = document.getElementById('analytics-search-bar').value;
    displayAnalytics(analyticsDataCache, sortBy, searchTerm, document.getElementById('analytics-date-type').value);
}

function downloadAnalyticsCsv() {
    let csvContent = "data:text/csv;charset=utf-8,Job File ID,Shipper,Consignee,Profit,Status,Cost,Description,AWB/MAWB,Created By\n";
    const sortedFiles = [...analyticsDataCache.profitByFile].sort((a,b) => (b.profit || 0) - (a.profit || 0));
    sortedFiles.forEach(job => {
        const rowData = [job.jfn, job.shipper || 'N/A', job.consignee || 'N/A', (job.profit || 0).toFixed(3), job.status, (job.cost || 0).toFixed(3), job.dsc || 'N/A', job.mawb || 'N/A', job.createdBy || 'N/A'];
        csvContent += rowData.map(d => `"${String(d).replace(/"/g, '""')}"`).join(",") + "\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "job_file_analytics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Modals for viewing specific job lists ---
function refreshOpenModals() {
    const modal = document.querySelector('#user-jobs-modal.visible');
    if (!modal) return;
    const title = modal.querySelector('#user-jobs-modal-title').textContent;
    if(title.includes('Created by')) showUserJobs(title.replace('Job Files Created by ', ''));
    else if (title.includes('Salesman')) showSalesmanJobs(title.replace('Job Files for Salesman: ', ''));
    else if (title.includes('Job Files for')) showMonthlyJobs(title.replace('Job Files for ', ''), document.getElementById('analytics-date-type')?.value || 'bd');
    else if (title.includes(' - ')) showStatusJobs(title.split(' - ')[1].toLowerCase());
}

function showSalesmanJobs(salesmanName) {
    const salesmanJobs = currentFilteredJobs.filter(job => (job.sm || 'N/A') === salesmanName);
    displayJobsInModal(salesmanJobs, `Job Files for Salesman: ${salesmanName}`);
}

function showUserJobs(userName) {
    const userJobs = currentFilteredJobs.filter(job => job.createdBy === userName);
    displayJobsInModal(userJobs, `Job Files Created by ${userName}`);
}

function showMonthlyJobs(month, dateType) {
    const monthlyJobs = currentFilteredJobs.filter(job => {
        const dateField = dateType === 'billing' ? job.bd : job.d;
        return dateField && dateField.startsWith(month);
    });
    displayJobsInModal(monthlyJobs, `Job Files for ${month}`);
}

function showStatusJobs(status) {
    const statusJobs = jobFilesCache.filter(job => (status === 'pending' ? (job.status === 'pending' || !job.status) : job.status === status));
    displayJobsInModal(statusJobs, `Job Files - ${status.charAt(0).toUpperCase() + status.slice(1)}`);
}

function displayJobsInModal(jobs, title) {
    document.getElementById('user-jobs-modal-title').textContent = title;
    const list = document.getElementById('user-jobs-list');
    if (jobs.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files found.</p>`;
    } else {
        list.innerHTML = jobs.map(docData => {
            let buttons = `<button onclick="previewJobFileById('${docData.id}')" class="bg-gray-500 text-white py-1 px-2 rounded text-xs">Preview</button><button onclick="loadJobFileById('${docData.id}')" class="bg-purple-500 text-white py-1 px-2 rounded text-xs">Load</button>`;
            if (currentUser.role === 'admin' || currentUser.role === 'checker') {
                if (docData.status === 'checked' || docData.status === 'approved') buttons += `<button onclick="uncheckJobFile('${docData.id}')" class="bg-yellow-500 text-white py-1 px-2 rounded text-xs">Uncheck</button>`;
                else if (docData.status === 'pending' || !docData.status) buttons += `<button onclick="checkJobFile('${docData.id}')" class="bg-blue-500 text-white py-1 px-2 rounded text-xs">Check</button>`;
            }
            if (currentUser.role === 'admin' && docData.status === 'checked') {
                buttons += `<button onclick="approveJobFile('${docData.id}')" class="bg-green-500 text-white py-1 px-2 rounded text-xs">Approve</button><button onclick="promptForRejection('${docData.id}')" class="bg-red-500 text-white py-1 px-2 rounded text-xs">Reject</button>`;
            }
            if (currentUser.role === 'admin') buttons += `<button onclick="confirmDelete('${docData.id}')" class="bg-red-600 text-white py-1 px-2 rounded text-xs">Delete</button>`;
            
            return `
                 <div class="border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 gap-2">
                     <div class="w-full sm:w-2/5"><p class="font-bold text-indigo-700">${docData.jfn}</p><p class="text-sm">Shipper: ${docData.sh}</p></div>
                     <div class="w-full sm:w-1/5 text-xs"><p>Cost: <span class="font-medium text-red-600">KD ${(docData.totalCost || 0).toFixed(3)}</span></p><p>Profit: <span class="font-medium text-green-600">KD ${(docData.totalProfit || 0).toFixed(3)}</span></p></div>
                     <div class="space-x-1 flex-shrink-0">${buttons}</div>
                 </div>`;
        }).join('');
    }
    openModal('user-jobs-modal', true);
}


// --- Admin Panel & Backup/Restore ---
async function openAdminPanel() {
    if (currentUser.role !== 'admin') return;
    showLoader();
    try {
        const users = await getUsers();
        const userListDiv = document.getElementById('user-list');
        userListDiv.innerHTML = users.map(user => {
            const isDisabled = user.id === currentUser.uid;
            return `
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center p-2 border-b">
                    <input type="text" data-uid="${user.id}" class="display-name-input input-field col-span-1" value="${user.displayName}" ${isDisabled ? 'disabled' : ''}>
                    <select data-uid="${user.id}" class="role-select input-field col-span-1" ${isDisabled ? 'disabled' : ''}>
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option><option value="checker" ${user.role === 'checker' ? 'selected' : ''}>Checker</option>
                        <option value="driver" ${user.role === 'driver' ? 'selected' : ''}>Driver</option><option value="warehouse_supervisor" ${user.role === 'warehouse_supervisor' ? 'selected' : ''}>Warehouse Supervisor</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <select data-uid="${user.id}" class="status-select input-field col-span-1" ${isDisabled ? 'disabled' : ''}>
                        <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive</option><option value="blocked" ${user.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                    </select>
                </div>
            `;
        }).join('');
        openModal('admin-panel-modal');
    } catch (e) {
        showNotification("Could not load users.", true);
    } finally {
        hideLoader();
    }
}

async function saveUserChanges() {
    showLoader();
    const updates = [];
    document.querySelectorAll('#user-list > div').forEach(row => {
        const nameInput = row.querySelector('.display-name-input');
        if (nameInput.disabled) return;
        updates.push({
            uid: nameInput.dataset.uid,
            data: { 
                displayName: nameInput.value, 
                role: row.querySelector('.role-select').value,
                status: row.querySelector('.status-select').value
            }
        });
    });

    try {
        await saveUserChangesToDb(updates);
        showNotification("User details updated successfully!");
        closeModal('admin-panel-modal');
    } catch (error) {
        showNotification("Failed to update user details.", true);
    } finally {
        hideLoader();
    }
}

async function backupAllData() {
    showLoader();
    try {
        const { jobfiles, users } = await getBackupData();
        const backupData = { version: "1.0", createdAt: new Date().toISOString(), data: { jobfiles, users } };
        const jsonString = JSON.stringify(backupData, (k, v) => (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : v, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `qgo-cargo-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        showNotification("Backup created and download started.");
    } catch (error) {
        showNotification("Backup failed.", true);
    } finally {
        hideLoader();
    }
}

async function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const backupData = JSON.parse(e.target.result);
            if (!backupData.data || !backupData.data.jobfiles || !backupData.data.users) throw new Error("Invalid format");
            const onOk = async () => {
                showLoader();
                try {
                    await restoreBackupData(backupData.data);
                    showNotification("Data restored! The page will now reload.");
                    setTimeout(() => window.location.reload(), 2000);
                } catch (err) {
                    showNotification("Restore failed.", true);
                } finally {
                    hideLoader();
                }
            };
            
            const modal = document.getElementById('confirm-modal');
            modal.querySelector('#confirm-title').textContent = 'Confirm Data Restore';
            modal.querySelector('#confirm-message').innerHTML = `<p>This will overwrite <b>${backupData.data.jobfiles.length} job files</b> and <b>${backupData.data.users.length} users</b>. This cannot be undone.</p>`;
            modal.querySelector('#confirm-ok').className = 'bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded';
            openModal('confirm-modal', true);
            const okButton = modal.querySelector('#confirm-ok');
            okButton.addEventListener('click', onOk, { once: true });

        } catch (error) { showNotification("Invalid backup file.", true); }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// --- Recycle Bin ---
async function openRecycleBin() {
    showLoader();
    try {
        const deletedFiles = await getRecycleBinFiles();
        const list = document.getElementById('recycle-bin-list');
        if (deletedFiles.length === 0) {
            list.innerHTML = `<p class="text-gray-500 text-center p-4">The recycle bin is empty.</p>`;
        } else {
            list.innerHTML = deletedFiles.map(docData => `
                <div class="border p-3 rounded-lg flex justify-between items-center bg-gray-50">
                    <div><p class="font-bold">${docData.jfn}</p><p class="text-xs text-gray-400">Deleted by ${docData.deletedBy || 'N/A'} on ${docData.deletedAt?.toDate().toLocaleString() || 'N/A'}</p></div>
                    <div class="space-x-2"><button onclick="restoreJobFile('${docData.id}')" class="bg-green-500 text-white py-1 px-3 rounded text-sm">Restore</button><button onclick="confirmPermanentDelete('${docData.id}')" class="bg-red-700 text-white py-1 px-3 rounded text-sm">Delete Permanently</button></div>
                </div>`).join('');
        }
        openModal('recycle-bin-modal', true);
    } catch (error) { showNotification("Could not open recycle bin.", true);
    } finally { hideLoader(); }
}

async function restoreJobFile(docId) {
    showLoader();
    try {
        await restoreJobFileFromBin(docId);
        showNotification("Job file restored.");
        openRecycleBin(); // Refresh view
    } catch (e) { showNotification("Error restoring file.", true); } finally { hideLoader(); }
}

function confirmPermanentDelete(docId) {
    const onOk = async () => {
        showLoader();
        try {
            await permanentlyDeleteFromBin(docId);
            showNotification("Job file permanently deleted.");
            openRecycleBin();
        } catch (e) { showNotification("Could not permanently delete.", true); } finally { hideLoader(); }
    };
    const modal = document.getElementById('confirm-modal');
    modal.querySelector('#confirm-title').textContent = 'Confirm Permanent Deletion';
    modal.querySelector('#confirm-message').innerHTML = `Are you sure? <b class="text-red-600">This cannot be undone.</b>`;
    openModal('confirm-modal', true);
    modal.querySelector('#confirm-ok').addEventListener('click', onOk, { once: true });
}

// --- Charge Descriptions ---
function openChargeManager() {
    displayChargeDescriptions();
    openModal('charge-manager-modal');
}

function displayChargeDescriptions() {
    document.getElementById('charge-description-list').innerHTML = chargeDescriptions.map(desc => `
        <div class="flex justify-between items-center p-2 bg-gray-100 rounded">
            <span>${desc}</span><button onclick="deleteChargeDescription('${desc}')" class="text-red-500 font-bold">&times;</button>
        </div>`).join('');
}

function saveChargeDescription() {
    const input = document.getElementById('new-charge-description');
    const newDesc = input.value.trim();
    if (newDesc && !chargeDescriptions.includes(newDesc)) {
        chargeDescriptions.push(newDesc);
        localStorage.setItem('chargeDescriptions', JSON.stringify(chargeDescriptions));
        displayChargeDescriptions();
        input.value = '';
    }
}

function deleteChargeDescription(description) {
    chargeDescriptions = chargeDescriptions.filter(d => d !== description);
    localStorage.setItem('chargeDescriptions', JSON.stringify(chargeDescriptions));
    displayChargeDescriptions();
}


// --- Main App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAppAndAuth();
    
    let isLogin = true;
    document.getElementById('auth-link').addEventListener('click', e => { e.preventDefault(); isLogin = !isLogin; toggleAuthView(isLogin); });
    document.getElementById('auth-btn').addEventListener('click', () => {
        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;
        if (isLogin) handleLogin(email, password);
        else {
            const displayName = document.getElementById('full-name').value;
            if (!email || !password || !displayName) showNotification("Please fill all fields to sign up.", true);
            else handleSignUp(email, password, displayName);
        }
    });
    
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('approve-btn').addEventListener('click', () => approveJobFile());
    document.getElementById('reject-btn').addEventListener('click', () => promptForRejection(null));
    document.getElementById('confirm-reject-btn').addEventListener('click', rejectJobFileAction);
    document.getElementById('check-btn').addEventListener('click', () => checkJobFile());
    document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
    document.getElementById('activity-log-btn').addEventListener('click', openUserActivityLog);
    document.getElementById('forgot-password-link').addEventListener('click', e => { e.preventDefault(); openModal('forgot-password-modal'); });
    document.getElementById('send-reset-link-btn').addEventListener('click', handleForgotPassword);

    document.getElementById('search-bar').addEventListener('input', applyFiltersAndDisplay);
    document.getElementById('filter-status').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('filter-date-from').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('filter-date-to').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        document.getElementById('search-bar').value = ''; document.getElementById('filter-status').value = '';
        document.getElementById('filter-date-from').value = ''; document.getElementById('filter-date-to').value = '';
        applyFiltersAndDisplay();
    });

    document.getElementById('client-form').addEventListener('submit', saveClient);
    document.getElementById('clear-client-form-btn').addEventListener('click', clearClientForm);
    document.getElementById('client-search-bar').addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        displayClients(clientsCache.filter(c => c.name.toLowerCase().includes(searchTerm)));
    });

    setupAutocomplete('shipper-name', 'shipper-suggestions', 'Shipper');
    setupAutocomplete('consignee-name', 'consignee-suggestions', 'Consignee');

    window.addEventListener('afterprint', () => { document.getElementById('main-container').style.display = 'block'; document.getElementById('print-output').style.display = 'none'; });
    
    populateTable();
    calculate();
    document.getElementById('date').valueAsDate = new Date();
});


// --- Functions to expose on the window object for inline HTML onclicks ---
window.openAnalyticsDashboard = openAnalyticsDashboard;
window.closeAnalyticsDashboard = closeAnalyticsDashboard;
window.openFileManager = () => openModal('file-manager-modal');
window.openClientManager = openClientManager;
window.saveJobFile = saveJobFile;
window.clearForm = clearForm;
window.printPage = printPage;
window.previewJobFileById = previewJobFileById;
window.loadJobFileById = loadJobFileById;
window.confirmDelete = confirmDelete;
window.editClient = editClient;
window.saveUserChanges = saveUserChanges;
window.suggestCharges = () => suggestChargesFromGemini(chargeDescriptions);
window.backupAllData = backupAllData;
window.handleRestoreFile = handleRestoreFile;
window.showUserJobs = showUserJobs;
window.showMonthlyJobs = showMonthlyJobs;
window.showSalesmanJobs = showSalesmanJobs;
window.showStatusJobs = showStatusJobs;
window.checkJobFile = checkJobFile;
window.approveJobFile = approveJobFile;
window.uncheckJobFile = uncheckJobFile;
window.promptForRejection = promptForRejection;
window.openRecycleBin = openRecycleBin;
window.restoreJobFile = restoreJobFile;
window.confirmPermanentDelete = confirmPermanentDelete;
window.openChargeManager = openChargeManager;
window.saveChargeDescription = saveChargeDescription;
window.deleteChargeDescription = deleteChargeDescription;
window.addChargeRow = addChargeRow;
window.calculate = calculate;
window.printPreview = printPreview;
window.printAnalytics = printAnalytics;
window.downloadAnalyticsCsv = downloadAnalyticsCsv;
window.sortAnalyticsTable = sortAnalyticsTable;
window.filterAnalyticsByTimeframe = filterAnalyticsByTimeframe;
window.displayAnalytics = displayAnalytics;

// Dummy functions to prevent errors if called before full implementation
function applyFiltersAndDisplay() { /* placeholder */ }
function getPrintViewHtml() { return ''; }
function createPrintWindow() { /* placeholder */ }
