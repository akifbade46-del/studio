import { state } from './state.js';

export function showLoader() { document.getElementById('loader-overlay').classList.add('visible'); }
export function hideLoader() { document.getElementById('loader-overlay').classList.remove('visible'); }
export function openModal(id) { document.getElementById(id).classList.add('visible'); }
export function closeModal(id) { document.getElementById(id).classList.remove('visible'); }

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
    const form = document.querySelector('#app-container');
    if (!form) return;
    form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(input => input.value = '');
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
    
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('job-file-no').disabled = false;
    populateTable();
    
    document.getElementById('prepared-by').value = state.currentUser.displayName;
    
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
        document.querySelectorAll(`[data-${type}]`).forEach(el => el.checked = (values || []).includes(el.dataset[type]));
    };

    clearForm();

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
    
    if (data.checkedBy) {
        setVal('checked-by', `${data.checkedBy} on ${data.checkedAt?.toDate().toLocaleDateString() || ''}`);
        document.getElementById('checked-stamp').style.display = 'block';
    }
    if (data.status === 'approved') {
        setVal('approved-by', `${data.approvedBy} on ${data.approvedAt?.toDate().toLocaleDateString() || ''}`);
        document.getElementById('approved-stamp').style.display = 'block';
    } else if (data.status === 'rejected') {
        setVal('approved-by', `Rejected by ${data.rejectedBy} on ${data.rejectedAt?.toDate().toLocaleDateString() || ''}`);
        document.getElementById('rejected-stamp').style.display = 'block';
        document.getElementById('rejection-banner').style.display = 'block';
        document.getElementById('rejection-reason').textContent = data.rejectionReason;
    }

    setChecked('clearance', data.cl);
    setChecked('product', data.pt);

    populateTable();
     if (data.ch && data.ch.length > 0) {
         document.getElementById('charges-table-body').innerHTML = '';
         data.ch.forEach(charge => addChargeRow(charge));
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

     for(let i=0; i<5; i++) addChargeRow();
}

export function addChargeRow(data = {}) {
    const tableBody = document.getElementById('charges-table-body');
    const newRow = tableBody.insertRow();
    newRow.innerHTML = `
        <td class="table-cell"><input type="text" class="description-input input-field" value="${data.l || ''}" autocomplete="off" list="charge-options"></td>
        <td class="table-cell"><input type="number" step="0.001" class="cost-input input-field" value="${data.c || ''}"></td>
        <td class="table-cell"><input type="number" step="0.001" class="selling-input input-field" value="${data.s || ''}"></td>
        <td class="table-cell profit-output bg-gray-50 text-right">${((data.s || 0) - (data.c || 0)).toFixed(3)}</td>
        <td class="table-cell"><input type="text" class="notes-input input-field" value="${data.n || ''}"></td>
        <td class="table-cell text-center"><button class="text-red-500 hover:text-red-700">&times;</button></td>`;
    newRow.querySelector('button').addEventListener('click', () => { newRow.remove(); calculate(); });
}

