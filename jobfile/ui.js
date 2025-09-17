import { getCurrentUser, getDb, getJobFilesCache, getClientsCache, getAnalyticsDataCache, getChargeDescriptions, setCurrentFilteredJobs, setAnalyticsDataCache, getProfitChartInstance, setProfitChartInstance } from './state.js';
import { getDoc, doc, collection, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- UI Helpers ---
export function showLoader() { document.getElementById('loader-overlay').classList.add('visible'); }
export function hideLoader() { document.getElementById('loader-overlay').classList.remove('visible'); }

export function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#c53030' : '#2d3748';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// --- View Switching ---
export function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('public-view-container').innerHTML = ''; // Clear public view
    document.getElementById('analytics-container').style.display = 'none'; // Hide analytics
}

export function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';

    const currentUser = getCurrentUser();
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
}

export async function showPublicJobView(jobId) {
    showLoader();
    const db = getDb();
    try {
        const docId = jobId.replace(/\//g, '_');
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const publicViewHtml = getPrintViewHtml(data, true); 
            
            showLogin(); // Hide main app and login
            const publicViewContainer = document.getElementById('public-view-container');
            publicViewContainer.innerHTML = publicViewHtml;
            publicViewContainer.style.display = 'block';
        } else {
            document.body.innerHTML = `<div class="p-4 text-center text-yellow-700 bg-yellow-100">Job File with ID "${jobId}" not found.</div>`;
        }
    } catch (error) {
        console.error("Error fetching public job file:", error);
        document.body.innerHTML = `<div class="p-4 text-center text-red-700 bg-red-100">Error loading job file.</div>`;
    } finally {
        hideLoader();
    }
}


// --- Modal Management ---
export function openModal(id, keepParent = false) {
    if (!keepParent) {
        closeAllModals();
    }
    const modal = document.getElementById(id);
    if (keepParent) {
        const highestZ = getHighestZIndex();
        modal.style.zIndex = highestZ + 1;
    }
    modal.classList.add('visible');
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('visible');
    modal.style.zIndex = '';
}

function closeAllModals() {
    document.querySelectorAll('.overlay').forEach(modal => {
        modal.classList.remove('visible');
        modal.style.zIndex = ''; 
    });
}

function getHighestZIndex() {
    let highest = 1000;
    document.querySelectorAll('.overlay.visible').forEach(modal => {
        const z = parseInt(window.getComputedStyle(modal).zIndex, 10);
        if (z > highest) {
            highest = z;
        }
    });
    return highest;
}

export function refreshOpenModals() {
    const { showUserJobs, showMonthlyJobs, showSalesmanJobs, showStatusJobs } = import('./ui.js');
    if (document.getElementById('user-jobs-modal').classList.contains('visible')) {
        const title = document.getElementById('user-jobs-modal-title').textContent;
        if(title.includes('Created by')) {
            const userName = title.replace('Job Files Created by ', '');
            showUserJobs(userName);
        } else if (title.includes('Salesman')) {
             const salesmanName = title.replace('Job Files for Salesman: ', '');
             showSalesmanJobs(salesmanName);
        } else if (title.includes('for')) {
            const month = title.replace('Job Files for ', '');
            const dateType = document.getElementById('analytics-date-type')?.value || 'bd';
            showMonthlyJobs(month, dateType);
        } else if (title.includes(' - ')) {
            const status = title.split(' - ')[1].toLowerCase();
            showStatusJobs(status);
        }
    }
}


// --- Main Form UI ---

