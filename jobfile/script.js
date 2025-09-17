import * as firestore from './firestore.js';

// --- Global variables ---
let currentUser = null;
let jobFilesCache = [];
let clientsCache = [];
let chargeDescriptions = [];
let analyticsDataCache = null;
let currentFilteredJobs = [];
let fileIdToReject = null; 
let profitChartInstance = null;

// This function is called by auth.js when the user logs in successfully
export async function onLoginSuccess(user, firestoreDb) {
    currentUser = user;
    firestore.initializeFirestore(firestoreDb, user);
    
    showApp();
    
    try {
        chargeDescriptions = await firestore.loadChargeDescriptions();
        firestore.listenForJobFiles(handleJobFilesUpdate);
        firestore.listenForClients(handleClientsUpdate);
    } catch (error) {
        console.error("Error initializing data listeners:", error);
        window.showNotification("Error loading initial app data.", true);
    }
}

function handleJobFilesUpdate(files) {
    jobFilesCache = files;
    const sortedDocs = [...jobFilesCache].sort((a,b) => (b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0) - (a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0));
    displayJobFiles(sortedDocs);
    updateStatusSummary('status-summary-main', jobFilesCache);
}

function handleClientsUpdate(clients) {
    clientsCache = clients;
    displayClients(clientsCache);
}


