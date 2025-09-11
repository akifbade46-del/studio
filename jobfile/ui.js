import { db } from './auth.js';
import { currentUser, jobFilesCache, clientsCache, chargeDescriptions, analyticsDataCache, currentFilteredJobs, profitChartInstance } from './state.js';
import { setChargeDescriptions, setAnalyticsDataCache, setCurrentFilteredJobs, setProfitChartInstance, setFileIdToReject } from './state.js';
import { getFormData, getJobFileById, getPrintViewHtmlForPreview } from './utils.js';
import { loadJobFileById, deleteClient, moveToRecycleBin, permanentlyDeleteJobFile, restoreJobFile } from './firestore.js';

// --- UI Initialization ---
export function initializeUIData() {
    const storedDescriptions = localStorage.getItem('chargeDescriptions');
    if (storedDescriptions) {
        setChargeDescriptions(JSON.parse(storedDescriptions));
    } else {
        const defaultDescriptions = [
            'Ex-works Charges:', 'Land/Air / Sea Freight:', 'Fuell Security / War Surcharge:', 'Formalities:', 'Delivery Order Fee:', 'Transportation Charges:', 'Inspection / Computer Print Charges:', 'Handling Charges:', 'Labor / Forklift Charges:', 'Documentation Charges:', 'Clearance Charges:', 'Customs Duty:', 'Terminal Handling Charges:', 'Legalization Charges:', 'Demurrage Charges:', 'Loading / Offloading Charges:', 'Destination Clearance Charges:', 'Packing Charges:', 'Port Charges:', 'Other Charges:', 'PAI Approval :', 'Insurance Fee :', 'EPA Charges :'
        ];
        setChargeDescriptions(defaultDescriptions);
        localStorage.setItem('chargeDescriptions', JSON.stringify(defaultDescriptions));
    }
    populateTable();
    calculate();
    document.getElementById('date').valueAsDate = new Date();
}

// --- View Toggling ---
export function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('analytics-container').style.display = 'none';
}