export function clearForm() {
    const form = document.querySelector('#main-container');
    form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(input => input.value = '');
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('job-file-no').disabled = false;
    populateTable(); // This creates the table structure and adds initial rows
    calculate();
    
    const currentUser = getCurrentUser();
    document.getElementById('prepared-by').value = currentUser.displayName;
    
    document.getElementById('created-by-info').textContent = '';
    document.getElementById('last-updated-by-info').textContent = '';

    document.getElementById('approved-by').value = '';
    document.getElementById('checked-by').value = '';
    
    ['checked-stamp', 'approved-stamp', 'rejected-stamp', 'rejection-banner'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    
    const isChecker = ['admin', 'checker'].includes(currentUser.role);
    const isAdmin = currentUser.role === 'admin';
    document.getElementById('check-btn').style.display = isChecker ? 'block' : 'none';
    document.getElementById('approval-buttons').style.display = isAdmin ? 'flex' : 'none';

    showNotification("Form cleared. Ready for a new job file.");
}

export function populateFormFromData(data) {
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
    
    // Reset all status indicators
    ['checked-stamp', 'approved-stamp', 'rejected-stamp', 'rejection-banner'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('check-btn').style.display = 'none';
    document.getElementById('approval-buttons').style.display = 'none';

    setVal('checked-by', data.checkedBy ? `${data.checkedBy} on ${data.checkedAt?.toDate().toLocaleDateString()}` : 'Pending Check');
    if (data.checkedBy) document.getElementById('checked-stamp').style.display = 'block';
    
    if (data.status === 'approved') {
        setVal('approved-by', `${data.approvedBy} on ${data.approvedAt?.toDate().toLocaleDateString()}`);
        document.getElementById('approved-stamp').style.display = 'block';
    } else if (data.status === 'rejected') {
        setVal('approved-by', `Rejected by ${data.rejectedBy}`);
        document.getElementById('rejected-stamp').style.display = 'block';
        document.getElementById('rejection-banner').style.display = 'block';
        document.getElementById('rejection-reason').textContent = data.rejectionReason;
    } else {
        setVal('approved-by', 'Pending Approval');
    }

    const currentUser = getCurrentUser();
    if (currentUser.role === 'admin' && data.status !== 'approved' && data.status !== 'rejected') {
        document.getElementById('approval-buttons').style.display = 'flex';
    }
    if (['admin', 'checker'].includes(currentUser.role) && !data.checkedBy) {
         document.getElementById('check-btn').style.display = 'block';
    }

    setChecked('clearance', data.cl);
    setChecked('product', data.pt);

    populateTable();
    document.getElementById('charges-table-body').innerHTML = ''; // Clear default rows
    if (data.ch && data.ch.length > 0) {
        data.ch.forEach(charge => addChargeRow(charge));
    } else {
        for(let i=0; i<5; i++) addChargeRow(); // Add empty rows
    }
    calculate();
}


// --- Charges Table ---

export function populateTable() {
    const table = document.getElementById('charges-table');
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

    document.getElementById('charges-table-body').addEventListener('input', e => {
        if (e.target.classList.contains('cost-input') || e.target.classList.contains('selling-input')) {
            calculate();
        }
    });
    // Add initial empty rows
    for(let i=0; i<5; i++) addChargeRow();
}

export function addChargeRow(data = {}) {
    const tableBody = document.getElementById('charges-table-body');
    const newRow = document.createElement('tr');

    newRow.innerHTML = `
        <td class="table-cell"><input type="text" class="description-input input-field" value="${data.l || ''}" autocomplete="off"></td>
        <td class="table-cell"><input type="number" step="0.001" class="cost-input input-field" value="${data.c || ''}"></td>
        <td class="table-cell"><input type="number" step="0.001" class="selling-input input-field" value="${data.s || ''}"></td>
        <td class="table-cell profit-output bg-gray-50 text-right">${((data.s || 0) - (data.c || 0)).toFixed(3)}</td>
        <td class="table-cell"><input type="text" class="notes-input input-field" value="${data.n || ''}"></td>
        <td class="table-cell text-center"><button class="text-red-500 hover:text-red-700">&times;</button></td>
    `;

    const descriptionInput = newRow.querySelector('.description-input');
    setupChargeAutocomplete(descriptionInput);
    
    const deleteButton = newRow.querySelector('button');
    deleteButton.addEventListener('click', () => {
        newRow.remove();
        calculate();
    });

    tableBody.appendChild(newRow);
}

export function calculate() {
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


// --- Auth UI ---
export function toggleAuthView(showLogin) {
    const nameField = document.getElementById('signup-name-field');
    const emailField = document.getElementById('email-address');
    
    document.getElementById('auth-title').textContent = showLogin ? 'Sign in to your account' : 'Create a new account';
    document.getElementById('auth-btn').textContent = showLogin ? 'Sign in' : 'Sign up';
    document.getElementById('auth-link').textContent = showLogin ? 'Create a new account' : 'Already have an account? Sign in';
    nameField.style.display = showLogin ? 'none' : 'block';
    emailField.classList.toggle('rounded-t-md', !showLogin);
    document.getElementById('approval-message').style.display = 'none';
}


// --- Status Summary & File Manager ---

export function updateStatusSummary(targetId, dataSource) {
    const approvedCount = dataSource.filter(file => file.status === 'approved').length;
    const rejectedCount = dataSource.filter(file => file.status === 'rejected').length;
    const checkedCount = dataSource.filter(file => file.status === 'checked').length;
    const pendingCount = dataSource.filter(file => file.status === 'pending' || !file.status).length;

    const summaryHtml = `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div onclick="showStatusJobs('approved')" class="bg-green-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-green-800">Approved</p><p class="text-2xl font-bold text-green-900">${approvedCount}</p></div>
            <div onclick="showStatusJobs('rejected')" class="bg-red-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-red-800">Rejected</p><p class="text-2xl font-bold text-red-900">${rejectedCount}</p></div>
            <div onclick="showStatusJobs('checked')" class="bg-blue-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-blue-800">Checked</p><p class="text-2xl font-bold text-blue-900">${checkedCount}</p></div>
            <div onclick="showStatusJobs('pending')" class="bg-yellow-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-yellow-800">Pending</p><p class="text-2xl font-bold text-yellow-900">${pendingCount}</p></div>
        </div>
    `;
    document.getElementById(targetId).innerHTML = summaryHtml;
}

export function displayJobFiles(files) {
    const list = document.getElementById('job-files-list');
    const currentUser = getCurrentUser();
    if (files.length === 0) {
         list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files match the current filters.</p>`;
         return;
    }
    let filesHtml = '';
    files.forEach((docData) => {
        const deleteButton = currentUser.role === 'admin' ? `<button onclick="confirmDelete('${docData.id}', 'jobfile')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Delete</button>` : '';
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

export function applyFiltersAndDisplay() {
    const jobFilesCache = getJobFilesCache();
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const fromDate = document.getElementById('filter-date-from').value;
    const toDate = document.getElementById('filter-date-to').value;

    let filteredFiles = jobFilesCache.filter(file => {
        const searchData = [file.jfn, file.sh, file.co].join(' ').toLowerCase();
        if (searchTerm && !searchData.includes(searchTerm)) return false;
        if (statusFilter && file.status !== statusFilter) return false;
        if (fromDate && file.d < fromDate) return false;
        if (toDate && file.d > toDate) return false;
        return true;
    });

    displayJobFiles(filteredFiles);
}


// --- User Activity Log ---
export function logUserActivity(jobFileNo) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const logEntry = {
        user: currentUser.displayName,
        file: jobFileNo,
        timestamp: new Date().toISOString()
    };

    let logs = [];
    try {
        const storedLogs = localStorage.getItem('userActivityLog');
        if (storedLogs) logs = JSON.parse(storedLogs);
    } catch (e) {
        console.error("Error parsing user activity log from localStorage", e);
        logs = [];
    }

    logs.unshift(logEntry);
    if (logs.length > 200) logs.splice(200);
    localStorage.setItem('userActivityLog', JSON.stringify(logs));
}

export function openUserActivityLog() {
    const logBody = document.getElementById('activity-log-body');
    let logs = [];
    try {
        const storedLogs = localStorage.getItem('userActivityLog');
        if (storedLogs) logs = JSON.parse(storedLogs);
    } catch (e) {
        console.error("Error parsing user activity log from localStorage", e);
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


// --- Printing ---

export function printPage() {
    const { getFormData } = import('./firestore.js');
    const data = getFormData();
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
    
    window.addEventListener('afterprint', () => {
        document.getElementById('main-container').style.display = 'block';
        document.getElementById('print-output').style.display = 'none';
    }, { once: true });
    
    setTimeout(() => { window.print(); }, 500);
}

export function printPreview() {
    const previewBody = document.getElementById('preview-body').innerHTML;
    createPrintWindow('Job File Preview', `
        <style>
            body { padding: 0; margin: 0; background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
        </style>
        </head><body>
        ${previewBody}
    `);
}

export async function previewJobFileById(docId) {
    showLoader();
    const db = getDb();
    try {
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const previewBody = document.getElementById('preview-body');
            previewBody.innerHTML = getPrintViewHtml(data, false); 
            
            const qrContainer = previewBody.querySelector('.qrcode-container');
            if (qrContainer && data.jfn) {
                qrContainer.innerHTML = '';
                const baseUrl = window.location.href.split('?')[0];
                const qrText = `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`;
                new QRCode(qrContainer, { text: qrText, width: 96, height: 96, correctLevel: QRCode.CorrectLevel.H });
            }
            openModal('preview-modal', true);
        } else {
            showNotification("Document not found.", true);
        }
        hideLoader();
    } catch (error) {
        hideLoader();
        console.error("Error previewing document:", error);
        showNotification("Error previewing job file.", true);
    }
}

function createPrintWindow(title, content) {
    let styles = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
        styles += el.outerHTML;
    });

    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write(`<html><head><title>${title}</title>`);
    printWindow.document.write(styles);
    printWindow.document.write('</head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 750);
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


// --- Analytics ---

export function openAnalyticsDashboard() {
    const jobFilesCache = getJobFilesCache();
    const dateType = document.getElementById('analytics-date-type')?.value || 'bd';
    filterAnalyticsByTimeframe('all', dateType);
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('analytics-container').style.display = 'block';
    window.scrollTo(0, 0);
}

export function closeAnalyticsDashboard() {
    document.getElementById('analytics-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
}

function filterAnalyticsByTimeframe(timeframe, dateType = 'bd') {
    const jobFilesCache = getJobFilesCache();
    let filteredJobs = jobFilesCache;
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    if (timeframe !== 'all') {
        filteredJobs = jobFilesCache.filter(job => {
            const dateField = dateType === 'bd' ? job.bd : job.d;
            if (!dateField) return false;
            const jobDate = new Date(dateField);
            if (timeframe === 'thisYear') return jobDate.getFullYear() === currentYear;
            if (timeframe === 'lastYear') return jobDate.getFullYear() === lastYear;
            if (timeframe.includes('-')) { // Monthly filter like '2025-01'
                const [year, month] = timeframe.split('-').map(Number);
                return jobDate.getFullYear() === year && jobDate.getMonth() === month - 1;
            }
            return true;
        });
    }
    setCurrentFilteredJobs(filteredJobs);
    calculateAndDisplayAnalytics(filteredJobs);
}

function calculateAndDisplayAnalytics(jobs) {
    const body = document.getElementById('analytics-body');
     if (jobs.length === 0) {
         body.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center justify-center gap-4">
                 <label for="analytics-date-type" class="text-sm font-medium">Report Date Type:</label>
                 <select id="analytics-date-type" class="input-field w-auto">
                     <option value="bd">Billing Date</option>
                     <option value="d">Opening Date</option>
                 </select>
            </div>
            <div class="flex justify-center flex-wrap gap-2">
                <button data-timeframe="all" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">All Time</button>
                <button data-timeframe="thisYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">This Year</button>
                <button data-timeframe="lastYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">Last Year</button>
            </div>
        </div>
         <p class="text-center text-gray-500 mt-8">No data available for the selected period.</p>`;
        
         attachAnalyticsTimeframeListeners();
         return;
    }

    let totalJobs = jobs.length;
    let totalRevenue = 0, totalCost = 0, totalProfit = 0;
    const profitByFile = [], profitByShipper = {}, profitByConsignee = {}, monthlyStatsByBilling = {}, monthlyStatsByOpening = {}, profitByUser = {}, profitBySalesman = {};

    jobs.forEach(job => {
        const profit = job.totalProfit || 0, revenue = job.totalSelling || 0, cost = job.totalCost || 0;
        const creator = job.createdBy || 'Unknown', salesman = job.sm || 'N/A';
        let status = 'Pending Check';
        if (job.status === 'rejected') status = 'Rejected';
        else if (job.status === 'approved') status = 'Approved';
        else if (job.status === 'checked') status = 'Checked';

        totalRevenue += revenue; totalCost += cost; totalProfit += profit;
        profitByFile.push({ id: job.id, jfn: job.jfn, shipper: job.sh, consignee: job.co, profit: profit, status: status, date: job.updatedAt?.toDate() || new Date(0), cost: cost, dsc: job.dsc, mawb: job.mawb, createdBy: creator });
        if (job.sh) profitByShipper[job.sh] = (profitByShipper[job.sh] || 0) + profit;
        if (job.co) profitByConsignee[job.co] = (profitByConsignee[job.co] || 0) + profit;
        if (job.bd) { const month = job.bd.substring(0, 7); if (!monthlyStatsByBilling[month]) monthlyStatsByBilling[month] = { profit: 0, count: 0, jobs: [] }; monthlyStatsByBilling[month].profit += profit; monthlyStatsByBilling[month].count++; monthlyStatsByBilling[month].jobs.push(job); }
        if (job.d) { const month = job.d.substring(0, 7); if (!monthlyStatsByOpening[month]) monthlyStatsByOpening[month] = { profit: 0, count: 0, jobs: [] }; monthlyStatsByOpening[month].profit += profit; monthlyStatsByOpening[month].count++; monthlyStatsByOpening[month].jobs.push(job); }
        if (!profitByUser[creator]) profitByUser[creator] = { count: 0, profit: 0, jobs: [] };
        profitByUser[creator].count++; profitByUser[creator].profit += profit; profitByUser[creator].jobs.push(job);
        if (salesman !== 'N/A') { if (!profitBySalesman[salesman]) profitBySalesman[salesman] = { count: 0, profit: 0, jobs: [] }; profitBySalesman[salesman].count++; profitBySalesman[salesman].profit += profit; profitBySalesman[salesman].jobs.push(job); }
    });

    const analyticsData = {
        totalJobs, totalRevenue, totalCost, totalProfit, profitByFile,
        profitByShipper: Object.entries(profitByShipper).sort((a, b) => b[1] - a[1]),
        profitByConsignee: Object.entries(profitByConsignee).sort((a, b) => b[1] - a[1]),
        monthlyStatsByBilling: Object.entries(monthlyStatsByBilling).sort((a, b) => a[0].localeCompare(b[0])),
        monthlyStatsByOpening: Object.entries(monthlyStatsByOpening).sort((a, b) => a[0].localeCompare(b[0])),
        profitByUser: Object.entries(profitByUser).sort((a, b) => b[1].profit - a[1].profit),
        profitBySalesman: Object.entries(profitBySalesman).sort((a, b) => b[1].profit - a[1].profit)
    };
    setAnalyticsDataCache(analyticsData);
    displayAnalytics(analyticsData);
}

function attachAnalyticsTimeframeListeners() {
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
         btn.addEventListener('click', (e) => {
             document.querySelectorAll('.timeframe-btn').forEach(b => { b.classList.remove('bg-indigo-700', 'text-white'); if(!b.classList.contains('bg-gray-200')) b.classList.add('bg-indigo-500'); });
             e.target.classList.remove('bg-indigo-500', 'bg-gray-200'); e.target.classList.add('bg-indigo-700', 'text-white');
            const timeframe = e.target.dataset.timeframe;
            const dateType = document.getElementById('analytics-date-type').value;
            filterAnalyticsByTimeframe(timeframe, dateType);
        });
    });
    document.getElementById('analytics-date-type').addEventListener('change', (e) => {
          const activeTimeframeButton = document.querySelector('.timeframe-btn.bg-indigo-700') || document.querySelector('[data-timeframe="all"]');
          filterAnalyticsByTimeframe(activeTimeframeButton.dataset.timeframe, e.target.value);
     });
}

function displayAnalytics(data, sortBy = 'profit-desc', searchTerm = '', monthlyReportType = 'billing') {
    const body = document.getElementById('analytics-body');
    const currentUser = getCurrentUser();
    
    let filteredFiles = data.profitByFile;
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        filteredFiles = data.profitByFile.filter(file => (file.jfn || '').toLowerCase().includes(lowerCaseSearchTerm) || (file.shipper || '').toLowerCase().includes(lowerCaseSearchTerm) || (file.consignee || '').toLowerCase().includes(lowerCaseSearchTerm) || (file.mawb || '').toLowerCase().includes(lowerCaseSearchTerm) || (file.createdBy || '').toLowerCase().includes(lowerCaseSearchTerm));
    }
    
    const monthlyStats = monthlyReportType === 'billing' ? data.monthlyStatsByBilling : data.monthlyStatsByOpening;
    const monthlyReportTitle = monthlyReportType === 'billing' ? 'Profit By Month (Billing Date)' : 'Profit By Month (Opening Date)';

    const now = new Date();
    const currentYear = now.getFullYear();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthButtons = months.map((month, i) => `<button data-timeframe="${currentYear}-${String(i + 1).padStart(2, '0')}" class="timeframe-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded text-sm">${month}</button>`).join('');

    const sortedFiles = [...filteredFiles];
    if (sortBy === 'profit-desc') sortedFiles.sort((a, b) => b.profit - a.profit);
    else if (sortBy === 'date-desc') sortedFiles.sort((a, b) => b.date - a.date);
    else if (sortBy === 'status') { const statusOrder = { 'Pending Check': 1, 'Checked': 2, 'Approved': 3, 'Rejected': 4 }; sortedFiles.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99)); }
    else if (sortBy === 'user') sortedFiles.sort((a, b) => (a.createdBy || '').localeCompare(b.createdBy || ''));

    body.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center justify-center gap-4">
                 <label for="analytics-date-type" class="text-sm font-medium">Report Date Type:</label>
                 <select id="analytics-date-type" class="input-field w-auto">
                     <option value="bd" ${monthlyReportType === 'bd' ? 'selected' : ''}>Billing Date</option>
                     <option value="d" ${monthlyReportType === 'd' ? 'selected' : ''}>Opening Date</option>
                 </select>
            </div>
            <div class="flex justify-center flex-wrap gap-2">
                <button data-timeframe="all" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">All Time</button>
                <button data-timeframe="thisYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">This Year</button>
                <button data-timeframe="lastYear" class="timeframe-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded">Last Year</button>
            </div>
            <div class="flex justify-center flex-wrap gap-1">${monthButtons}</div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center mt-6">
            <div class="bg-gray-100 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Jobs</p><p class="text-2xl font-bold">${data.totalJobs}</p></div>
            <div class="bg-blue-100 p-4 rounded-lg"><p class="text-sm text-blue-800">Total Revenue</p><p class="text-2xl font-bold text-blue-900">KD ${data.totalRevenue.toFixed(3)}</p></div>
            <div class="bg-red-100 p-4 rounded-lg"><p class="text-sm text-red-800">Total Cost</p><p class="text-2xl font-bold text-red-900">KD ${data.totalCost.toFixed(3)}</p></div>
            <div class="bg-green-100 p-4 rounded-lg"><p class="text-sm text-green-800">Total Profit</p><p class="text-2xl font-bold text-green-900">KD ${data.totalProfit.toFixed(3)}</p></div>
        </div>
         <div class="bg-white p-4 rounded-lg shadow-sm"><div style="position: relative; height:300px;"><canvas id="profit-chart"></canvas></div></div>
        <div id="analytics-tables" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div><h4 class="text-lg font-semibold mb-2">Top Profitable Shippers</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Shipper</th><th>Total Profit</th></tr></thead><tbody>${data.profitByShipper.slice(0, 5).map(([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`).join('')}</tbody></table></div></div>
            <div><h4 class="text-lg font-semibold mb-2">Top Profitable Consignees</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Consignee</th><th>Total Profit</th></tr></thead><tbody>${data.profitByConsignee.slice(0, 5).map(([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`).join('')}</tbody></table></div></div>
             <div><h4 class="text-lg font-semibold mb-2">Top Salesmen by Profit</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Salesman</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead><tbody>${data.profitBySalesman.slice(0, 5).map(([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-salesman-jobs" data-salesman="${name}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div></div>
            <div class="lg:col-span-3"><h4 class="text-lg font-semibold mb-2">${monthlyReportTitle}</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Month</th><th>Total Jobs</th><th>Total Profit / Loss</th><th>Actions</th></tr></thead><tbody>${monthlyStats.map(([month, stats]) => `<tr><td>${month}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-monthly-jobs" data-month="${month}" data-datetype="${monthlyReportType}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div></div>
             <div class="lg:col-span-3"><h4 class="text-lg font-semibold mb-2">Top Users by Profit</h4><div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>User</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead><tbody>${data.profitByUser.map(([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-user-jobs" data-user="${name}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div></div>
        </div>
        <div>
            <div class="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
                <h4 class="text-lg font-semibold">Job File Details</h4>
                <div class="flex items-center gap-2 flex-grow">
                    <input type="text" id="analytics-search-bar" class="input-field w-full sm:w-auto flex-grow" placeholder="Search files..." value="${searchTerm}">
                    <select id="sort-analytics" class="input-field w-auto inline-block text-sm">
                        <option value="profit-desc" ${sortBy === 'profit-desc' ? 'selected' : ''}>Profit (High to Low)</option>
                        <option value="date-desc" ${sortBy === 'date-desc' ? 'selected' : ''}>Date (Newest First)</option>
                        <option value="status" ${sortBy === 'status' ? 'selected' : ''}>Status</option>
                        <option value="user" ${sortBy === 'user' ? 'selected' : ''}>User</option>
                    </select>
                    <button id="download-csv-btn" class="bg-gray-700 hover:bg-gray-800 text-white font-bold py-1 px-3 rounded text-sm">CSV</button>
                </div>
            </div>
            <div class="max-h-96 overflow-y-auto"><table class="analytics-table w-full text-sm"><thead><tr><th>Job Details</th><th>Cost / Profit</th><th>Status</th><th>Actions</th></tr></thead><tbody>${sortedFiles.length > 0 ? sortedFiles.map(file => `<tr><td><p class="font-bold">${file.jfn || file.id}</p><p class="text-xs">Shipper: ${file.shipper || 'N/A'}</p><p class="text-xs">Consignee: ${file.consignee || 'N/A'}</p><p class="text-xs text-gray-600">AWB/MAWB: ${file.mawb || 'N/A'}</p><p class="text-xs text-gray-600">Desc: ${file.dsc || 'N/A'}</p><p class="text-xs font-bold mt-1">Created by: ${file.createdBy || 'N/A'}</p></td><td><p class="font-bold text-green-600">KD ${file.profit.toFixed(3)}</p><p class="text-xs text-red-600">Cost: KD ${file.cost.toFixed(3)}</p></td><td>${file.status}</td><td class="space-x-1"><button onclick="previewJobFileById('${file.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs">Preview</button><button onclick="loadJobFileById('${file.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-xs">Load</button>${currentUser.role === 'admin' ? `<button onclick="confirmDelete('${file.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Delete</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="4" class="text-center py-4">No files match your search.</td></tr>`}</tbody></table></div>
        </div>`;
    
    renderProfitChart(data, monthlyReportType);
    
    document.getElementById('analytics-search-bar').addEventListener('input', (e) => displayAnalytics(getAnalyticsDataCache(), document.getElementById('sort-analytics').value, e.target.value, document.getElementById('analytics-date-type').value));
    document.getElementById('sort-analytics').addEventListener('change', (e) => displayAnalytics(getAnalyticsDataCache(), e.target.value, document.getElementById('analytics-search-bar').value, document.getElementById('analytics-date-type').value));
    document.getElementById('download-csv-btn').addEventListener('click', downloadAnalyticsCsv);
    attachAnalyticsTimeframeListeners();
    document.getElementById('analytics-tables').addEventListener('click', (e) => {
        const target = e.target;
        if (target.tagName === 'BUTTON' && target.dataset.action) {
            const action = target.dataset.action;
            if (action === 'view-user-jobs') showUserJobs(target.dataset.user);
            else if (action === 'view-monthly-jobs') showMonthlyJobs(target.dataset.month, target.dataset.datetype);
            else if (action === 'view-salesman-jobs') showSalesmanJobs(target.dataset.salesman);
        }
    });
}

function renderProfitChart(data, monthlyReportType) {
    const profitChart = getProfitChartInstance();
    if (profitChart) profitChart.destroy();

    const ctx = document.getElementById('profit-chart')?.getContext('2d');
    if (!ctx) return;
    
    const monthlyStats = monthlyReportType === 'billing' ? data.monthlyStatsByBilling : data.monthlyStatsByOpening;
    const currentFilteredJobs = getCurrentFilteredJobs();
    
    let year;
    if (currentFilteredJobs.length > 0) {
         const dateField = monthlyReportType === 'billing' ? currentFilteredJobs[0].bd : currentFilteredJobs[0].d;
         if(dateField) year = new Date(dateField).getFullYear();
    }
    if (!year) year = new Date().getFullYear();

    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const profits = Array(12).fill(0);
    monthlyStats.forEach(([monthStr, stats]) => { const [statYear, statMonth] = monthStr.split('-').map(Number); if (statYear === year) profits[statMonth - 1] = stats.profit; });
    const maxProfit = Math.max(...profits.map(p => Math.abs(p)));
    const backgroundColors = profits.map(p => { const alpha = Math.max(0.2, Math.abs(p) / (maxProfit || 1)); return p >= 0 ? `rgba(75, 192, 192, ${alpha})` : `rgba(255, 99, 132, ${alpha})`; });

    const newChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: `Monthly Profit for ${year}`, data: profits, backgroundColor: backgroundColors, borderColor: backgroundColors.map(c => c.replace(/0\.\d+\)/, '1)')), borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: (value) => 'KD ' + value } } }, plugins: { tooltip: { callbacks: { label: (context) => `KD ${context.parsed.y.toFixed(3)}` } } } }
    });
    setProfitChartInstance(newChartInstance);
}

function downloadAnalyticsCsv() {
    const analyticsData = getAnalyticsDataCache();
    if (!analyticsData) return;
    let csvContent = "data:text/csv;charset=utf-8,Job File ID,Shipper,Consignee,Profit,Status,Cost,Description,AWB/MAWB,Created By\n";
    const sortedFiles = [...analyticsData.profitByFile].sort((a,b) => (b.profit || 0) - (a.profit || 0));
    sortedFiles.forEach(job => {
        const rowData = [job.jfn, job.shipper || 'N/A', job.consignee || 'N/A', (job.profit || 0).toFixed(3), job.status, (job.cost || 0).toFixed(3), job.dsc || 'N/A', job.mawb || 'N/A', job.createdBy || 'N/A'];
        csvContent += rowData.map(d => `"${String(d).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "job_file_analytics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- Admin Panel UI ---

export async function openAdminPanel() {
    if (getCurrentUser().role !== 'admin') { showNotification("Access denied.", true); return; }
    showLoader();
    const db = getDb();
    const usersCollectionRef = collection(db, 'users');
    const userQuerySnapshot = await getDocs(usersCollectionRef);
    const userListDiv = document.getElementById('user-list');
    let userListHtml = '';

    userQuerySnapshot.forEach(doc => {
        const userData = doc.data();
        const userId = doc.id;
        const isCurrentUser = userId === getCurrentUser().uid;
        userListHtml += `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center p-2 border-b">
                <input type="text" data-uid="${userId}" class="display-name-input input-field col-span-1" value="${userData.displayName}" ${isCurrentUser ? 'disabled' : ''}>
                <select data-uid="${userId}" class="role-select input-field col-span-1" ${isCurrentUser ? 'disabled' : ''}>
                    <option value="user" ${userData.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="checker" ${userData.role === 'checker' ? 'selected' : ''}>Checker</option>
                    <option value="driver" ${userData.role === 'driver' ? 'selected' : ''}>Driver</option>
                    <option value="warehouse_supervisor" ${userData.role === 'warehouse_supervisor' ? 'selected' : ''}>Warehouse Supervisor</option>
                    <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <select data-uid="${userId}" class="status-select input-field col-span-1" ${isCurrentUser ? 'disabled' : ''}>
                    <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${userData.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    <option value="blocked" ${userData.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                </select>
            </div>
        `;
    });
    userListDiv.innerHTML = userListHtml;
    hideLoader();
    openModal('admin-panel-modal');
}

export async function saveUserChanges() {
    showLoader();
    const db = getDb();
    const batch = writeBatch(db);
    document.querySelectorAll('#user-list > div').forEach(row => {
        const nameInput = row.querySelector('.display-name-input');
        if (nameInput.disabled) return;
        const uid = nameInput.dataset.uid;
        const userDocRef = doc(db, 'users', uid);
        batch.update(userDocRef, { 
            displayName: nameInput.value,
            role: row.querySelector('.role-select').value,
            status: row.querySelector('.status-select').value
        });
    });

    try {
        await batch.commit();
        hideLoader();
        showNotification("User details updated successfully!");
        closeModal('admin-panel-modal');
    } catch (error) {
        hideLoader();
        console.error("Error updating roles: ", error);
        showNotification("Failed to update user details.", true);
    }
}


// --- Client Manager ---
export function openClientManager() { openModal('client-manager-modal'); }

export function clearClientForm() {
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-form-title').textContent = 'Add New Client';
}

export function displayClients(clients) {
    const list = document.getElementById('client-list');
    if (clients.length === 0) { list.innerHTML = `<p class="text-gray-500 text-center p-4">No clients found.</p>`; return; }
    list.innerHTML = clients.map(client => `
        <div class="client-item border p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
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

export function editClient(clientId) {
    const clientsCache = getClientsCache();
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

// And so on for other UI functions...
// It is crucial to export every function that is called from another module.
// ... (rest of the UI functions from data.html)
