// Module for UI Functions
        function showLogin() {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
            document.getElementById('analytics-container').style.display = 'none';
        }

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

        function openModal(id, keepParent = false) {
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
        function closeModal(id) {
            const modal = document.getElementById(id);
            modal.classList.remove('visible');
            modal.style.zIndex = '';
        }
        
        function clearForm() {
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

        function showLoader() { document.getElementById('loader-overlay').classList.add('visible'); }
        function hideLoader() { document.getElementById('loader-overlay').classList.remove('visible'); }

        function showNotification(message, isError = false) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.style.backgroundColor = isError ? '#c53030' : '#2d3748';
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        function applyFiltersAndDisplay() {
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

            const createdInfo = document.getElementById('created-by-info');
            const updatedInfo = document.getElementById('last-updated-by-info');
            
            // Format creation and update dates to accommodate both Firestore Timestamps and ISO strings
            const _formatDate = (val) => {
                if (!val) return '';
                try {
                    const dObj = typeof val.toDate === 'function' ? val.toDate() : new Date(val);
                    return dObj.toLocaleDateString();
                } catch (e) {
                    return '';
                }
            };
            createdInfo.textContent = data.createdBy ? `Created by: ${data.createdBy} on ${_formatDate(data.createdAt)}` : '';
            updatedInfo.textContent = data.lastUpdatedBy ? `Last updated by: ${data.lastUpdatedBy} on ${_formatDate(data.updatedAt)}` : '';
            
            document.getElementById('checked-stamp').style.display = 'none';
            document.getElementById('approved-stamp').style.display = 'none';
            document.getElementById('rejected-stamp').style.display = 'none';
            document.getElementById('rejection-banner').style.display = 'none';
            document.getElementById('check-btn').style.display = 'none';
            document.getElementById('approval-buttons').style.display = 'none';

            const checkBtn = document.getElementById('check-btn');
            if (data.checkedBy) {
                const _checkedDateStr = _formatDate(data.checkedAt);
                const checkedDate = _checkedDateStr ? ` on ${_checkedDateStr}` : '';
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
                const _approvedDateStr = _formatDate(data.approvedAt);
                const approvedDate = _approvedDateStr ? ` on ${_approvedDateStr}` : '';
                setVal('approved-by', `${data.approvedBy}${approvedDate}`);
                document.getElementById('approved-stamp').style.display = 'block';
            } else if (data.status === 'rejected') {
                const _rejectedDateStr = _formatDate(data.rejectedAt);
                const rejectedDate = _rejectedDateStr ? ` on ${_rejectedDateStr}` : '';
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

        function printAnalytics() {
            const analyticsBody = document.getElementById('analytics-body').innerHTML;
            const printContent = `
                <style>
                    body { padding: 1.5rem; background-color: white !important; }
                    #sort-analytics, button, select, .analytics-table td:last-child, .analytics-table th:last-child { display: none !important; }
                    .modal-content { box-shadow: none; border: none; }
                </style>
                </head><body>
                <h1 class="text-3xl font-bold mb-6 text-center">Analytics Report</h1>
                ${analyticsBody}
            `;
            createPrintWindow('Analytics Report', printContent);
        }

        function printPreview() {
            const previewBody = document.getElementById('preview-body').innerHTML;
            const printContent = `
                <style>
                    body { padding: 0; margin: 0; background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .no-print { display: none !important; }
                </style>
                </head><body>
                ${previewBody}
            `;
            createPrintWindow('Job File Preview', printContent);
        }

        function getPrintViewHtml(data, isPublicView = false) {
            const totalCost = data.totalCost || 0;
            const totalSelling = data.totalSelling || 0;
            const totalProfit = data.totalProfit || 0;
            
            // Helper to format Firestore Timestamp or ISO string dates.
            const formatDate = (val) => {
                if (!val) return '';
                try {
                    const dateObj = typeof val.toDate === 'function' ? val.toDate() : new Date(val);
                    return dateObj.toLocaleDateString();
                } catch (e) {
                    return '';
                }
            };

            const checkedByText = data.checkedBy ? `${data.checkedBy} on ${formatDate(data.checkedAt)}` : 'Pending';
            let approvedByText = 'Pending Approval';
            if (data.status === 'approved') {
                approvedByText = `${data.approvedBy} on ${formatDate(data.approvedAt)}`;
            } else if (data.status === 'rejected') {
                approvedByText = `REJECTED: ${data.rejectionReason}`;
            }

            const createdByText = data.createdBy ? `${data.createdBy} on ${formatDate(data.createdAt)}` : (data.pb || 'N/A');
            
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
                             <img src="http://qgocargo.com/logo.png" alt="Q'go Cargo Logo" class="h-16 w-auto">
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
        
        function populateTable() {
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

        function addChargeRow(data = {}) {
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
        
        function toggleAuthView(showLogin) {
            const nameField = document.getElementById('signup-name-field');
            const emailField = document.getElementById('email-address');
            
            document.getElementById('auth-title').textContent = showLogin ? 'Sign in to your account' : 'Create a new account';
            document.getElementById('auth-btn').textContent = showLogin ? 'Sign in' : 'Sign up';
            document.getElementById('auth-link').textContent = showLogin ? 'Create a new account' : 'Already have an account? Sign in';
            nameField.style.display = showLogin ? 'none' : 'block';
            emailField.classList.toggle('rounded-t-md', !showLogin);
            document.getElementById('approval-message').style.display = 'none';
        }

        function updateStatusSummary(targetId, dataSource) {
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

