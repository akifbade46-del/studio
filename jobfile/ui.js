import {
    currentUser,
    jobFilesCache,
    clientsCache,
    chargeDescriptions,
    analyticsDataCache,
    setChargeDescriptions,
    setFileIdToReject,
    setCurrentFilteredJobs,
    setAnalyticsDataCache,
    setProfitChartInstance,
    profitChartInstance
} from './state.js';
import {
    loadJobFileById,
    deleteClient,
    moveToRecycleBin,
    permanentlyDeleteJobFile,
    restoreJobFile,
    saveJobFile,
    checkJobFile,
    approveJobFile,
    rejectJobFile,
    saveClient
} from './firestore.js';

// --- UI Initialization ---
let appEventListenersAdded = false;

// --- View Toggling ---
export function showLogin() {
    window.location.href = 'index.html';
}

// --- Modals ---
export function openModal(id, keepParent = false) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (keepParent) {
        const highestZ = Array.from(document.querySelectorAll('.overlay.visible'))
            .reduce((max, el) => Math.max(max, parseInt(window.getComputedStyle(el).zIndex, 10) || 1000), 1000);
        modal.style.zIndex = highestZ + 1;
    }
    modal.classList.add('visible');
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('visible');
}

// --- Notifications & Loaders ---
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

// --- Form & Table Management ---
export function clearForm() {
    const form = document.querySelector('#main-container');
    if (form) {
        form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(input => input.value = '');
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    }
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.valueAsDate = new Date();
    
    const jobFileNoEl = document.getElementById('job-file-no');
    if (jobFileNoEl) jobFileNoEl.disabled = false;

    populateTable();

    if (currentUser) {
        document.getElementById('prepared-by').value = currentUser.displayName;
    }
    
    ['created-by-info', 'last-updated-by-info', 'approved-by', 'checked-by'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.textContent = '';
    });
    ['checked-stamp', 'approved-stamp', 'rejected-stamp', 'rejection-banner'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });

    const checkBtn = document.getElementById('check-btn');
    if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Job File';
        const isChecker = currentUser && ['admin', 'checker'].includes(currentUser.role);
        checkBtn.style.display = isChecker ? 'block' : 'none';
    }
    const approvalButtons = document.getElementById('approval-buttons');
    if (approvalButtons) {
        const isAdmin = currentUser && currentUser.role === 'admin';
        approvalButtons.style.display = isAdmin ? 'flex' : 'none';
        approvalButtons.querySelectorAll('button').forEach(btn => btn.disabled = false);
    }
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
    
    ['checked-stamp', 'approved-stamp', 'rejected-stamp', 'rejection-banner'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById('check-btn').style.display = 'none';
    document.getElementById('approval-buttons').style.display = 'none';

    const checkBtn = document.getElementById('check-btn');
    if (data.checkedBy) {
        setVal('checked-by', `${data.checkedBy} on ${data.checkedAt?.toDate().toLocaleDateString() || ''}`);
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checked';
        document.getElementById('checked-stamp').style.display = 'block';
    } else {
        setVal('checked-by', 'Pending Check');
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Job File';
    }

    if (data.status === 'approved') {
        setVal('approved-by', `${data.approvedBy} on ${data.approvedAt?.toDate().toLocaleDateString() || ''}`);
        document.getElementById('approved-stamp').style.display = 'block';
    } else if (data.status === 'rejected') {
        setVal('approved-by', `Rejected by ${data.rejectedBy} on ${data.rejectedAt?.toDate().toLocaleDateString() || ''}`);
        document.getElementById('rejected-stamp').style.display = 'block';
        document.getElementById('rejection-banner').style.display = 'block';
        document.getElementById('rejection-reason').textContent = data.rejectionReason;
    } else {
        setVal('approved-by', 'Pending Approval');
    }

    if (currentUser.role === 'admin' && !['approved', 'rejected'].includes(data.status)) {
        document.getElementById('approval-buttons').style.display = 'flex';
    }
    if (['admin', 'checker'].includes(currentUser.role) && !data.checkedBy) {
        document.getElementById('check-btn').style.display = 'block';
    }

    setChecked('clearance', data.cl);
    setChecked('product', data.pt);

    populateTable();
    if (data.ch && data.ch.length > 0) {
        document.getElementById('charges-table-body').innerHTML = '';
        data.ch.forEach(charge => addChargeRow(charge));
    } else {
        for(let i=0; i<5; i++) addChargeRow();
    }
    calculate();
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

export function populateTable() {
    document.getElementById('charges-table').innerHTML = `
        <thead><tr class="bg-gray-100">
            <th class="table-cell font-semibold w-2/5">Description</th><th class="table-cell font-semibold">Cost</th>
            <th class="table-cell font-semibold">Selling</th><th class="table-cell font-semibold">Profit</th>
            <th class="table-cell font-semibold">Notes</th><th class="table-cell font-semibold"></th>
        </tr></thead>
        <tbody id="charges-table-body"></tbody>
        <tfoot><tr id="total-row" class="bg-gray-100 font-bold">
            <td class="table-cell text-right">TOTAL:</td><td id="total-cost" class="table-cell text-right">0.000</td>
            <td id="total-selling" class="table-cell text-right">0.000</td><td id="total-profit" class="table-cell text-right">0.000</td>
            <td class="table-cell" colspan="2"></td>
        </tr></tfoot>`;
    document.getElementById('charges-table-body').addEventListener('input', e => {
        if (e.target.classList.contains('cost-input') || e.target.classList.contains('selling-input')) {
            calculate();
        }
    });
    for(let i=0; i<5; i++) addChargeRow();
    calculate();
}

export function addChargeRow(data = {}) {
    const tableBody = document.getElementById('charges-table-body');
    const newRow = tableBody.insertRow();
    newRow.innerHTML = `
        <td class="table-cell"><input type="text" class="description-input input-field" value="${data.l || ''}" autocomplete="off"></td>
        <td class="table-cell"><input type="number" step="0.001" class="cost-input input-field" value="${data.c || ''}"></td>
        <td class="table-cell"><input type="number" step="0.001" class="selling-input input-field" value="${data.s || ''}"></td>
        <td class="table-cell profit-output bg-gray-50 text-right">${((data.s || 0) - (data.c || 0)).toFixed(3)}</td>
        <td class="table-cell"><input type="text" class="notes-input input-field" value="${data.n || ''}"></td>
        <td class="table-cell text-center"><button class="text-red-500 hover:text-red-700">&times;</button></td>`;
    
    setupChargeAutocomplete(newRow.querySelector('.description-input'));
    newRow.querySelector('button').addEventListener('click', () => { newRow.remove(); calculate(); });
}

// --- Printing & Previews ---
export function printPage() {
    const data = getFormData();
    const printHTML = getPrintViewHtml(data, false);
    const printContainer = document.getElementById('print-output');
    printContainer.innerHTML = printHTML;
    const qrContainer = printContainer.querySelector('.qrcode-container');
    if (qrContainer && data.jfn) {
        qrContainer.innerHTML = '';
        const baseUrl = window.location.href.split('?')[0].replace('app.html', 'index.html');
        new QRCode(qrContainer, { text: `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`, width: 96, height: 96 });
    }
    document.getElementById('main-container').style.display = 'none';
    printContainer.style.display = 'block';
    setTimeout(() => { window.print(); }, 500);
}

export async function previewJobFileById(docId) {
    showLoader();
    try {
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('preview-body').innerHTML = getPrintViewHtml(data, false);
            const qrContainer = document.getElementById('preview-body').querySelector('.qrcode-container');
            if (qrContainer && data.jfn) {
                qrContainer.innerHTML = '';
                const baseUrl = window.location.href.split('?')[0].replace('app.html', 'index.html');
                new QRCode(qrContainer, { text: `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`, width: 96, height: 96 });
            }
            openModal('preview-modal', true);
        } else {
            showNotification("Document not found.", true);
        }
    } catch (error) {
        console.error("Error previewing document:", error);
    } finally {
        hideLoader();
    }
}