export function calculate() {
    let totalCost = 0, totalSelling = 0, totalProfit = 0;
    document.querySelectorAll('#charges-table-body tr').forEach(row => {
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

export function displayJobFiles(files) {
    const list = document.getElementById('job-files-list');
    if(!list) return;
    
    list.innerHTML = files.map(file => `
        <div class="job-file-item border p-3 rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100">
            <div>
                <p class="font-bold text-indigo-700">${file.jfn || 'No ID'}</p>
                <p class="text-sm text-gray-600">Shipper: ${file.sh || 'N/A'}</p>
            </div>
            <div class="space-x-2">
                <button data-action="preview" data-id="${file.id}" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">Preview</button>
                <button data-action="load" data-id="${file.id}" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-sm">Load</button>
            </div>
        </div>
    `).join('') || `<p class="text-gray-500 text-center p-4">No job files.</p>`;
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
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div class="p-2 bg-yellow-100 text-yellow-800 rounded"><strong>Pending:</strong> ${summary.pending}</div>
            <div class="p-2 bg-blue-100 text-blue-800 rounded"><strong>Checked:</strong> ${summary.checked}</div>
            <div class="p-2 bg-green-100 text-green-800 rounded"><strong>Approved:</strong> ${summary.approved}</div>
            <div class="p-2 bg-red-100 text-red-800 rounded"><strong>Rejected:</strong> ${summary.rejected}</div>
        </div>
    `;
}

export function getPrintViewHtml(data, forPrinting = false) {
    const chargesHtml = (data.ch || []).map(charge => `
        <tr>
            <td class="print-table-cell">${charge.l || ''}</td>
            <td class="print-table-cell text-right">${parseFloat(charge.c || 0).toFixed(3)}</td>
            <td class="print-table-cell text-right">${parseFloat(charge.s || 0).toFixed(3)}</td>
            <td class="print-table-cell text-right">${(parseFloat(charge.s || 0) - parseFloat(charge.c || 0)).toFixed(3)}</td>
            <td class="print-table-cell">${charge.n || ''}</td>
        </tr>
    `).join('');

    const totalCost = (data.ch || []).reduce((sum, item) => sum + (parseFloat(item.c) || 0), 0);
    const totalSelling = (data.ch || []).reduce((sum, item) => sum + (parseFloat(item.s) || 0), 0);

    const qrCodeHtml = forPrinting ? '' : `
        <div class="qrcode-container float-right">
            <!-- QR code will be generated here by JS -->
        </div>
    `;

    return `
    <div class="p-4 bg-white font-sans text-sm">
        <style>
            .print-field { border: 1px solid #6b7280; padding: 0.3rem; min-height: 24px; word-break: break-all; }
            .print-table-cell { border: 1px solid #d1d5db; padding: 0.5rem; }
        </style>
        <header class="flex justify-between items-start mb-4 pb-2 border-b-2">
            <div>
                <img src="http://qgocargo.com/logo.png" alt="Q'go Cargo Logo" class="h-16">
            </div>
            <div class="text-right">
                <h1 class="text-2xl font-bold">JOB FILE</h1>
                <div class="flex items-center justify-end mt-1">
                    <p class="mr-2 font-semibold">Date:</p>
                    <div class="print-field w-32">${data.d || ''}</div>
                </div>
                <div class="flex items-center justify-end mt-1">
                    <p class="mr-2 font-semibold">P.O. #:</p>
                    <div class="print-field w-32">${data.po || ''}</div>
                </div>
            </div>
        </header>

        ${qrCodeHtml}
        
        <div class="grid grid-cols-5 gap-2 mb-4">
            <div class="col-span-3">
                <p class="font-semibold">Job File No.:</p>
                <div class="print-field">${data.jfn || ''}</div>
            </div>
            <div class="col-span-1">
                 <p class="font-semibold">Clearance:</p>
                 <div class="print-field h-full">${(data.cl || []).join(', ')}</div>
            </div>
             <div class="col-span-1">
                 <p class="font-semibold">Product Type:</p>
                 <div class="print-field h-full">${(data.pt || []).join(', ')}</div>
            </div>
        </div>
        
        <!-- ... other fields ... -->
        
        <h2 class="text-lg font-semibold mt-6 mb-1">Charges</h2>
        <table class="w-full border-collapse text-xs">
            <thead>
                <tr class="bg-gray-100">
                    <th class="print-table-cell w-2/5 text-left">Description</th>
                    <th class="print-table-cell text-right">Cost</th>
                    <th class="print-table-cell text-right">Selling</th>
                    <th class="print-table-cell text-right">Profit</th>
                    <th class="print-table-cell text-left">Notes</th>
                </tr>
            </thead>
            <tbody>
                ${chargesHtml}
            </tbody>
            <tfoot>
                <tr class="font-bold bg-gray-100">
                    <td class="print-table-cell text-right">TOTAL:</td>
                    <td class="print-table-cell text-right">${totalCost.toFixed(3)}</td>
                    <td class="print-table-cell text-right">${totalSelling.toFixed(3)}</td>
                    <td class="print-table-cell text-right">${(totalSelling - totalCost).toFixed(3)}</td>
                    <td class="print-table-cell"></td>
                </tr>
            </tfoot>
        </table>

        <!-- ... remarks and footer ... -->

    </div>
    `;
}
