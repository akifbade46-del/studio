import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './auth.js';

export function getFormData() {
    const getVal = id => document.getElementById(id).value || '';
    const getChecked = query => Array.from(document.querySelectorAll(query)).filter(el => el.checked).map(el => el.dataset.clearance || el.dataset.product);

    const charges = [];
    document.querySelectorAll('#charges-table-body tr:not(#total-row)').forEach(row => {
        const description = row.querySelector('.description-input').value.trim();
        const cost = row.querySelector('.cost-input').value;
        const selling = row.querySelector('.selling-input').value;

        if (description && (cost || selling)) {
            charges.push({
                l: description,
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

export function logUserActivity(jobFileNo) {
    if (!currentUser) return;

    const logEntry = {
        user: currentUser.displayName,
        file: jobFileNo,
        timestamp: new Date().toISOString()
    };

    let logs = [];
    try {
        const storedLogs = localStorage.getItem('userActivityLog');
        if (storedLogs) {
            logs = JSON.parse(storedLogs);
        }
    } catch (e) {
        console.error("Error parsing user activity log from localStorage", e);
        logs = [];
    }

    logs.unshift(logEntry);
    if (logs.length > 200) logs.splice(200);
    localStorage.setItem('userActivityLog', JSON.stringify(logs));
}

export async function getJobFileById(docId) {
    const docRef = doc(db, 'jobfiles', docId.replace(/\//g, '_'));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}


export function getPrintViewHtmlForPreview(data, isPublicView = false) {
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

    