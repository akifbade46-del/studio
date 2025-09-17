import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getDb, getCurrentUser, getJobFilesCache, getClientsCache, setJobFilesCache, setClientsCache, setFileIdToReject } from './state.js';
import { showLoader, hideLoader, showNotification, populateFormFromData, refreshOpenModals, closeModal, openModal, displayJobFiles, updateStatusSummary, openRecycleBin, logUserActivity } from './ui.js';

// --- Data Extraction ---
export function getFormData() {
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

    const currentUser = getCurrentUser();
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
        pb: document.getElementById('prepared-by').value || currentUser.displayName,
    };
}


// --- Job File CRUD ---

export function loadJobFiles() {
    const db = getDb();
    if (!db) return;
    const jobFilesCollection = collection(db, 'jobfiles');
    const q = query(jobFilesCollection);

    onSnapshot(q, (querySnapshot) => {
        const jobFiles = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        jobFiles.sort((a, b) => (b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0) - (a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0));
        setJobFilesCache(jobFiles);
        
        displayJobFiles(jobFiles);
        updateStatusSummary('status-summary-main', jobFiles);

    }, (error) => {
        console.error("Error fetching job files: ", error);
        showNotification("Error loading job files.", true);
    });
}


export async function saveJobFile() {
    const db = getDb();
    if (!db) { showNotification("Database not connected.", true); return; }
    
    const jobFileNoInput = document.getElementById('job-file-no');
    const jobFileNo = jobFileNoInput.value.trim();
    const isUpdating = jobFileNoInput.disabled;

    if (!jobFileNo) { 
        showNotification("Please enter a Job File No.", true); 
        return; 
    }
    
    showLoader();
    const docId = jobFileNo.replace(/\//g, '_');

    // Duplicate check
    if (!isUpdating) {
        const docRefCheck = doc(db, 'jobfiles', docId);
        const docSnapCheck = await getDoc(docRefCheck);
        if (docSnapCheck.exists()) {
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
        const currentUser = getCurrentUser();

        if (docSnap.exists()) {
            data.lastUpdatedBy = currentUser.displayName;
            data.updatedAt = serverTimestamp();

            if (docSnap.data().status === 'approved' || docSnap.data().status === 'checked') {
                data.status = 'pending';
                data.checkedBy = null;
                data.checkedAt = null;
                data.approvedBy = null;
                data.approvedAt = null;
                data.rejectionReason = null;
                data.rejectedBy = null;
                data.rejectedAt = null;
                showNotification("File modified. Re-approval is now required.", false);
            }
            await setDoc(docRef, data, { merge: true });
        } else {
            data.createdBy = currentUser.displayName;
            data.createdAt = serverTimestamp();
            data.lastUpdatedBy = currentUser.displayName;
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


export async function loadJobFileById(docId) {
    showLoader();
    const db = getDb();
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

// --- Approval Flow ---

export async function checkJobFile(docId = null) {
    const currentUser = getCurrentUser();
    if (!currentUser || !['admin', 'checker'].includes(currentUser.role)) {
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
        checkedBy: currentUser.displayName,
        checkedAt: serverTimestamp(),
        status: 'checked'
    };
    
    try {
        const db = getDb();
        const docRef = doc(db, 'jobfiles', fileId);
        await setDoc(docRef, checkData, { merge: true });
        
        if (!docId) { // If called from main form
            const updatedDoc = await getDoc(docRef);
            populateFormFromData(updatedDoc.data());
        } else { // If called from a modal
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

export async function uncheckJobFile(docId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !['admin', 'checker'].includes(currentUser.role)) {
        showNotification("You do not have permission to uncheck files.", true);
        return;
    }
    showLoader();
    const uncheckData = {
        checkedBy: null,
        checkedAt: null,
        status: 'pending'
    };
    try {
        const db = getDb();
        const docRef = doc(db, 'jobfiles', docId);
        await setDoc(docRef, uncheckData, { merge: true });
        hideLoader();
        showNotification("Job File Unchecked!");
        refreshOpenModals();
    } catch (error) {
        hideLoader();
        console.error("Error unchecking document: ", error);
        showNotification("Error unchecking job file.", true);
    }
}

export async function approveJobFile(docId = null) {
    const currentUser = getCurrentUser();
    if (currentUser.role !== 'admin') {
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
        approvedBy: currentUser.displayName,
        approvedAt: serverTimestamp(),
        status: 'approved',
        rejectionReason: null,
        rejectedBy: null,
        rejectedAt: null
    };
    
    try {
        const db = getDb();
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

export function promptForRejection(docId) {
    setFileIdToReject(docId);
    openModal('reject-reason-modal', true);
}

export async function rejectJobFile() {
    const reason = document.getElementById('rejection-reason-input').value.trim();
    if (!reason) {
        showNotification("Rejection reason is required.", true);
        return;
    }

    const { getFileIdToReject } = await import('./state.js');
    const fileIdToReject = getFileIdToReject();
    const docId = fileIdToReject || document.getElementById('job-file-no').value.replace(/\//g, '_');
    if (!docId) {
         showNotification("No file selected for rejection.", true);
         return;
    }

    showLoader();
    const currentUser = getCurrentUser();
    const rejectionData = {
        rejectedBy: currentUser.displayName,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason,
        status: 'rejected'
    };

    try {
        const db = getDb();
        const docRef = doc(db, 'jobfiles', docId);
        await setDoc(docRef, rejectionData, { merge: true });
        
        if (fileIdToReject) {
            refreshOpenModals();
        } else {
            const updatedDoc = await getDoc(docRef);
            populateFormFromData(updatedDoc.data());
        }
        
        hideLoader();
        closeModal('reject-reason-modal');
        document.getElementById('rejection-reason-input').value = '';
        setFileIdToReject(null);
        showNotification("Job File Rejected!");
    } catch (error) {
        hideLoader();
        console.error("Error rejecting document: ", error);
        showNotification("Error rejecting job file.", true);
    }
}


// --- Recycle Bin ---

export async function moveToRecycleBin(docId) {
    showLoader();
    const db = getDb();
    const currentUser = getCurrentUser();
    try {
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dataToMove = docSnap.data();
            dataToMove.deletedAt = serverTimestamp();
            dataToMove.deletedBy = currentUser.displayName;
            
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

export function confirmDelete(docId, type = 'jobfile') {
    const currentUser = getCurrentUser();
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
        const clientsCache = getClientsCache();
        const client = clientsCache.find(c => c.id === docId);
        message = `Are you sure you want to delete the client "${client?.name || 'this client'}"? This action cannot be undone.`;
        onOk = () => deleteClient(docId);
    }

    modal.querySelector('#confirm-message').innerHTML = message;
    modal.querySelector('#confirm-ok').className = 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded';
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const handleOkClick = () => {
        onOk();
        closeConfirm();
    };
    const closeConfirm = () => {
        closeModal('confirm-modal');
        okButton.removeEventListener('click', handleOkClick);
    };
    
    okButton.addEventListener('click', handleOkClick, { once: true });
}


export async function restoreJobFile(docId) {
    showLoader();
    const db = getDb();
    try {
        const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
        const docSnap = await getDoc(deletedDocRef);

        if (docSnap.exists()) {
            const dataToRestore = docSnap.data();
            delete dataToRestore.deletedAt;
            delete dataToRestore.deletedBy;

            const newDocRef = doc(db, 'jobfiles', docId);
            await setDoc(newDocRef, dataToRestore);
            await deleteDoc(deletedDocRef);

            showNotification("Job file restored successfully.");
            openRecycleBin(); // Refresh the recycle bin view
        } else {
            throw new Error("Document not found in recycle bin.");
        }
    } catch (error) {
        console.error("Error restoring file:", error);
        showNotification("Error restoring file.", true);
    } finally {
        hideLoader();
    }
}

export function confirmPermanentDelete(docId) {
    const modal = document.getElementById('confirm-modal');
    modal.querySelector('#confirm-title').textContent = 'Confirm Permanent Deletion';
    modal.querySelector('#confirm-message').innerHTML = `Are you sure you want to permanently delete job file "${docId.replace(/_/g, '/')}"? <b class="text-red-600">This action cannot be undone.</b>`;
    modal.querySelector('#confirm-ok').className = 'bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded';
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const onOk = () => {
        permanentlyDeleteJobFile(docId);
        closeConfirm();
    };
    const closeConfirm = () => {
        closeModal('confirm-modal');
        okButton.removeEventListener('click', onOk);
    };

    okButton.addEventListener('click', onOk, { once: true });
}


export async function permanentlyDeleteJobFile(docId) {
    showLoader();
    const db = getDb();
    try {
        const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
        await deleteDoc(deletedDocRef);
        showNotification("Job file permanently deleted.");
        openRecycleBin(); // Refresh the recycle bin view
    } catch (error) {
        console.error("Error permanently deleting file:", error);
        showNotification("Could not permanently delete file.", true);
    } finally {
        hideLoader();
    }
}


// --- Client Management ---

export function loadClients() {
    const db = getDb();
    if (!db) return;
    const clientsCollection = collection(db, 'clients');
    onSnapshot(query(clientsCollection), (snapshot) => {
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clients.sort((a, b) => a.name.localeCompare(b.name));
        setClientsCache(clients);
        // This will be displayed by the main script after loading
    }, (error) => {
        console.error("Error loading clients:", error);
        showNotification("Could not load clients.", true);
    });
}

export async function saveClient(event) {
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
    const db = getDb();
    try {
        let docRef;
        if (clientId) {
            // Update existing client
            docRef = doc(db, 'clients', clientId);
            await setDoc(docRef, clientData, { merge: true });
            showNotification("Client updated successfully!");
        } else {
            // Add new client
            clientData.createdAt = serverTimestamp();
            const clientsCollection = collection(db, 'clients');
            docRef = await addDoc(clientsCollection, clientData);
            showNotification("Client added successfully!");
        }
        const { clearClientForm } = await import('./ui.js');
        clearClientForm();
    } catch (error) {
        console.error("Error saving client:", error);
        showNotification("Could not save client.", true);
    } finally {
        hideLoader();
    }
}

export async function deleteClient(clientId) {
    showLoader();
    const db = getDb();
    try {
        await deleteDoc(doc(db, 'clients', clientId));
        showNotification("Client deleted successfully.");
    } catch (error) {
        console.error("Error deleting client:", error);
        showNotification("Could not delete client.", true);
    } finally {
        hideLoader();
    }
}

// --- Charge Descriptions ---

export function loadChargeDescriptions() {
    const { setChargeDescriptions } = await import('./state.js');
    const storedDescriptions = localStorage.getItem('chargeDescriptions');
    let descriptions = [];
    if (storedDescriptions) {
        descriptions = JSON.parse(storedDescriptions);
    } else {
        descriptions = [
            'Ex-works Charges:', 'Land/Air / Sea Freight:', 'Fuell Security / War Surcharge:', 'Formalities:', 'Delivery Order Fee:', 'Transportation Charges:', 'Inspection / Computer Print Charges:', 'Handling Charges:', 'Labor / Forklift Charges:', 'Documentation Charges:', 'Clearance Charges:', 'Customs Duty:', 'Terminal Handling Charges:', 'Legalization Charges:', 'Demurrage Charges:', 'Loading / Offloading Charges:', 'Destination Clearance Charges:', 'Packing Charges:', 'Port Charges:', 'Other Charges:', 'PAI Approval :', 'Insurance Fee :', 'EPA Charges :'
        ];
        localStorage.setItem('chargeDescriptions', JSON.stringify(descriptions));
    }
    setChargeDescriptions(descriptions);
}


export async function saveChargeDescription() {
    const { getChargeDescriptions, setChargeDescriptions } = await import('./state.js');
    const { displayChargeDescriptions } = await import('./ui.js');

    const input = document.getElementById('new-charge-description');
    const newDesc = input.value.trim();
    const chargeDescriptions = getChargeDescriptions();

    if (newDesc && !chargeDescriptions.includes(newDesc)) {
        const newDescriptions = [...chargeDescriptions, newDesc];
        setChargeDescriptions(newDescriptions);
        localStorage.setItem('chargeDescriptions', JSON.stringify(newDescriptions));
        displayChargeDescriptions();
        input.value = '';
    }
}

export async function deleteChargeDescription(description) {
    const { getChargeDescriptions, setChargeDescriptions } = await import('./state.js');
    const { displayChargeDescriptions } = await import('./ui.js');
    
    const chargeDescriptions = getChargeDescriptions();
    const newDescriptions = chargeDescriptions.filter(d => d !== description);
    setChargeDescriptions(newDescriptions);
    localStorage.setItem('chargeDescriptions', JSON.stringify(newDescriptions));
    displayChargeDescriptions();
}


// --- Backup & Restore ---
export async function backupAllData() {
    const currentUser = getCurrentUser();
    if (currentUser.role !== 'admin') {
        showNotification("Access denied. Only admins can perform backups.", true);
        return;
    }
    showLoader();
    const db = getDb();
    try {
        const jobFilesQuery = query(collection(db, 'jobfiles'));
        const usersQuery = query(collection(db, 'users'));

        const jobFilesSnapshot = await getDocs(jobFilesQuery);
        const usersSnapshot = await getDocs(usersQuery);

        const jobfilesData = jobFilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const backupData = {
            version: "1.0",
            createdAt: new Date().toISOString(),
            data: {
                jobfiles: jobfilesData,
                users: usersData
            }
        };

        const jsonString = JSON.stringify(backupData, (key, value) => {
            if (value && typeof value.toDate === 'function') {
                return value.toDate().toISOString();
            }
            return value;
        }, 2);

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        link.download = `qgo-cargo-backup-${date}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);

        showNotification("Backup created and download started successfully.");

    } catch (error) {
        console.error("Backup failed:", error);
        showNotification("An error occurred during backup.", true);
    } finally {
        hideLoader();
    }
}

export async function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const currentUser = getCurrentUser();

    if (currentUser.role !== 'admin') {
        showNotification("Access denied. Only admins can restore data.", true);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        try {
            const backupData = JSON.parse(content);

            if (!backupData.data || !backupData.data.jobfiles || !backupData.data.users) {
                showNotification("Invalid backup file format.", true);
                return;
            }

            const jobFileCount = backupData.data.jobfiles.length;
            const userCount = backupData.data.users.length;

            const modal = document.getElementById('confirm-modal');
            modal.querySelector('#confirm-title').textContent = 'Confirm Data Restore';
            modal.querySelector('#confirm-message').innerHTML = `
                <p>You are about to restore <b>${jobFileCount} job files</b> and <b>${userCount} users</b> from the selected file.</p>
                <p class="mt-2">This will <b class="underline">overwrite any existing data</b> with the content from the backup file.</p>
                <p class="mt-2 text-red-600 font-bold">This action cannot be undone. Are you sure you want to proceed?</p>
            `;
            modal.querySelector('#confirm-ok').className = 'bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded';
            openModal('confirm-modal');

            const okButton = modal.querySelector('#confirm-ok');
            const onOk = async () => {
                closeConfirm();
                showLoader();
                try {
                    const db = getDb();
                    const restoreBatch = writeBatch(db);
                    
                    backupData.data.jobfiles.forEach(jobFile => {
                        const docRef = doc(db, 'jobfiles', jobFile.id);
                        const { id, ...dataToRestore } = jobFile;
                        restoreBatch.set(docRef, dataToRestore);
                    });

                    backupData.data.users.forEach(user => {
                        const docRef = doc(db, 'users', user.id);
                        const { id, ...dataToRestore } = user;
restoreBatch.set(docRef, dataToRestore);
                    });

                    await restoreBatch.commit();
                    showNotification("Data restored successfully! The page will now reload.");
                    setTimeout(() => window.location.reload(), 2000);

                } catch (error) {
                    console.error("Restore failed:", error);
                    showNotification("An error occurred during restore. Data may be partially restored.", true);
                } finally {
                    hideLoader();
                }
            };

            const closeConfirm = () => {
                closeModal('confirm-modal');
                okButton.removeEventListener('click', onOk);
            };

            okButton.addEventListener('click', onOk, { once: true });

        } catch (error) {
            console.error("Error reading restore file:", error);
            showNotification("Failed to read or parse the backup file. Please ensure it's a valid JSON backup.", true);
        } finally {
            event.target.value = '';
        }
    };

    reader.readAsText(file);
}