export function printPreview(){
    const previewBody = document.getElementById('preview-body').innerHTML;
    createPrintWindow('Job File Preview', previewBody);
}

function createPrintWindow(title, content) {
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('');
    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write(`<html><head><title>${title}</title>${styles}</head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 750);
}

function getPrintViewHtml(data, isPublicView = false) {
    const { totalCost = 0, totalSelling = 0, totalProfit = 0 } = data;
    const checkedByText = data.checkedBy ? `${data.checkedBy} on ${data.checkedAt?.toDate().toLocaleDateString()}` : 'Pending';
    let approvedByText = 'Pending Approval';
    if (data.status === 'approved') approvedByText = `${data.approvedBy} on ${data.approvedAt?.toDate().toLocaleDateString()}`;
    else if (data.status === 'rejected') approvedByText = `REJECTED: ${data.rejectionReason}`;
    const createdByText = data.createdBy ? `${data.createdBy} on ${data.createdAt?.toDate().toLocaleDateString()}` : (data.pb || 'N/A');
    const checkedStampHtml = data.checkedBy ? `<div class="stamp stamp-checked" style="display: block;">Checked</div>` : '';
    let approvalStampHtml = '';
    if (data.status === 'approved') approvalStampHtml = `<div class="stamp stamp-approved" style="display: block;">Approved</div>`;
    else if (data.status === 'rejected') approvalStampHtml = `<div class="stamp stamp-rejected" style="display: block;">Rejected</div>`;

    const qrContainerHtml = isPublicView ? '' : `<div class="col-span-3 bg-white p-1 flex items-center justify-center" style="border: 1px solid #374151;"><div class="qrcode-container"></div></div>`;
    return `
        <div class="border border-gray-700 p-2 bg-white">
            <div class="grid grid-cols-12 gap-px bg-gray-700" style="border: 1px solid #374151;">
                <div class="col-span-3 bg-white p-1 flex items-center" style="border: 1px solid #374151;"><img src="http://qgocargo.com/logo.png" alt="Q'go Cargo Logo" class="h-10"></div>
                <div class="col-span-6 bg-white flex items-center justify-center text-xl font-bold" style="border: 1px solid #374151;">JOB FILE</div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><div><strong>Date:</strong> ${data.d || ''}</div><div><strong>P.O. #:</strong> ${data.po || ''}</div></div>
                <div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Job File No.:</strong> ${data.jfn || ''}</div>
                <div class="col-span-12 bg-white p-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" style="border: 1px solid #374151;">
                    <div><strong>Clearance</strong><br>${(data.cl || []).includes('Export') ? '☑' : '☐'} Export<br>${(data.cl || []).includes('Import') ? '☑' : '☐'} Import<br>${(data.cl || []).includes('Clearance') ? '☑' : '☐'} Clearance<br>${(data.cl || []).includes('Local Move') ? '☑' : '☐'} Local Move</div>
                    <div><strong>Product Type</strong><br>${(data.pt || []).includes('Air Freight') ? '☑' : '☐'} Air<br>${(data.pt || []).includes('Sea Freight') ? '☑' : '☐'} Sea<br>${(data.pt || []).includes('Land Freight') ? '☑' : '☐'} Land<br>${(data.pt || []).includes('Others') ? '☑' : '☐'} Others</div>
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
                <div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Description:</strong><div class="print-field">${data.dsc || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Carrier/Line/Trucking:</strong><div class="print-field">${data.ca || ''}</div></div>
                <div class="col-span-6 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Truck/Driver:</strong><div class="print-field">${data.tn || ''}</div></div>
                <div class="col-span-4 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Vessel:</strong><div class="print-field">${data.vn || ''}</div></div>
                <div class="col-span-4 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Flight/Voyage:</strong><div class="print-field">${data.fv || ''}</div></div>
                <div class="col-span-4 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Container No:</strong><div class="print-field">${data.cn || ''}</div></div>
                <div class="col-span-12 bg-white p-0" style="border: 1px solid #374151;"><table class="print-table w-full text-xs"><thead><tr><th>Description</th><th>Cost</th><th>Selling</th><th>Profit</th><th>Notes</th></tr></thead><tbody>
                    ${(data.ch || []).map(c => `<tr><td>${c.l}</td><td>${c.c}</td><td>${c.s}</td><td>${(parseFloat(c.s || 0) - parseFloat(c.c || 0)).toFixed(3)}</td><td>${c.n}</td></tr>`).join('')}
                    <tr class="font-bold bg-gray-100"><td>TOTAL:</td><td>${totalCost.toFixed(3)}</td><td>${totalSelling.toFixed(3)}</td><td>${totalProfit.toFixed(3)}</td><td></td></tr>
                </tbody></table></div>
                <div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>REMARKS:</strong><div class="print-field h-20">${(data.re || '').replace(/\n/g, '<br>')}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>PREPARED BY:</strong><div class="print-field">${createdByText}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs relative" style="border: 1px solid #374151;">${checkedStampHtml}<strong>CHECKED BY:</strong><div class="print-field">${checkedByText}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs relative" style="border: 1px solid #374151;">${approvalStampHtml}<strong>APPROVED BY:</strong><div class="print-field">${approvedByText}</div></div>
                ${qrContainerHtml}
            </div>
        </div>`;
}

// --- File Manager & Filtering ---
export function applyFiltersAndDisplay() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const fromDate = document.getElementById('filter-date-from').value;
    const toDate = document.getElementById('filter-date-to').value;
    const filteredFiles = jobFilesCache.filter(file => 
        (!searchTerm || [file.jfn, file.sh, file.co].join(' ').toLowerCase().includes(searchTerm)) &&
        (!statusFilter || file.status === statusFilter) &&
        (!fromDate || file.d >= fromDate) &&
        (!toDate || file.d <= toDate)
    );
    displayJobFiles(filteredFiles);
}

export function displayJobFiles(files) {
    const list = document.getElementById('job-files-list');
    if (!list) return;
    if (files.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files match the current filters.</p>`;
        return;
    }
    list.innerHTML = files.map(docData => `
        <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2">
            <div class="text-center sm:text-left">
                <p class="font-bold text-indigo-700">${docData.jfn || 'No ID'}</p>
                <p class="text-sm text-gray-600">Shipper: ${docData.sh || 'N/A'} | Consignee: ${docData.co || 'N/A'}</p>
                <p class="text-xs text-gray-400">Last Updated: ${docData.updatedAt?.toDate().toLocaleString() || 'N/A'}</p>
            </div>
            <div class="space-x-2 flex-shrink-0">
                <button onclick="previewJobFileById('${docData.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">Preview</button>
                <button onclick="loadJobFileById('${docData.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-sm">Load</button>
                ${currentUser.role === 'admin' ? `<button onclick="confirmDelete('${docData.id}', 'jobfile')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Delete</button>` : ''}
            </div>
        </div>`).join('');
}


// --- Client Management ---
export function openClientManager() { openModal('client-manager-modal'); }
export function displayClients(clients) {
    const list = document.getElementById('client-list');
    if (!list) return;
    list.innerHTML = clients.length === 0 ? `<p class="text-gray-500 text-center p-4">No clients found.</p>`
        : clients.map(client => `
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
            </div>`).join('');
}
export function filterClients(searchTerm) {
    displayClients(clientsCache.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())));
}
export function editClient(clientId) {
    const client = clientsCache.find(c => c.id === clientId);
    if (!client) return;
    document.getElementById('client-id').value = client.id;
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-address').value = client.address || '';
    document.getElementById('client-contact-person').value = client.contactPerson || '';
    document.getElementById('client-phone').value = client.phone || '';
    document.getElementById('client-type').value = client.type || 'Shipper';
    document.getElementById('client-form-title').textContent = 'Edit Client';
}
export function clearClientForm() {
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-form-title').textContent = 'Add New Client';
}

// --- Autocomplete ---
export function setupAutocomplete(inputId, suggestionsId, type) {
    const input = document.getElementById(inputId);
    const suggestionsPanel = document.getElementById(suggestionsId);
    input.addEventListener('input', () => {
        const value = input.value.toLowerCase();
        if (value.length < 2) return suggestionsPanel.classList.add('hidden');
        const filtered = clientsCache.filter(c => c.name.toLowerCase().includes(value) && (c.type === type || c.type === 'Both'));
        if (filtered.length > 0) {
            suggestionsPanel.innerHTML = filtered.map(c => `<div class="autocomplete-suggestion" data-name="${c.name}">${c.name}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
        } else {
            suggestionsPanel.classList.add('hidden');
        }
    });
    suggestionsPanel.addEventListener('click', e => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            input.value = e.target.dataset.name;
            suggestionsPanel.classList.add('hidden');
        }
    });
    document.addEventListener('click', e => { if (e.target.id !== inputId) suggestionsPanel.classList.add('hidden'); });
}

