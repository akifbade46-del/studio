import { db, auth } from './auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { 
    showLoader, hideLoader, showNotification, openModal, closeModal, 
    populateFormFromData, clearForm, addChargeRow, populateTable, calculate, 
    displayJobFiles, updateStatusSummary, getPrintViewHtml, createPrintWindow,
    displayClients, clearClientForm, editClient, setupAutocomplete, refreshOpenModals,
    displayJobsInModal, openRecycleBin, confirmPermanentDelete, displayChargeDescriptions,
    openAdminPanel, saveUserChanges
} from './ui.js';
import { state } from './state.js';
import { callGeminiApi } from './gemini.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


export function initializeMainApp() {
    hideLoader();

    if (state.listenersAttached) return;

    document.getElementById('user-display-name').textContent = state.currentUser.displayName;
    document.getElementById('user-role').textContent = state.currentUser.role;

    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'none');
    
    if (state.currentUser.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'block');
        document.getElementById('checker-info-banner').style.display = 'block';
    } else if (state.currentUser.role === 'checker') {
        document.querySelectorAll('.checker-only').forEach(el => el.style.display = 'block');
        document.getElementById('checker-info-banner').style.display = 'block';
    }
    
    loadJobFiles();
    loadClients();
    loadChargeDescriptions();
    clearForm();
    attachEventListeners();
}

function handleLogout() {
    signOut(auth);
}

// --- Data Handling (Firestore) ---
async function saveJobFile() {
    const jobFileNoInput = document.getElementById('job-file-no');
    const jobFileNo = jobFileNoInput.value.trim();
    if (!jobFileNo) { 
        showNotification("Please enter a Job File No.", true); 
        return; 
    }

    const isUpdating = jobFileNoInput.disabled;
    showLoader();
    const docId = jobFileNo.replace(/\//g, '_');
    
    if (!isUpdating) {
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            hideLoader();
            showNotification(`Job File No. "${jobFileNo}" already exists.`, true);
            return;
        }
    }

    const data = getFormData();
    data.totalCost = parseFloat(document.getElementById('total-cost').textContent) || 0;
    data.totalSelling = parseFloat(document.getElementById('total-selling').textContent) || 0;
    data.totalProfit = parseFloat(document.getElementById('total-profit').textContent) || 0;
    
    try {
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            data.lastUpdatedBy = state.currentUser.displayName;
            data.updatedAt = serverTimestamp();

            if (docSnap.data().status === 'approved' || docSnap.data().status === 'checked') {
                data.status = 'pending';
                data.checkedBy = null; data.checkedAt = null;
                data.approvedBy = null; data.approvedAt = null;
                data.rejectionReason = null; data.rejectedBy = null; data.rejectedAt = null;
                showNotification("File modified. Re-approval is now required.", false);
            }
            await setDoc(docRef, data, { merge: true });
        } else {
            data.createdBy = state.currentUser.displayName;
            data.createdAt = serverTimestamp();
            data.lastUpdatedBy = state.currentUser.displayName;
            data.updatedAt = serverTimestamp();
            data.status = 'pending';
            await setDoc(docRef, data);
        }
        
        hideLoader();
        showNotification("Job file saved successfully!");
        loadJobFileById(docId);

    } catch (error) {
        hideLoader();
        console.error("Error saving document: ", error);
        showNotification("Error saving job file.", true);
    }
}

function loadJobFiles() {
    const q = query(collection(db, 'jobfiles'));
    onSnapshot(q, (querySnapshot) => {
        state.jobFilesCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyFiltersAndDisplay();
        updateStatusSummary('status-summary-main', state.jobFilesCache);
    }, (error) => {
        console.error("Error fetching job files: ", error);
        showNotification("Error loading job files.", true);
    });
}

async function loadJobFileById(docId) {
    showLoader();
    try {
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const fileData = docSnap.data();
            populateFormFromData(fileData);
            logUserActivity(fileData.jfn);
            document.getElementById('job-file-no').disabled = true;
            closeModal('file-manager-modal');
            closeModal('user-jobs-modal');
            showNotification("Job file loaded successfully.");
        } else {
            showNotification("Document not found.", true);
        }
        hideLoader();
    } catch (error) {
        hideLoader();
        console.error("Error loading document:", error);
        showNotification("Error loading job file.", true);
    }
}

