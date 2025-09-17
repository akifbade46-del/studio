
import { state } from './state.js';

export function showLoader() { document.getElementById('loader-overlay').classList.add('visible'); }
export function hideLoader() { document.getElementById('loader-overlay').classList.remove('visible'); }

export function openModal(id, keepParent = false) {
    const modal = document.getElementById(id);
    if (keepParent) {
        const highestZ = Array.from(document.querySelectorAll('.overlay.visible'))
            .reduce((max, el) => Math.max(max, parseInt(window.getComputedStyle(el).zIndex || 1000)), 1000);
        modal.style.zIndex = highestZ + 10;
    } else {
        // Close all other modals if not specified to keep parent open
        document.querySelectorAll('.overlay').forEach(m => {
            if(m.id !== id) m.classList.remove('visible');
        });
    }
    modal.classList.add('visible');
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('visible');
}

export function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#c53030' : '#2d3748';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

export function clearForm() {
    const form = document.querySelector('#main-container');
    if (!form) return;
    form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(input => input.value = '');
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('job-file-no').disabled = false;
    
    populateTable();
    for(let i=0; i<5; i++) addChargeRow();
    calculate();
    
    document.getElementById('prepared-by').value = state.currentUser?.displayName || '';
    
    document.getElementById('created-by-info').textContent = '';
    document.getElementById('last-updated-by-info').textContent = '';
    document.getElementById('approved-by').value = '';
    document.getElementById('checked-by').value = '';

    ['checked-stamp', 'approved-stamp', 'rejected-stamp', 'rejection-banner'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    
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
    
    document.getElementById('checked-stamp').style.display = 'none';
    document.getElementById('approved-stamp').style.display = 'none';
    document.getElementById('rejected-stamp').style.display = 'none';
    document.getElementById('rejection-banner').style.display = 'none';
    document.getElementById('check-btn').style.display = 'none';
    document.getElementById('approval-buttons').style.display = 'none';

    setVal('checked-by', data.checkedBy ? `${data.checkedBy} on ${data.checkedAt?.toDate().toLocaleDateString() || ''}` : 'Pending Check');
    if(data.checkedBy) document.getElementById('checked-stamp').style.display = 'block';

    let approvalText = 'Pending Approval';
    if(data.status === 'approved') {
        approvalText = `${data.approvedBy} on ${data.approvedAt?.toDate().toLocaleDateString() || ''}`;
        document.getElementById('approved-stamp').style.display = 'block';
    } else if (data.status === 'rejected') {
        approvalText = `Rejected by ${data.rejectedBy}`;
        document.getElementById('rejected-stamp').style.display = 'block';
        document.getElementById('rejection-banner').style.display = 'block';
        document.getElementById('rejection-reason').textContent = data.rejectionReason;
    }
    setVal('approved-by', approvalText);

    if (state.currentUser.role === 'admin' && data.status !== 'approved' && data.status !== 'rejected') {
        document.getElementById('approval-buttons').style.display = 'flex';
    }
    if (['admin', 'checker'].includes(state.currentUser.role) && !data.checkedBy) {
         document.getElementById('check-btn').style.display = 'block';
    }

    setChecked('clearance', data.cl);
    setChecked('product', data.pt);

    populateTable();
    document.getElementById('charges-table-body').innerHTML = ''; // Clear default rows
    if (data.ch && data.ch.length > 0) {
        data.ch.forEach(charge => addChargeRow(charge));
    } else {
        for(let i=0; i<5; i++) addChargeRow(); // Add empty rows if no charges
    }
    calculate();
}

export function populateTable() {
    const table = document.getElementById('charges-table');
    table.innerHTML = `
        <thead><tr class="bg-gray-100">
            <th class="table-cell font-semibold w-2/5">Description</th>
            <th class="table-cell font-semibold">Cost</th><th class="table-cell font-semibold">Selling</th>
            <th class="table-cell font-semibold">Profit</th><th class="table-cell font-semibold">Notes</th>
            <th class="table-cell font-semibold"></th>
        </tr></thead>
        <tbody id="charges-table-body"></tbody>
        <tfoot><tr id="total-row" class="bg-gray-100 font-bold">
            <td class="table-cell text-right">TOTAL:</td>
            <td id="total-cost" class="table-cell text-right">0.000</td>
            <td id="total-selling" class="table-cell text-right">0.000</td>
            <td id="total-profit" class="table-cell text-right">0.000</td>
            <td class="table-cell" colspan="2"></td>
        </tr></tfoot>`;
    
    document.getElementById('charges-table-body').addEventListener('input', e => {
        if (e.target.classList.contains('cost-input') || e.target.classList.contains('selling-input')) {
            calculate();
        }
    });
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
        <td class="table-cell text-center"><button class="text-red-500 hover:text-red-700 font-bold text-lg">&times;</button></td>`;
    newRow.querySelector('button').addEventListener('click', () => { newRow.remove(); calculate(); });
    setupChargeAutocomplete(newRow.querySelector('.description-input'));
}

export function calculate() {
    let totalCost = 0, totalSelling = 0;
    document.querySelectorAll('#charges-table-body tr').forEach(row => {
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

export function displayJobFiles(files) {
    const list = document.getElementById('job-files-list');
    if(!list) return;
    list.innerHTML = files.map(file => {
        const deleteButton = state.currentUser.role === 'admin' ? `<button onclick="confirmDelete('${file.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Delete</button>` : '';
        return `
        <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2">
            <div class="text-center sm:text-left">
                <p class="font-bold text-indigo-700">${file.jfn || 'No ID'}</p>
                <p class="text-sm text-gray-600">Shipper: ${file.sh || 'N/A'} | Consignee: ${file.co || 'N/A'}</p>
                <p class="text-xs text-gray-400">Last Updated: ${file.updatedAt?.toDate().toLocaleString() || 'N/A'}</p>
            </div>
            <div class="space-x-2 flex-shrink-0">
                <button onclick="previewJobFileById('${file.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">Preview</button>
                <button onclick="loadJobFileById('${file.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-sm">Load</button>
                ${deleteButton}
            </div>
        </div>
    `}).join('') || `<p class="text-gray-500 text-center p-4">No job files match the current filters.</p>`;
}