// --- Charge Descriptions ---
export function openChargeManager() {
    displayChargeDescriptions();
    openModal('charge-manager-modal');
}
function displayChargeDescriptions() {
    document.getElementById('charge-description-list').innerHTML = chargeDescriptions.map(desc => `
        <div class="flex justify-between items-center p-2 bg-gray-100 rounded">
            <span>${desc}</span>
            <button onclick="deleteChargeDescription('${desc}')" class="text-red-500 hover:text-red-700">&times;</button>
        </div>`).join('');
}
export function saveChargeDescription() {
    const input = document.getElementById('new-charge-description');
    const newDesc = input.value.trim();
    if (newDesc && !chargeDescriptions.includes(newDesc)) {
        const newDescriptions = [...chargeDescriptions, newDesc];
        setChargeDescriptions(newDescriptions);
        localStorage.setItem('chargeDescriptions', JSON.stringify(newDescriptions));
        displayChargeDescriptions();
        input.value = '';
    }
}
export function deleteChargeDescription(description) {
    const newDescriptions = chargeDescriptions.filter(d => d !== description);
    setChargeDescriptions(newDescriptions);
    localStorage.setItem('chargeDescriptions', JSON.stringify(newDescriptions));
    displayChargeDescriptions();
}
function setupChargeAutocomplete(inputElement) {
    let suggestionsPanel = inputElement.parentElement.querySelector('.autocomplete-suggestions');
    if (!suggestionsPanel) {
        suggestionsPanel = document.createElement('div');
        suggestionsPanel.className = 'autocomplete-suggestions hidden';
        inputElement.parentElement.style.position = 'relative';
        inputElement.parentElement.appendChild(suggestionsPanel);
    }
    const showSuggestions = () => {
        const value = inputElement.value.toLowerCase();
        if (!value) return suggestionsPanel.classList.add('hidden');
        const filtered = chargeDescriptions.filter(d => d.toLowerCase().includes(value));
        if (filtered.length > 0) {
            suggestionsPanel.innerHTML = filtered.map(d => `<div class="autocomplete-suggestion">${d}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
        } else {
            suggestionsPanel.classList.add('hidden');
        }
    };
    inputElement.addEventListener('input', showSuggestions);
    inputElement.addEventListener('focus', showSuggestions);
    suggestionsPanel.addEventListener('mousedown', e => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            inputElement.value = e.target.textContent;
            suggestionsPanel.classList.add('hidden');
        }
    });
    inputElement.addEventListener('blur', () => { setTimeout(() => suggestionsPanel.classList.add('hidden'), 150); });
}

// --- Action Confirmation ---
export function confirmDelete(id, type, data = null) {
    if (currentUser.role !== 'admin') return showNotification("Only admins can delete files.", true);
    
    const modal = document.getElementById('confirm-modal');
    let message = '', onOk;
    
    if (type === 'jobfile') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Job File Deletion';
        message = `Are you sure you want to move job file "${id.replace(/_/g, '/')}" to the recycle bin?`;
        onOk = () => moveToRecycleBin(id);
    } else if (type === 'client') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Client Deletion';
        const client = clientsCache.find(c => c.id === id);
        message = `Are you sure you want to delete the client "${client?.name || 'this client'}"? This action cannot be undone.`;
        onOk = () => deleteClient(id);
    } else if (type === 'restore' && data) {
        modal.querySelector('#confirm-title').textContent = 'Confirm Data Restore';
        message = `<p>You are about to restore <b>${data.data.jobfiles.length} job files</b> and <b>${data.data.users.length} users</b>.</p>
                   <p class="mt-2 text-red-600 font-bold">This will overwrite existing data. This action cannot be undone.</p>`;
        onOk = async () => {
            showLoader();
            try {
                const batch = writeBatch(db);
                data.data.jobfiles.forEach(job => batch.set(doc(db, 'jobfiles', job.id), job));
                data.data.users.forEach(user => batch.set(doc(db, 'users', user.id), user));
                await batch.commit();
                showNotification("Data restored successfully! The page will reload.");
                setTimeout(() => window.location.reload(), 2000);
            } catch (error) {
                showNotification("An error occurred during restore.", true);
            } finally {
                hideLoader();
            }
        };
    }

    modal.querySelector('#confirm-message').innerHTML = message;
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const newOkButton = okButton.cloneNode(true); // Remove old listeners
    okButton.parentNode.replaceChild(newOkButton, okButton);
    newOkButton.addEventListener('click', () => { onOk(); closeModal('confirm-modal'); }, { once: true });
}

export function promptForRejection(docId) {
    setFileIdToReject(docId);
    openModal('reject-reason-modal', true);
}


// --- Activity Log & Status Views ---
export function openUserActivityLog() {
    const logBody = document.getElementById('activity-log-body');
    const logs = JSON.parse(localStorage.getItem('userActivityLog') || '[]');
    logBody.innerHTML = logs.length === 0 ? '<tr><td colspan="3" class="text-center p-4">No activity recorded.</td></tr>'
        : logs.map(entry => `
            <tr class="border-b">
                <td class="table-cell">${entry.user || 'Unknown'}</td>
                <td class="table-cell font-medium">${entry.file || 'N/A'}</td>
                <td class="table-cell text-gray-600">${new Date(entry.timestamp).toLocaleString()}</td>
            </tr>`).join('');
    openModal('activity-log-modal');
}
export function updateStatusSummary(dataSource) {
    const approved = dataSource.filter(f => f.status === 'approved').length;
    const rejected = dataSource.filter(f => f.status === 'rejected').length;
    const checked = dataSource.filter(f => f.status === 'checked').length;
    const pending = dataSource.filter(f => !f.status || f.status === 'pending').length;
    document.getElementById('status-summary-main').innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div onclick="showStatusJobs('approved')" class="bg-green-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"><p class="text-sm text-green-800">Approved</p><p class="text-2xl font-bold text-green-900">${approved}</p></div>
            <div onclick="showStatusJobs('rejected')" class="bg-red-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"><p class="text-sm text-red-800">Rejected</p><p class="text-2xl font-bold text-red-900">${rejected}</p></div>
            <div onclick="showStatusJobs('checked')" class="bg-blue-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"><p class="text-sm text-blue-800">Checked</p><p class="text-2xl font-bold text-blue-900">${checked}</p></div>
            <div onclick="showStatusJobs('pending')" class="bg-yellow-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all"><p class="text-sm text-yellow-800">Pending</p><p class="text-2xl font-bold text-yellow-900">${pending}</p></div>
        </div>`;
}

// These functions will be called from global scope, defined on window in script.js
export function showStatusJobs() {}
export function showUserJobs() {}
export function showSalesmanJobs() {}
export function showMonthlyJobs() {}

// --- Analytics ---
export function openAnalyticsDashboard() {}
export function closeAnalyticsDashboard() {}
export function printAnalytics() {}
export function sortAnalyticsTable() {}
export function downloadAnalyticsCsv() {}

// --- Recycle Bin ---
export function openRecycleBin() {}
export function confirmPermanentDelete() {}
export function restoreJobFileFromBin() {}
export function refreshOpenModals() {}