export function showApp() {
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

// --- Modals ---
export function openModal(id, keepParent = false) {
    if (!keepParent) {
        closeAllModals();
    }
    const modal = document.getElementById(id);
    if (keepParent) {
        const highestZ = Array.from(document.querySelectorAll('.overlay.visible'))
            .reduce((max, el) => Math.max(max, parseInt(window.getComputedStyle(el).zIndex, 10) || 1000), 1000);
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
    document.querySelectorAll('.overlay.visible').forEach(modal => {
        modal.classList.remove('visible');
        modal.style.zIndex = ''; 
    });
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
    form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(input => input.value = '');
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('job-file-no').disabled = false;
    populateTable();
    calculate();
    
    document.getElementById('prepared-by').value = currentUser.displayName;
    
    document.getElementById('created-by-info').textContent = '';
    document.getElementById('last-updated-by-info').textContent = '';

    document.getElementById('approved-by').value = '';
    document.getElementById('checked-by').value = '';
    document.getElementById('check-btn').disabled = false;
    document.getElementById('check-btn').textContent = 'Check Job File';
    document.getElementById('approve-btn').disabled = false;
    document.getElementById('reject-btn').disabled = false;

    document.getElementById('checked-stamp').style.display = 'none';
    document.getElementById('approved-stamp').style.display = 'none';
    document.getElementById('rejected-stamp').style.display = 'none';
    document.getElementById('rejection-banner').style.display = 'none';

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

    const createdInfo = document.getElementById('created-by-info');
    const updatedInfo = document.getElementById('last-updated-by-info');
    
    createdInfo.textContent = data.createdBy ? `Created by: ${data.createdBy} on ${data.createdAt?.toDate().toLocaleDateString()}` : '';
    updatedInfo.textContent = data.lastUpdatedBy ? `Last updated by: ${data.lastUpdatedBy} on ${data.updatedAt?.toDate().toLocaleString()}` : '';
    
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

    const tableBody = document.getElementById('charges-table-body');
    tableBody.addEventListener('input', e => {
        if (e.target.classList.contains('cost-input') || e.target.classList.contains('selling-input')) {
            calculate();
        }
    });
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

// --- Printing ---
export function printPage() {
    const data = getFormData();
    const printHTML = getPrintViewHtmlForPreview(data, false);
    const printContainer = document.getElementById('print-output');
    printContainer.innerHTML = printHTML;

    const qrContainer = printContainer.querySelector('.qrcode-container');
    if (qrContainer && data.jfn) {
        qrContainer.innerHTML = '';
        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
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

function createPrintWindow(title, content) {
    let styles = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
        styles += el.outerHTML;
    });

    const printWindow = window.open('', '', 'height=800,width=1200');
    
    printWindow.document.write(`<html><head><title>${title}</title>`);
    printWindow.document.write(styles);
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 750);
}

// --- Public & Preview Views ---
export async function showPublicJobView(jobId) {
    try {
        const data = await getJobFileById(jobId);
        if (data) {
            const publicViewHtml = getPrintViewHtmlForPreview(data, true); 
            const publicViewContainer = document.getElementById('public-view-container');
            publicViewContainer.innerHTML = publicViewHtml;
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'none';
        } else {
            document.body.innerHTML = `<div class="p-4 text-center text-yellow-700 bg-yellow-100">Job File with ID "${jobId}" not found.</div>`;
        }
    } catch (error) {
        console.error("Error fetching public job file:", error);
        document.body.innerHTML = `<div class="p-4 text-center text-red-700 bg-red-100">Error loading job file.</div>`;
    }
}

export async function previewJobFileById(docId) {
    showLoader();
    try {
        const data = await getJobFileById(docId);
        if (data) {
            const previewBody = document.getElementById('preview-body');
            previewBody.innerHTML = getPrintViewHtmlForPreview(data, false); 
            
            const qrContainer = previewBody.querySelector('.qrcode-container');
            if (qrContainer && data.jfn) {
                qrContainer.innerHTML = '';
                const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
                const qrText = `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`;
                new QRCode(qrContainer, {
                    text: qrText,
                    width: 96,
                    height: 96,
                    correctLevel: QRCode.CorrectLevel.H
                });
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


// --- File Manager & Filtering ---
export function applyFiltersAndDisplay() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const fromDate = document.getElementById('filter-date-from').value;
    const toDate = document.getElementById('filter-date-to').value;

    let filteredFiles = jobFilesCache.filter(file => {
        const searchData = [file.jfn, file.sh, file.co].join(' ').toLowerCase();
        if (searchTerm && !searchData.includes(searchTerm)) {
            return false;
        }
        if (statusFilter && file.status !== statusFilter) {
            return false;
        }
        if (fromDate && file.d < fromDate) {
            return false;
        }
        if (toDate && file.d > toDate) {
            return false;
        }
        return true;
    });

    displayJobFiles(filteredFiles);
}

export function displayJobFiles(files) {
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
        
        const searchTerm = [docData.jfn, docData.sh, docData.co].join(' ').toLowerCase();

        filesHtml += `
            <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2" 
                 data-search-term="${searchTerm}">
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


// --- Client Management ---
export function displayClients(clients) {
    const list = document.getElementById('client-list');
    if (!list) return;
    if (clients.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center p-4">No clients found.</p>`;
        return;
    }
    list.innerHTML = clients.map(client => `
        <div class="client-item border p-3 rounded-lg bg-gray-50 hover:bg-gray-100" data-search-term="${client.name.toLowerCase()}">
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

export function filterClients(searchTerm) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filteredClients = clientsCache.filter(client => client.name.toLowerCase().includes(lowerCaseSearchTerm));
    displayClients(filteredClients);
}

export function editClient(clientId) {
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

export function clearClientForm() {
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-form-title').textContent = 'Add New Client';
}

// --- Autocomplete ---
export function setupAutocomplete(inputId, suggestionsId, type) {
    const input = document.getElementById(inputId);
    const suggestionsPanel = document.getElementById(suggestionsId);
    let activeSuggestionIndex = -1;

    const updateSelection = (suggestions) => {
        suggestions.forEach((suggestion, index) => {
            if (index === activeSuggestionIndex) {
                suggestion.classList.add('selected');
                suggestion.scrollIntoView({ block: 'nearest' });
            } else {
                suggestion.classList.remove('selected');
            }
        });
    };

    input.addEventListener('input', () => {
        const value = input.value.toLowerCase();
        if (value.length < 2) {
            suggestionsPanel.innerHTML = '';
            suggestionsPanel.classList.add('hidden');
            return;
        }

        const filteredClients = clientsCache.filter(client => 
            client.name.toLowerCase().includes(value) && 
            (client.type === type || client.type === 'Both')
        );

        if (filteredClients.length > 0) {
            suggestionsPanel.innerHTML = filteredClients.map(client => 
                `<div class="autocomplete-suggestion" data-name="${client.name}">${client.name}</div>`
            ).join('');
            suggestionsPanel.classList.remove('hidden');
            activeSuggestionIndex = -1;
        } else {
            suggestionsPanel.innerHTML = '';
            suggestionsPanel.classList.add('hidden');
        }
    });

    input.addEventListener('keydown', (e) => {
        const suggestions = suggestionsPanel.querySelectorAll('.autocomplete-suggestion');
        if (suggestionsPanel.classList.contains('hidden') || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length; updateSelection(suggestions); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length; updateSelection(suggestions); } 
        else if (e.key === 'Enter') { e.preventDefault(); if (activeSuggestionIndex > -1) { suggestions[activeSuggestionIndex].click(); } } 
        else if (e.key === 'Escape') { suggestionsPanel.classList.add('hidden'); }
    });

    suggestionsPanel.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            input.value = e.target.dataset.name;
            suggestionsPanel.innerHTML = '';
            suggestionsPanel.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => { if (e.target.id !== inputId) { suggestionsPanel.classList.add('hidden'); } });
}

// --- Charge Descriptions ---
export function openChargeManager() {
    displayChargeDescriptions();
    openModal('charge-manager-modal');
}

function displayChargeDescriptions() {
    const list = document.getElementById('charge-description-list');
    list.innerHTML = chargeDescriptions.map(desc => `
        <div class="flex justify-between items-center p-2 bg-gray-100 rounded">
            <span>${desc}</span>
            <button onclick="deleteChargeDescription('${desc}')" class="text-red-500 hover:text-red-700">&times;</button>
        </div>
    `).join('');
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
    let activeSuggestionIndex = -1;

    const updateSelection = (suggestions) => {
        suggestions.forEach((suggestion, index) => {
            suggestion.classList.toggle('selected', index === activeSuggestionIndex);
            if (index === activeSuggestionIndex) suggestion.scrollIntoView({ block: 'nearest' });
        });
    };

    const showSuggestions = () => {
         const value = inputElement.value.toLowerCase();
        if (!value) {
            suggestionsPanel.classList.add('hidden');
            return;
        }
        const filtered = chargeDescriptions.filter(d => d.toLowerCase().includes(value));
        if (filtered.length > 0) {
            suggestionsPanel.innerHTML = filtered.map(d => `<div class="autocomplete-suggestion">${d}</div>`).join('');
            suggestionsPanel.classList.remove('hidden');
        } else {
            suggestionsPanel.classList.add('hidden');
        }
        activeSuggestionIndex = -1;
    };

    inputElement.addEventListener('input', showSuggestions);
    inputElement.addEventListener('focus', showSuggestions);
    inputElement.addEventListener('keydown', (e) => {
        const suggestions = suggestionsPanel.querySelectorAll('.autocomplete-suggestion');
        if (suggestionsPanel.classList.contains('hidden') || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length; updateSelection(suggestions); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length; updateSelection(suggestions); }
        else if (e.key === 'Enter') { e.preventDefault(); if (activeSuggestionIndex > -1) { suggestions[activeSuggestionIndex].click(); } } 
        else if (e.key === 'Escape') { suggestionsPanel.classList.add('hidden'); }
    });

    suggestionsPanel.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            inputElement.value = e.target.textContent;
            suggestionsPanel.classList.add('hidden');
        }
    });
    
    inputElement.addEventListener('blur', () => { setTimeout(() => suggestionsPanel.classList.add('hidden'), 150); });
}

// --- Action Confirmation ---
export function confirmDelete(docId, type = 'jobfile') {
     if (currentUser.role !== 'admin') {
         showNotification("Only admins can delete files.", true);
         return;
    }
    const modal = document.getElementById('confirm-modal');
    let message = '';
    let onOk;

    if (type === 'jobfile') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Job File Deletion';
        message = `Are you sure you want to move job file "${docId.replace(/_/g, '/')}" to the recycle bin?`;
        onOk = () => moveToRecycleBin(docId);
    } else if (type === 'client') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Client Deletion';
        const client = clientsCache.find(c => c.id === docId);
        message = `Are you sure you want to delete the client "${client?.name || 'this client'}"? This action cannot be undone.`;
        onOk = () => deleteClient(docId);
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

export function promptForRejection(docId) {
    setFileIdToReject(docId);
    openModal('reject-reason-modal', true);
}


// --- Activity Log ---
export function openUserActivityLog() {
    const logBody = document.getElementById('activity-log-body');
    let logs = [];
    try {
        const storedLogs = localStorage.getItem('userActivityLog');
        if (storedLogs) {
            logs = JSON.parse(storedLogs);
        }
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

    