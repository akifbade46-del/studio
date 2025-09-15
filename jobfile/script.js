
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from './firestore.js';
import { 
    showLoader, hideLoader, showNotification, openModal, closeModal, 
    populateFormFromData, clearForm, addChargeRow, populateTable, calculate, 
    displayJobFiles, updateStatusSummary, getPrintViewHtml 
} from './ui.js';
import { 
    saveJobFile, loadJobFileById, previewJobFileById, loadJobFiles, 
    logUserActivity, loadClients, loadChargeDescriptions, saveChargeDescription, 
    saveUserChanges, backupAllData, handleRestoreFile, deleteChargeDescription,
    approveFile, rejectFile, checkFile
} from './firestore.js';
import { callGeminiApi } from './gemini.js';
import { state } from './state.js';


function initializeApp() {
    // Check if we are on the main app page
    if (!document.getElementById('app-container')) return;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            showLoader();
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().status === 'active') {
                    state.currentUser = { uid: user.uid, ...userDoc.data() };
                    initializeMainApp();
                } else {
                    // This handles cases where user is inactive, blocked, or deleted from DB
                    window.location.href = 'index.html';
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                showNotification("Could not verify user. Logging out.", true);
                window.location.href = 'index.html';
            } finally {
                hideLoader();
            }
        } else {
            window.location.href = 'index.html';
        }
    });
}

function initializeMainApp() {
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

async function generateRemarks() {
    showLoader();
    try {
        const data = getFormData();
        const prompt = `Generate professional remarks for a freight forwarding job file with the following details. Be concise.
            - Product Type: ${(data.pt || []).join(', ') || 'N/A'}
            - Shipper: ${data.sh || 'N/A'}, Consignee: ${data.co || 'N/A'}
            - Origin: ${data.or || 'N/A'}, Destination: ${data.de || 'N/A'}
            - Goods: ${data.dsc || 'N/A'}`;

        const result = await callGeminiApi(prompt);
        
        if (result) {
            document.getElementById('remarks').value = result;
            showNotification("Remarks generated successfully! ✨");
        } else {
            throw new Error("Invalid response from Gemini API.");
        }

    } catch (error) {
        showNotification("Could not generate remarks. AI feature might be disabled.", true);
    } finally {
        hideLoader();
    }
}

async function suggestCharges() {
    showNotification("Suggest Charges feature is under development.", false);
    // Future implementation will use Gemini
}

function printPage() {
    const data = getFormData();
    const printContent = getPrintViewHtml(data, true);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

function printPreview() {
    const previewBody = document.getElementById('preview-body');
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Print Preview</title><link rel="stylesheet" href="style.css"></head><body>');
    printWindow.document.write(previewBody.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}


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


function attachEventListeners() {
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    document.getElementById('save-job-btn').addEventListener('click', () => saveJobFile(getFormData()));
    document.getElementById('new-job-btn').addEventListener('click', clearForm);
    document.getElementById('print-page-btn').addEventListener('click', printPage);
    
    document.getElementById('add-charge-btn').addEventListener('click', () => addChargeRow());
    document.getElementById('charges-table').addEventListener('input', e => {
        if (e.target.classList.contains('cost-input') || e.target.classList.contains('selling-input')) {
            calculate();
        }
    });

    // AI Buttons
    document.getElementById('generate-remarks-btn').addEventListener('click', generateRemarks);
    document.getElementById('suggest-charges-btn').addEventListener('click', suggestCharges);

    // Approval Buttons
    document.getElementById('check-btn').addEventListener('click', checkFile);
    document.getElementById('approve-btn').addEventListener('click', approveFile);
    document.getElementById('reject-btn').addEventListener('click', () => {
        const jobFileNo = document.getElementById('job-file-no').value.trim();
        if (!jobFileNo || document.getElementById('job-file-no').disabled === false) {
            showNotification("Load a file before rejecting.", true);
            return;
        }
        openModal('reject-reason-modal');
    });
    document.getElementById('confirm-reject-btn').addEventListener('click', rejectFile);
    document.getElementById('cancel-reject-modal-btn').addEventListener('click', () => closeModal('reject-reason-modal'));


    // Modal Openers
    document.getElementById('file-manager-btn').addEventListener('click', () => openModal('file-manager-modal'));
    document.getElementById('client-manager-btn').addEventListener('click', () => openModal('client-manager-modal'));
    document.getElementById('manage-charges-btn').addEventListener('click', () => openModal('charge-manager-modal'));
    document.getElementById('admin-panel-btn').addEventListener('click', () => openModal('admin-panel-modal'));
    document.getElementById('activity-log-btn').addEventListener('click', () => openModal('activity-log-modal'));
    document.getElementById('recycle-bin-btn').addEventListener('click', () => {
        closeModal('file-manager-modal');
        openModal('recycle-bin-modal');
    });

    // Modal Closers
    document.getElementById('close-file-manager-modal').addEventListener('click', () => closeModal('file-manager-modal'));
    document.getElementById('close-preview-modal').addEventListener('click', () => closeModal('preview-modal'));
    document.getElementById('close-client-manager-modal').addEventListener('click', () => closeModal('client-manager-modal'));
    document.getElementById('close-charge-manager-modal').addEventListener('click', () => closeModal('charge-manager-modal'));
    document.getElementById('close-admin-panel-modal').addEventListener('click', () => closeModal('admin-panel-modal'));
    document.getElementById('close-activity-log-modal').addEventListener('click', () => closeModal('activity-log-modal'));
    document.getElementById('close-recycle-bin-modal').addEventListener('click', () => closeModal('recycle-bin-modal'));
    document.getElementById('close-user-jobs-modal').addEventListener('click', () => closeModal('user-jobs-modal'));
    document.getElementById('confirm-cancel').addEventListener('click', () => closeModal('confirm-modal'));
    

    // Client Manager
    document.getElementById('client-form').addEventListener('submit', (e) => {
        e.preventDefault();
        // client save logic is in firestore.js, not yet implemented
    });
    document.getElementById('clear-client-form-btn').addEventListener('click', () => {
        // clear client form logic
    });

    // Charge Manager
    document.getElementById('save-charge-description-btn').addEventListener('click', saveChargeDescription);
    document.getElementById('charge-description-list').addEventListener('click', (e) => {
        if(e.target.dataset.action === 'delete') {
            deleteChargeDescription(e.target.dataset.description);
        }
    });

    // Admin Panel
    document.getElementById('save-user-changes-btn').addEventListener('click', saveUserChanges);
    document.getElementById('backup-data-btn').addEventListener('click', backupAllData);
    document.getElementById('restore-file-input').addEventListener('change', handleRestoreFile);

    // Preview and Print
    document.getElementById('print-preview-btn').addEventListener('click', printPreview);

    // File list interactions
    document.getElementById('job-files-list').addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const id = button.dataset.id;
        if(button.dataset.action === 'load') loadJobFileById(id);
        if(button.dataset.action === 'preview') previewJobFileById(id);
    });
}

// --- App Entry Point ---
initializeApp();