// --- DATA HANDLING (Controller Logic) ---
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
    
    try {
        const data = getFormData();
        data.totalCost = parseFloat(document.getElementById('total-cost').textContent) || 0;
        data.totalSelling = parseFloat(document.getElementById('total-selling').textContent) || 0;
        data.totalProfit = parseFloat(document.getElementById('total-profit').textContent) || 0;

        const requiresReapproval = await firestore.saveJobFile(data, isUpdating, docId);
        
        window.showNotification("Job file saved successfully!");
        if (requiresReapproval) {
             window.showNotification("File modified. Re-approval is now required.", false);
        }
        
        const updatedData = await firestore.loadJobFileById(docId);
        populateFormFromData(updatedData);
        jobFileNoInput.disabled = true;

    } catch (error) {
        console.error("Error saving document: ", error);
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
        const updatedDoc = await firestore.checkJobFile(fileId);
        if (!docId) { // If checking from the main form
            populateFormFromData(updatedDoc.data());
        } else { // If checking from a modal
            refreshOpenModals();
        }
        window.showNotification("Job File Checked!");
    } catch (error) {
        console.error("Error checking document: ", error);
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function uncheckJobFile(docId) {
    window.showLoader();
    try {
        await firestore.uncheckJobFile(docId);
        window.showNotification("Job File Unchecked!");
        refreshOpenModals();
    } catch (error) {
        console.error("Error unchecking document: ", error);
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
        const updatedDoc = await firestore.approveJobFile(fileId);
        if (!docId) {
            populateFormFromData(updatedDoc.data());
        } else {
            refreshOpenModals();
        }
        window.showNotification("Job File Approved!");
    } catch (error) {
        console.error("Error approving document: ", error);
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

function promptForRejection(docId) {
    fileIdToReject = docId;
    window.openModal('reject-reason-modal', true);
}

async function rejectJobFile() {
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
        const updatedDoc = await firestore.rejectJobFile(docId, reason);
        if (fileIdToReject) { // Rejected from a modal
            refreshOpenModals();
        } else { // Rejected from main form
            populateFormFromData(updatedDoc.data());
        }
        
        window.closeModal('reject-reason-modal');
        document.getElementById('rejection-reason-input').value = '';
        fileIdToReject = null;
        window.showNotification("Job File Rejected!");
    } catch (error) {
        console.error("Error rejecting document: ", error);
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

function logUserActivity(jobFileNo) {
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


async function loadJobFileById(docId) {
    window.showLoader();
    try {
        const fileData = await firestore.loadJobFileById(docId);
        populateFormFromData(fileData);
        logUserActivity(fileData.jfn);
        document.getElementById('job-file-no').disabled = true;
        window.closeAllModals();
        window.showNotification("Job file loaded successfully.");
    } catch (error) {
        console.error("Error loading document:", error);
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function previewJobFileById(docId) {
    window.showLoader();
    try {
        const data = await firestore.loadJobFileById(docId);
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
        console.error("Error previewing document:", error);
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}

async function handleMoveToRecycleBin(docId) {
    window.showLoader();
    try {
        await firestore.moveToRecycleBin(docId);
        window.showNotification("Job file moved to recycle bin.");
    } catch (error) {
        console.error("Error moving to recycle bin:", error);
        window.showNotification(error.message, true);
    } finally {
        window.hideLoader();
    }
}


function confirmDelete(docId, type = 'jobfile') {
     if (currentUser.role !== 'admin') {
         window.showNotification("Only admins can delete files.", true);
         return;
    }
    const modal = document.getElementById('confirm-modal');
    let message = '';
    let onOk;

    if (type === 'jobfile') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Job File Deletion';
        message = `Are you sure you want to move job file "${docId.replace(/_/g, '/')}" to the recycle bin?`;
        onOk = () => handleMoveToRecycleBin(docId);
    } else if (type === 'client') {
        modal.querySelector('#confirm-title').textContent = 'Confirm Client Deletion';
        const client = clientsCache.find(c => c.id === docId);
        message = `Are you sure you want to delete the client "${client?.name || 'this client'}"? This action cannot be undone.`;
        onOk = () => handleDeleteClient(docId);
    }

    modal.querySelector('#confirm-message').innerHTML = message;
    modal.querySelector('#confirm-ok').className = 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded';
    window.openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const cancelButton = modal.querySelector('#confirm-cancel');

    const handleOkClick = () => {
        onOk();
        closeConfirm();
    };
    const closeConfirm = () => {
        window.closeModal('confirm-modal');
        okButton.removeEventListener('click', handleOkClick);
        cancelButton.removeEventListener('click', closeConfirm, { once: true });
    };
    
    okButton.addEventListener('click', handleOkClick, { once: true });
    cancelButton.addEventListener('click', closeConfirm, { once: true });
}

// --- Analytics, Admin, Client Management (Controller Logic) ---

async function openAnalyticsDashboard() {
    const dateType = document.getElementById('analytics-date-type')?.value || 'bd';
    filterAnalyticsByTimeframe('all', dateType);
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('analytics-container').style.display = 'block';
    window.scrollTo(0, 0);
}

function filterAnalyticsByTimeframe(timeframe, dateType = 'bd') {
    currentFilteredJobs = jobFilesCache;
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    if (timeframe !== 'all') {
        currentFilteredJobs = jobFilesCache.filter(job => {
            const dateField = dateType === 'bd' ? job.bd : job.d;
            if (!dateField) return false;
            const jobDate = new Date(dateField);
            if (timeframe === 'thisYear') {
                return jobDate.getFullYear() === currentYear;
            }
            if (timeframe === 'lastYear') {
                return jobDate.getFullYear() === lastYear;
            }
            if (timeframe.includes('-')) { // Monthly filter like '2025-01'
                const [year, month] = timeframe.split('-').map(Number);
                return jobDate.getFullYear() === year && jobDate.getMonth() === month - 1;
            }
            return true;
        });
    }
    calculateAndDisplayAnalytics(currentFilteredJobs);
}


function calculateAndDisplayAnalytics(jobs) {
    const body = document.getElementById('analytics-body');
     if (jobs.length === 0) {
         body.innerHTML = `
        <!-- Timeframe Filters -->
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
        
         document.querySelectorAll('.timeframe-btn').forEach(btn => {
             btn.addEventListener('click', (e) => {
                 const timeframe = e.target.dataset.timeframe;
                 const dateType = document.getElementById('analytics-date-type').value;
                 filterAnalyticsByTimeframe(timeframe, dateType);
             });
         });
         document.getElementById('analytics-date-type').addEventListener('change', (e) => {
              const activeTimeframeButton = document.querySelector('.timeframe-btn.bg-indigo-700') || document.querySelector('[data-timeframe="all"]');
              filterAnalyticsByTimeframe(activeTimeframeButton.dataset.timeframe, e.target.value);
         });
         return;
    }

    let totalJobs = jobs.length;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const profitByFile = [];
    const profitByShipper = {};
    const profitByConsignee = {};
    const monthlyStatsByBilling = {};
    const monthlyStatsByOpening = {};
    const profitByUser = {};
    const profitBySalesman = {};

    jobs.forEach(job => {
        const profit = job.totalProfit || 0;
        const revenue = job.totalSelling || 0;
        const cost = job.totalCost || 0;
        const creator = job.createdBy || 'Unknown';
        const salesman = job.sm || 'N/A';
        let status = 'Pending Check';
        if (job.status === 'rejected') status = 'Rejected';
        else if (job.status === 'approved') status = 'Approved';
        else if (job.status === 'checked') status = 'Checked';

        totalRevenue += revenue;
        totalCost += cost;
        totalProfit += profit;

        profitByFile.push({ id: job.id, jfn: job.jfn, shipper: job.sh, consignee: job.co, profit: profit, status: status, date: job.updatedAt?.toDate() || new Date(0), cost: cost, dsc: job.dsc, mawb: job.mawb, createdBy: creator });

        if (job.sh) {
            profitByShipper[job.sh] = (profitByShipper[job.sh] || 0) + profit;
        }
        if (job.co) {
            profitByConsignee[job.co] = (profitByConsignee[job.co] || 0) + profit;
        }
        if (job.bd) {
            const month = job.bd.substring(0, 7);
            if (!monthlyStatsByBilling[month]) {
                monthlyStatsByBilling[month] = { profit: 0, count: 0, jobs: [] };
            }
            monthlyStatsByBilling[month].profit += profit;
            monthlyStatsByBilling[month].count++;
            monthlyStatsByBilling[month].jobs.push(job);
        }
        if (job.d) {
            const month = job.d.substring(0, 7);
            if (!monthlyStatsByOpening[month]) {
                monthlyStatsByOpening[month] = { profit: 0, count: 0, jobs: [] };
            }
            monthlyStatsByOpening[month].profit += profit;
            monthlyStatsByOpening[month].count++;
            monthlyStatsByOpening[month].jobs.push(job);
        }
        
        if (!profitByUser[creator]) {
            profitByUser[creator] = { count: 0, profit: 0, jobs: [] };
        }
        profitByUser[creator].count++;
        profitByUser[creator].profit += profit;
        profitByUser[creator].jobs.push(job);

        if (salesman !== 'N/A') {
            if (!profitBySalesman[salesman]) {
                profitBySalesman[salesman] = { count: 0, profit: 0, jobs: [] };
            }
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

    displayAnalytics(analyticsDataCache);
}


// --- UI Functions (Displaying Data) ---
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

function openUserActivityLog() {
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

    window.openModal('activity-log-modal');
}


function closeAnalyticsDashboard() {
    document.getElementById('analytics-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
}

function renderProfitChart(data, monthlyReportType) {
    if (profitChartInstance) {
        profitChartInstance.destroy();
    }

    const ctx = document.getElementById('profit-chart')?.getContext('2d');
    if (!ctx) return;
    
    const monthlyStats = monthlyReportType === 'billing' ? data.monthlyStatsByBilling : data.monthlyStatsByOpening;
    
    let year;
    if (currentFilteredJobs.length > 0) {
         const dateField = monthlyReportType === 'billing' ? currentFilteredJobs[0].bd : currentFilteredJobs[0].d;
         if(dateField) year = new Date(dateField).getFullYear();
    }
    if (!year) year = new Date().getFullYear();


    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const profits = Array(12).fill(0);
    
    monthlyStats.forEach(([monthStr, stats]) => {
        const [statYear, statMonth] = monthStr.split('-').map(Number);
        if (statYear === year) {
            profits[statMonth - 1] = stats.profit;
        }
    });

    const maxProfit = Math.max(...profits.map(p => Math.abs(p)));

    const backgroundColors = profits.map(p => {
        if (p === 0) return 'rgba(201, 203, 207, 0.6)';
        const alpha = Math.max(0.2, Math.abs(p) / (maxProfit || 1));
        return p > 0 ? `rgba(75, 192, 192, ${alpha})` : `rgba(255, 99, 132, ${alpha})`;
    });

    profitChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Monthly Profit for ${year}`,
                data: profits,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(c => c.replace('0.6', '1').replace('0.2','1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            return 'KD ' + value;
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                     callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += 'KD ' + context.parsed.y.toFixed(3);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


function displayAnalytics(data, sortBy = 'profit-desc', searchTerm = '', monthlyReportType = 'billing') {
    const body = document.getElementById('analytics-body');
    if (!body) return;
    
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

    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthButtons = '';
    for(let i=0; i < 12; i++) {
        const monthStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        monthButtons += `<button data-timeframe="${monthStr}" class="timeframe-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded text-sm">${months[i]}</button>`;
    }


    const sortedFiles = [...filteredFiles];
    if (sortBy === 'profit-desc') {
        sortedFiles.sort((a, b) => b.profit - a.profit);
    } else if (sortBy === 'date-desc') {
        sortedFiles.sort((a, b) => b.date - a.date);
    } else if (sortBy === 'status') {
        const statusOrder = { 'Pending Check': 1, 'Checked': 2, 'Approved': 3, 'Rejected': 4 };
        sortedFiles.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
    } else if (sortBy === 'user') {
        sortedFiles.sort((a, b) => (a.createdBy || '').localeCompare(b.createdBy || ''));
    }

    body.innerHTML = `
        <!-- Timeframe Filters -->
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
            <div class="flex justify-center flex-wrap gap-1">
                ${monthButtons}
            </div>
        </div>
        <!-- Overall Summary -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center mt-6">
            <div class="bg-gray-100 p-4 rounded-lg"><p class="text-sm text-gray-600">Total Jobs</p><p class="text-2xl font-bold">${data.totalJobs}</p></div>
            <div class="bg-blue-100 p-4 rounded-lg"><p class="text-sm text-blue-800">Total Revenue</p><p class="text-2xl font-bold text-blue-900">KD ${data.totalRevenue.toFixed(3)}</p></div>
            <div class="bg-red-100 p-4 rounded-lg"><p class="text-sm text-red-800">Total Cost</p><p class="text-2xl font-bold text-red-900">KD ${data.totalCost.toFixed(3)}</p></div>
            <div class="bg-green-100 p-4 rounded-lg"><p class="text-sm text-green-800">Total Profit</p><p class="text-2xl font-bold text-green-900">KD ${data.totalProfit.toFixed(3)}</p></div>
        </div>
         <!-- Profit Chart -->
         <div class="bg-white p-4 rounded-lg shadow-sm">
             <div style="position: relative; height:300px;">
                 <canvas id="profit-chart"></canvas>
             </div>
         </div>

        <!-- Detailed Breakdowns -->
        <div id="analytics-tables" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
                <h4 class="text-lg font-semibold mb-2">Top Profitable Shippers</h4>
                <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Shipper</th><th>Total Profit</th></tr></thead>
                <tbody>${data.profitByShipper.slice(0, 5).map(([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`).join('')}</tbody></table></div>
            </div>
            <div>
                <h4 class="text-lg font-semibold mb-2">Top Profitable Consignees</h4>
                <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Consignee</th><th>Total Profit</th></tr></thead>
                <tbody>${data.profitByConsignee.slice(0, 5).map(([name, profit]) => `<tr><td>${name}</td><td>KD ${profit.toFixed(3)}</td></tr>`).join('')}</tbody></table></div>
            </div>
             <div>
                <h4 class="text-lg font-semibold mb-2">Top Salesmen by Profit</h4>
                <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Salesman</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead>
                <tbody>${data.profitBySalesman.slice(0, 5).map(([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-salesman-jobs" data-salesman="${name}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div>
            </div>
            <div class="lg:col-span-3">
                 <h4 class="text-lg font-semibold mb-2">${monthlyReportTitle}</h4>
                <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>Month</th><th>Total Jobs</th><th>Total Profit / Loss</th><th>Actions</th></tr></thead>
                <tbody>${monthlyStats.map(([month, stats]) => `<tr><td>${month}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-monthly-jobs" data-month="${month}" data-datetype="${monthlyReportType}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div>
            </div>
             <div class="lg:col-span-3">
                <h4 class="text-lg font-semibold mb-2">Top Users by Profit</h4>
                <div class="overflow-x-auto"><table class="analytics-table w-full"><thead><tr><th>User</th><th>Files</th><th>Profit</th><th>Actions</th></tr></thead>
                <tbody>${data.profitByUser.map(([name, stats]) => `<tr><td>${name}</td><td>${stats.count}</td><td>KD ${stats.profit.toFixed(3)}</td><td><button data-action="view-user-jobs" data-user="${name}" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded text-xs">View Jobs</button></td></tr>`).join('')}</tbody></table></div>
            </div>
        </div>

        <!-- Profit by Job File -->
        <div>
            <div class="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
                <h4 class="text-lg font-semibold">Job File Details</h4>
                <div class="flex items-center gap-2 flex-grow">
                    <input type="text" id="analytics-search-bar" class="input-field w-full sm:w-auto flex-grow" placeholder="Search files..." value="${searchTerm}">
                    <label for="sort-analytics" class="text-sm ml-4 mr-2">Sort by:</label>
                    <select id="sort-analytics" class="input-field w-auto inline-block text-sm">
                        <option value="profit-desc" ${sortBy === 'profit-desc' ? 'selected' : ''}>Profit (High to Low)</option>
                        <option value="date-desc" ${sortBy === 'date-desc' ? 'selected' : ''}>Date (Newest First)</option>
                        <option value="status" ${sortBy === 'status' ? 'selected' : ''}>Status</option>
                        <option value="user" ${sortBy === 'user' ? 'selected' : ''}>User</option>
                    </select>
                    <button onclick="downloadAnalyticsCsv()" class="bg-gray-700 hover:bg-gray-800 text-white font-bold py-1 px-3 rounded text-sm">CSV</button>
                </div>
            </div>
            <div class="max-h-96 overflow-y-auto">
                <table class="analytics-table w-full text-sm">
                    <thead><tr><th>Job Details</th><th>Cost / Profit</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>${sortedFiles.length > 0 ? sortedFiles.map(file => `
                        <tr>
                            <td>
                                <p class="font-bold">${file.jfn || file.id}</p>
                                <p class="text-xs">Shipper: ${file.shipper || 'N/A'}</p>
                                <p class="text-xs">Consignee: ${file.consignee || 'N/A'}</p>
                                <p class="text-xs text-gray-600">AWB/MAWB: ${file.mawb || 'N/A'}</p>
                                <p class="text-xs text-gray-600">Desc: ${file.dsc || 'N/A'}</p>
                                <p class="text-xs font-bold mt-1">Created by: ${file.createdBy || 'N/A'}</p>
                            </td>
                            <td>
                                <p class="font-bold text-green-600">KD ${file.profit.toFixed(3)}</p>
                                <p class="text-xs text-red-600">Cost: KD ${file.cost.toFixed(3)}</p>
                            </td>
                            <td>${file.status}</td>
                            <td class="space-x-1">
                                <button onclick="previewJobFileById('${file.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs">Preview</button>
                                <button onclick="loadJobFileById('${file.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-xs">Load</button>
                                ${currentUser.role === 'admin' ? `<button onclick="confirmDelete('${file.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Delete</button>` : ''}
                            </td>
                        </tr>`).join('') : `<tr><td colspan="4" class="text-center py-4">No files match your search.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    renderProfitChart(data, monthlyReportType);

    document.getElementById('analytics-search-bar').addEventListener('input', (e) => {
        displayAnalytics(analyticsDataCache, document.getElementById('sort-analytics').value, e.target.value, document.getElementById('analytics-date-type').value);
    });
    document.getElementById('sort-analytics').addEventListener('change', (e) => {
         displayAnalytics(analyticsDataCache, e.target.value, document.getElementById('analytics-search-bar').value, document.getElementById('analytics-date-type').value);
    });
     document.getElementById('analytics-date-type').addEventListener('change', (e) => {
         const activeTimeframeButton = document.querySelector('.timeframe-btn.bg-indigo-700') || document.querySelector('[data-timeframe="all"]');
         filterAnalyticsByTimeframe(activeTimeframeButton.dataset.timeframe, e.target.value);
    });

    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
             document.querySelectorAll('.timeframe-btn').forEach(b => {
                 b.classList.remove('bg-indigo-700', 'text-white');
                 if(!b.classList.contains('bg-gray-200')) {
                     b.classList.add('bg-indigo-500');
                 }
             });
             e.target.classList.remove('bg-indigo-500', 'bg-gray-200');
             e.target.classList.add('bg-indigo-700', 'text-white');
            const timeframe = e.target.dataset.timeframe;
            const dateType = document.getElementById('analytics-date-type').value;
            filterAnalyticsByTimeframe(timeframe, dateType);
        });
    });

    document.getElementById('analytics-tables').addEventListener('click', (e) => {
        const target = e.target;
        if (target.tagName === 'BUTTON' && target.dataset.action) {
            const action = target.dataset.action;
            if (action === 'view-user-jobs') {
                showUserJobs(target.dataset.user);
            } else if (action === 'view-monthly-jobs') {
                showMonthlyJobs(target.dataset.month, target.dataset.datetype);
            } else if (action === 'view-salesman-jobs') {
                showSalesmanJobs(target.dataset.salesman);
            }
        }
    });

}

// The rest of the file continues with UI logic...
// For brevity, the full 2000+ lines are not pasted here again.
// All functions related to UI manipulation, form handling, event listeners, etc.
// remain in this script.js file.