export function updateStatusSummary(targetId, dataSource) {
    const container = document.getElementById(targetId);
    if (!container) return;
    const summary = dataSource.reduce((acc, file) => {
        const status = file.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, { pending: 0, checked: 0, approved: 0, rejected: 0 });
    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div onclick="showStatusJobs('approved')" class="bg-green-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-green-800">Approved</p><p class="text-2xl font-bold text-green-900">${summary.approved}</p></div>
            <div onclick="showStatusJobs('rejected')" class="bg-red-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-red-800">Rejected</p><p class="text-2xl font-bold text-red-900">${summary.rejected}</p></div>
            <div onclick="showStatusJobs('checked')" class="bg-blue-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-blue-800">Checked</p><p class="text-2xl font-bold text-blue-900">${summary.checked}</p></div>
            <div onclick="showStatusJobs('pending')" class="bg-yellow-100 p-4 rounded-lg cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300"><p class="text-sm text-yellow-800">Pending</p><p class="text-2xl font-bold text-yellow-900">${summary.pending}</p></div>
        </div>
    `;
}

export function createPrintWindow(title, content) {
    let styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(el => el.outerHTML).join('');
    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write(`<html><head><title>${title}</title>${styles}</head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 750);
}

export function getPrintViewHtml(data, isPublicView = false) {
    const totalCost = data.totalCost || 0;
    const totalSelling = data.totalSelling || 0;
    const totalProfit = data.totalProfit || 0;
    
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
                <div class="col-span-3 bg-white p-1 flex items-center"><img src="http://qgocargo.com/logo.png" class="h-12"></div>
                <div class="col-span-6 bg-white flex items-center justify-center text-xl font-bold">JOB FILE</div>
                <div class="col-span-3 bg-white p-1 text-xs"><div><strong>Date:</strong> ${data.d || ''}</div><div><strong>P.O. #:</strong> ${data.po || ''}</div></div>
                <div class="col-span-12 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>Job File No.:</strong> ${data.jfn || ''}</div>
                <div class="col-span-12 bg-white p-0" style="border: 1px solid #374151;">
                    <table class="print-table w-full text-xs">
                        <thead><tr><th>Description</th><th>Cost</th><th>Selling</th><th>Profit</th><th>Notes</th></tr></thead>
                        <tbody>
                            ${(data.ch || []).map(c => `<tr><td>${c.l}</td><td>${c.c}</td><td>${c.s}</td><td>${(parseFloat(c.s || 0) - parseFloat(c.c || 0)).toFixed(3)}</td><td>${c.n}</td></tr>`).join('')}
                            <tr class="font-bold bg-gray-100"><td>TOTAL:</td><td>${totalCost.toFixed(3)}</td><td>${totalSelling.toFixed(3)}</td><td>${totalProfit.toFixed(3)}</td><td></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="col-span-3 bg-white p-1 text-xs" style="border: 1px solid #374151;"><strong>PREPARED BY:</strong><div class="print-field">${createdByText}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs relative" style="border: 1px solid #374151;">${checkedStampHtml}<strong>CHECKED BY:</strong><div class="print-field">${checkedByText}</div></div>
                <div class="col-span-3 bg-white p-1 text-xs relative" style="border: 1px solid #374151;">${approvalStampHtml}<strong>APPROVED BY:</strong><div class="print-field">${approvedByText}</div></div>
                ${qrContainerHtml}
            </div>
        </div>
    `;
}

export function displayClients(clients) {
    const list = document.getElementById('client-list');
    list.innerHTML = clients.map(client => `
        <div class="client-item border p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold">${client.name}</p>
                    <p class="text-sm text-gray-600">${client.address || ''}</p>
                </div>
                <div class="flex-shrink-0 space-x-2">
                    <button onclick="editClient('${client.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs">Edit</button>
                    <button onclick="confirmDelete('${client.id}', 'client')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}
export function clearClientForm() {
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-form-title').textContent = 'Add New Client';
}
export function editClient(clientId) {
    const client = state.clientsCache.find(c => c.id === clientId);
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

export function setupAutocomplete(inputId, suggestionsId, type) {
    const input = document.getElementById(inputId);
    const suggestionsPanel = document.getElementById(suggestionsId);
    if(!input) return;

    input.addEventListener('input', () => {
        const value = input.value.toLowerCase();
        if (value.length < 2) { suggestionsPanel.classList.add('hidden'); return; }
        const filteredClients = state.clientsCache.filter(c => c.name.toLowerCase().includes(value) && (c.type === type || c.type === 'Both'));
        if (filteredClients.length > 0) {
            suggestionsPanel.innerHTML = filteredClients.map(c => `<div class="autocomplete-suggestion" data-name="${c.name}">${c.name}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
        } else {
            suggestionsPanel.classList.add('hidden');
        }
    });
    suggestionsPanel.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            input.value = e.target.dataset.name;
            suggestionsPanel.classList.add('hidden');
        }
    });
    document.addEventListener('click', (e) => {
        if (e.target.id !== inputId) suggestionsPanel.classList.add('hidden');
    });
}
export function setupChargeAutocomplete(inputElement) {
    let suggestionsPanel = inputElement.parentElement.querySelector('.autocomplete-suggestions');
    if (!suggestionsPanel) {
        suggestionsPanel = document.createElement('div');
        suggestionsPanel.className = 'autocomplete-suggestions hidden';
        suggestionsPanel.style.width = inputElement.offsetWidth + 'px';
        inputElement.parentElement.style.position = 'relative';
        inputElement.parentElement.appendChild(suggestionsPanel);
    }
    
    inputElement.addEventListener('focus', () => {
        const value = inputElement.value.toLowerCase();
        const filtered = state.chargeDescriptions.filter(d => d.toLowerCase().includes(value));
        if(filtered.length > 0) {
            suggestionsPanel.innerHTML = filtered.map(d => `<div class="autocomplete-suggestion">${d}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
        }
    });

    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase();
        if (!value) {
            suggestionsPanel.classList.add('hidden');
            return;
        }
        const filtered = state.chargeDescriptions.filter(d => d.toLowerCase().includes(value));
        if (filtered.length > 0) {
            suggestionsPanel.innerHTML = filtered.map(d => `<div class="autocomplete-suggestion">${d}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
        } else {
            suggestionsPanel.classList.add('hidden');
        }
    });

    suggestionsPanel.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            inputElement.value = e.target.textContent;
            suggestionsPanel.classList.add('hidden');
        }
    });

    inputElement.addEventListener('blur', () => {
        setTimeout(() => suggestionsPanel.classList.add('hidden'), 150);
    });
}


export function refreshOpenModals() {}
export function displayJobsInModal(jobs, title) {}
export function openRecycleBin() {}
export function confirmPermanentDelete(docId) {}
export function displayChargeDescriptions() {
    const list = document.getElementById('charge-description-list');
    list.innerHTML = state.chargeDescriptions.map(desc => `
        <div class="flex justify-between items-center p-2 bg-gray-100 rounded">
            <span>${desc}</span>
            <button data-desc="${desc}" class="text-red-500 hover:text-red-700">&times;</button>
        </div>
    `).join('');
}
export function openAdminPanel() {
    // This function needs access to Firestore, so it's better to keep its logic in script.js
    // This is just a placeholder to satisfy the import.
    console.log("Opening admin panel...");
}

export function saveUserChanges() {
    // This function needs access to Firestore, so it's better to keep its logic in script.js
    // This is just a placeholder to satisfy the import.
    console.log("Saving user changes...");
}


    