async function previewJobFileById(docId) {
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
                 const baseUrl = window.location.href.split('?')[0];
                const qrText = `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`;
                new QRCode(qrContainer, { text: qrText, width: 96, height: 96 });
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

async function checkJobFile(docId = null) {
    if (!state.currentUser || !['admin', 'checker'].includes(state.currentUser.role)) {
        showNotification("You do not have permission to check files.", true);
        return;
    }

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
    const checkData = {
        checkedBy: state.currentUser.displayName,
        checkedAt: serverTimestamp(),
        status: 'checked'
    };
    
    try {
        const docRef = doc(db, 'jobfiles', fileId);
        await setDoc(docRef, checkData, { merge: true });
        
        if (!docId) { 
            const updatedDoc = await getDoc(docRef);
            populateFormFromData(updatedDoc.data());
        } else { 
            refreshOpenModals();
        }
        
        hideLoader();
        showNotification("Job File Checked!");

    } catch (error) {
        hideLoader();
        console.error("Error checking document: ", error);
        showNotification("Error checking job file.", true);
    }
}

async function uncheckJobFile(docId) {
    if (!state.currentUser || !['admin', 'checker'].includes(state.currentUser.role)) {
        showNotification("You do not have permission to uncheck files.", true);
        return;
    }
    showLoader();
    try {
        const docRef = doc(db, 'jobfiles', docId);
        await updateDoc(docRef, {
            checkedBy: null,
            checkedAt: null,
            status: 'pending'
        });
        hideLoader();
        showNotification("Job File Unchecked!");
        refreshOpenModals();
    } catch (error) {
        hideLoader();
        console.error("Error unchecking document: ", error);
        showNotification("Error unchecking job file.", true);
    }
}

async function approveJobFile(docId = null) {
    if (state.currentUser.role !== 'admin') {
        showNotification("Only admins can approve job files.", true);
        return;
    }
    
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
    const approvalData = {
        approvedBy: state.currentUser.displayName,
        approvedAt: serverTimestamp(),
        status: 'approved',
        rejectionReason: null,
        rejectedBy: null,
        rejectedAt: null
    };
    
    try {
        const docRef = doc(db, 'jobfiles', fileId);
        await setDoc(docRef, approvalData, { merge: true });

        if (!docId) {
            const updatedDoc = await getDoc(docRef);
            populateFormFromData(updatedDoc.data());
        } else {
            refreshOpenModals();
        }

        hideLoader();
        showNotification("Job File Approved!");

    } catch (error) {
        hideLoader();
        console.error("Error approving document: ", error);
        showNotification("Error approving job file.", true);
    }
}

function promptForRejection(docId) {
    state.fileIdToReject = docId;
    openModal('reject-reason-modal', true);
}

async function rejectJobFile() {
    const reason = document.getElementById('rejection-reason-input').value.trim();
    if (!reason) {
        showNotification("Rejection reason is required.", true);
        return;
    }

    const docId = state.fileIdToReject || document.getElementById('job-file-no').value.replace(/\//g, '_');
    if (!docId) {
         showNotification("No file selected for rejection.", true);
         return;
    }

    showLoader();
    try {
        const docRef = doc(db, 'jobfiles', docId);
        await updateDoc(docRef, {
            status: 'rejected',
            rejectedBy: state.currentUser.displayName,
            rejectedAt: serverTimestamp(),
            rejectionReason: reason
        });
        
        if (state.fileIdToReject) {
            refreshOpenModals();
        } else {
            const updatedDoc = await getDoc(docRef);
            populateFormFromData(updatedDoc.data());
        }
        
        hideLoader();
        closeModal('reject-reason-modal');
        document.getElementById('rejection-reason-input').value = '';
        state.fileIdToReject = null;
        showNotification("Job File Rejected!");
    } catch (error) {
        hideLoader();
        console.error("Error rejecting document: ", error);
        showNotification("Error rejecting job file.", true);
    }
}

async function logUserActivity(jobFileNo) {
    if (!state.currentUser) return;
    try {
        let logs = JSON.parse(localStorage.getItem('userActivityLog') || '[]');
        logs.unshift({ user: state.currentUser.displayName, file: jobFileNo, timestamp: new Date().toISOString() });
        if (logs.length > 200) logs.splice(200);
        localStorage.setItem('userActivityLog', JSON.stringify(logs));
    } catch (error) {
        console.error("Error logging activity to localStorage: ", error);
    }
}

function openUserActivityLog() {
    const logBody = document.getElementById('activity-log-body');
    let logs = [];
    try {
        logs = JSON.parse(localStorage.getItem('userActivityLog') || '[]');
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

async function moveToRecycleBin(docId) {
    showLoader();
    try {
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dataToMove = docSnap.data();
            dataToMove.deletedAt = serverTimestamp();
            dataToMove.deletedBy = state.currentUser.displayName;
            
            const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
            await setDoc(deletedDocRef, dataToMove);
            await deleteDoc(docRef);
            
            showNotification("Job file moved to recycle bin.");
        } else {
            throw new Error("Document not found in main collection.");
        }
    } catch (error) {
        console.error("Error moving to recycle bin:", error);
        showNotification("Error deleting job file.", true);
    } finally {
        hideLoader();
    }
}

function confirmDelete(docId, type = 'jobfile') {
     if (state.currentUser.role !== 'admin') {
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
        const client = state.clientsCache.find(c => c.id === docId);
        message = `Are you sure you want to delete the client "${client?.name || 'this client'}"? This action cannot be undone.`;
        onOk = () => deleteClient(docId);
    }

    modal.querySelector('#confirm-message').innerHTML = message;
    modal.querySelector('#confirm-ok').className = 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded';
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const cancelButton = modal.querySelector('#confirm-cancel');

    const handleOkClick = () => {
        onOk();
        closeConfirm();
    };
    const closeConfirm = () => {
        closeModal('confirm-modal');
        okButton.removeEventListener('click', handleOkClick);
        cancelButton.removeEventListener('click', closeConfirm);
    };
    
    okButton.addEventListener('click', handleOkClick, { once: true });
    cancelButton.addEventListener('click', closeConfirm, { once: true });
}

// --- Analytics ---
function openAnalyticsDashboard() {
    filterAnalyticsByTimeframe('all');
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('analytics-container').style.display = 'block';
    window.scrollTo(0, 0);
}
function closeAnalyticsDashboard() {
    document.getElementById('analytics-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
}

function filterAnalyticsByTimeframe(timeframe, dateType = 'bd') {
    let jobs = state.jobFilesCache;
    const now = new Date();

    if (timeframe !== 'all') {
        jobs = jobs.filter(job => {
            const dateField = dateType === 'bd' ? job.bd : job.d;
            if (!dateField) return false;
            const jobDate = new Date(dateField);
            if (timeframe === 'thisYear') return jobDate.getFullYear() === now.getFullYear();
            if (timeframe === 'lastYear') return jobDate.getFullYear() === now.getFullYear() - 1;
            if (timeframe.includes('-')) {
                const [year, month] = timeframe.split('-').map(Number);
                return jobDate.getFullYear() === year && jobDate.getMonth() === month - 1;
            }
            return true;
        });
    }
    state.currentFilteredJobs = jobs;
    //calculateAndDisplayAnalytics(jobs);
}

// --- Client Management ---
function openClientManager() {
    openModal('client-manager-modal');
}
function loadClients() {
    onSnapshot(query(collection(db, 'clients')), (snapshot) => {
        state.clientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.clientsCache.sort((a, b) => a.name.localeCompare(b.name));
        displayClients(state.clientsCache);
    }, (error) => {
        showNotification("Could not load clients.", true);
    });
}
async function saveClient(event) {
    event.preventDefault();
    const clientId = document.getElementById('client-id').value;
    const clientName = document.getElementById('client-name').value.trim();
    if (!clientName) {
        showNotification("Client name is required.", true);
        return;
    }
    const clientData = {
        name: clientName,
        address: document.getElementById('client-address').value.trim(),
        contactPerson: document.getElementById('client-contact-person').value.trim(),
        phone: document.getElementById('client-phone').value.trim(),
        type: document.getElementById('client-type').value,
        updatedAt: serverTimestamp()
    };

    showLoader();
    try {
        if (clientId) {
            await setDoc(doc(db, 'clients', clientId), clientData, { merge: true });
        } else {
            clientData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'clients'), clientData);
        }
        showNotification("Client saved successfully!");
        clearClientForm();
    } catch (error) {
        showNotification("Could not save client.", true);
    } finally {
        hideLoader();
    }
}
async function deleteClient(clientId) {
    showLoader();
    try {
        await deleteDoc(doc(db, 'clients', clientId));
        showNotification("Client deleted successfully.");
    } catch (error) {
        showNotification("Could not delete client.", true);
    } finally {
        hideLoader();
    }
}

// --- Charge Descriptions ---
function openChargeManager() {
    displayChargeDescriptions();
    openModal('charge-manager-modal');
}
function loadChargeDescriptions() {
    const stored = localStorage.getItem('chargeDescriptions');
    if (stored) {
        state.chargeDescriptions = JSON.parse(stored);
    } else {
        state.chargeDescriptions = [ 'Ex-works Charges:', 'Land/Air / Sea Freight:', 'Fuell Security / War Surcharge:', 'Formalities:', 'Delivery Order Fee:', 'Transportation Charges:', 'Inspection / Computer Print Charges:', 'Handling Charges:', 'Labor / Forklift Charges:', 'Documentation Charges:', 'Clearance Charges:', 'Customs Duty:', 'Terminal Handling Charges:', 'Legalization Charges:', 'Demurrage Charges:', 'Loading / Offloading Charges:', 'Destination Clearance Charges:', 'Packing Charges:', 'Port Charges:', 'Other Charges:', 'PAI Approval :', 'Insurance Fee :', 'EPA Charges :'];
        localStorage.setItem('chargeDescriptions', JSON.stringify(state.chargeDescriptions));
    }
}
function saveChargeDescription() {
    const input = document.getElementById('new-charge-description');
    const newDesc = input.value.trim();
    if (newDesc && !state.chargeDescriptions.includes(newDesc)) {
        state.chargeDescriptions.push(newDesc);
        localStorage.setItem('chargeDescriptions', JSON.stringify(state.chargeDescriptions));
        displayChargeDescriptions();
        input.value = '';
    }
}
function deleteChargeDescription(description) {
    state.chargeDescriptions = state.chargeDescriptions.filter(d => d !== description);
    localStorage.setItem('chargeDescriptions', JSON.stringify(state.chargeDescriptions));
    displayChargeDescriptions();
}


// --- AI Functions ---
async function generateRemarks() {
    showLoader();
    try {
        const data = getFormData();
        const prompt = `Generate professional remarks for a freight forwarding job file. Be concise. Details: Product: ${(data.pt || []).join(', ')}, Clearance: ${(data.cl || []).join(', ')}, Shipper: ${data.sh}, Consignee: ${data.co}, Origin: ${data.or}, Destination: ${data.de}, Goods: ${data.dsc}.`;
        const result = await callGeminiApi(prompt);
        if (result) {
            document.getElementById('remarks').value = result;
            showNotification("Remarks generated successfully! ✨");
        }
    } catch (error) {
        showNotification("Could not generate remarks.", true);
    } finally {
        hideLoader();
    }
}

async function suggestCharges() {
    showLoader();
    try {
        const data = getFormData();
        const prompt = `Based on job details (Product: ${data.pt.join(', ')}, Clearance: ${data.cl.join(', ')}, From: ${data.or} To: ${data.de}, Weight: ${data.gw}), suggest applicable charges from this list: ${state.chargeDescriptions.join(', ')}. Provide a JSON object like {"charges": [{"chargeName": "name", "cost": 100, "selling": 120}]}. Estimate cost and selling in KWD.`;
        const result = await callGeminiApi(prompt, true);
        const parsed = JSON.parse(result);
        if (parsed.charges && Array.isArray(parsed.charges)) {
            const tableBody = document.getElementById('charges-table-body');
            tableBody.innerHTML = '';
            parsed.charges.forEach(charge => addChargeRow({l: charge.chargeName, c: charge.cost, s: charge.selling}));
            calculate();
            showNotification("Charges suggested! ✨");
        }
    } catch (error) {
         showNotification("Could not suggest charges.", true);
    } finally {
        hideLoader();
    }
}

// --- Form Data ---
function getFormData() {
    const getVal = id => document.getElementById(id).value || '';
    const getChecked = query => Array.from(document.querySelectorAll(query)).filter(el => el.checked).map(el => el.dataset.clearance || el.dataset.product);

    const charges = [];
    document.querySelectorAll('#charges-table-body tr').forEach(row => {
        const description = row.querySelector('.description-input').value.trim();
        if (description) {
            charges.push({
                l: description,
                c: row.querySelector('.cost-input').value || '0',
                s: row.querySelector('.selling-input').value || '0',
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

function applyFiltersAndDisplay() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const fromDate = document.getElementById('filter-date-from').value;
    const toDate = document.getElementById('filter-date-to').value;

    let filteredFiles = state.jobFilesCache.filter(file => {
        const searchData = [file.jfn, file.sh, file.co, file.mawb, file.hawb].join(' ').toLowerCase();
        if (searchTerm && !searchData.includes(searchTerm)) return false;
        if (statusFilter && file.status !== statusFilter) return false;
        if (fromDate && file.d < fromDate) return false;
        if (toDate && file.d > toDate) return false;
        return true;
    });

    displayJobFiles(filteredFiles);
}


function attachEventListeners() {
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('save-job-btn').addEventListener('click', saveJobFile);
    document.getElementById('new-job-btn').addEventListener('click', clearForm);
    document.getElementById('open-analytics-btn').addEventListener('click', openAnalyticsDashboard);

    document.getElementById('check-btn').addEventListener('click', () => checkJobFile());
    document.getElementById('approve-btn').addEventListener('click', () => approveJobFile());
    document.getElementById('reject-btn').addEventListener('click', () => promptForRejection(null));
    document.getElementById('confirm-reject-btn').addEventListener('click', rejectJobFile);
    document.getElementById('cancel-reject-modal-btn').addEventListener('click', () => closeModal('reject-reason-modal'));

    document.getElementById('file-manager-btn').addEventListener('click', () => openModal('file-manager-modal'));
    document.getElementById('client-manager-btn').addEventListener('click', openClientManager);
    document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
    document.getElementById('activity-log-btn').addEventListener('click', openUserActivityLog);
    document.getElementById('manage-charges-btn').addEventListener('click', openChargeManager);
    
    document.getElementById('close-file-manager-modal').addEventListener('click', () => closeModal('file-manager-modal'));
    document.getElementById('close-preview-modal').addEventListener('click', () => closeModal('preview-modal'));
    document.getElementById('close-admin-panel-modal').addEventListener('click', () => closeModal('admin-panel-modal'));
    document.getElementById('close-client-manager-modal').addEventListener('click', () => closeModal('client-manager-modal'));
    document.getElementById('close-charge-manager-modal').addEventListener('click', () => closeModal('charge-manager-modal'));
    document.getElementById('close-activity-log-modal').addEventListener('click', () => closeModal('activity-log-modal'));
    document.getElementById('close-user-jobs-modal').addEventListener('click', () => closeModal('user-jobs-modal'));
    document.getElementById('close-recycle-bin-modal').addEventListener('click', () => closeModal('recycle-bin-modal'));
    document.getElementById('confirm-cancel').addEventListener('click', () => closeModal('confirm-modal'));
    
    document.getElementById('print-page-btn').addEventListener('click', printPage);
    document.getElementById('print-preview-btn').addEventListener('click', printPreview);
    
    document.getElementById('search-bar').addEventListener('input', applyFiltersAndDisplay);
    document.getElementById('filter-status').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('filter-date-from').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('filter-date-to').addEventListener('change', applyFiltersAndDisplay);
    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        document.getElementById('search-bar').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        applyFiltersAndDisplay();
    });
    document.getElementById('recycle-bin-btn').addEventListener('click', openRecycleBin);

    document.getElementById('client-form').addEventListener('submit', saveClient);
    document.getElementById('clear-client-form-btn').addEventListener('click', clearClientForm);
    document.getElementById('client-search-bar').addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        displayClients(state.clientsCache.filter(c => c.name.toLowerCase().includes(searchTerm)));
    });

    document.getElementById('save-charge-description-btn').addEventListener('click', saveChargeDescription);
    document.getElementById('charge-description-list').addEventListener('click', e => {
        if(e.target.tagName === 'BUTTON') deleteChargeDescription(e.target.dataset.desc);
    });

    document.getElementById('generate-remarks-btn').addEventListener('click', generateRemarks);
    document.getElementById('suggest-charges-btn').addEventListener('click', suggestCharges);

    setupAutocomplete('shipper-name', 'shipper-suggestions', 'Shipper');
    setupAutocomplete('consignee-name', 'consignee-suggestions', 'Consignee');
    
    document.getElementById('add-charge-btn').addEventListener('click', () => addChargeRow());

    // Make functions globally accessible for inline onclick handlers if any
    window.previewJobFileById = previewJobFileById;
    window.loadJobFileById = loadJobFileById;
    window.confirmDelete = confirmDelete;
    window.editClient = editClient;
    window.checkJobFile = checkJobFile;
    window.uncheckJobFile = uncheckJobFile;
    window.approveJobFile = approveJobFile;
    window.promptForRejection = promptForRejection;
    window.confirmPermanentDelete = confirmPermanentDelete;
    window.restoreJobFile = (id) => console.log('restore', id); // Placeholder
    window.saveUserChanges = saveUserChanges;
    
    state.listenersAttached = true;
}

function printPage() {
    const data = getFormData();
    // This is a simplified print. We need getPrintViewHtml function for a full one.
    const printHTML = getPrintViewHtml(data, false);
    createPrintWindow('Job File', printHTML);
}

function printPreview() {
    const previewBody = document.getElementById('preview-body').innerHTML;
    createPrintWindow('Job File Preview', previewBody);
}
