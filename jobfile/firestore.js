import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './auth.js';
import { showLoader, hideLoader, showNotification, populateFormFromData, refreshOpenModals, displayJobFiles, updateStatusSummary, displayClients, clearClientForm, closeModal, openRecycleBin, openModal, getPrintViewHtml } from './ui.js';
import { getFormData, logUserActivity, getPrintViewHtmlForPreview } from './utils.js';
import { currentUser, setJobFilesCache, setClientsCache, clientsCache } from './state.js';

// --- Job File Data Handling ---
export function loadJobFiles() {
    if (!db) return;
    const jobFilesCollection = collection(db, 'jobfiles');
    const q = query(jobFilesCollection);

    onSnapshot(q, (querySnapshot) => {
        const jobFiles = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJobFilesCache(jobFiles);
        
        const sortedDocs = [...jobFiles].sort((a,b) => (b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0) - (a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0));
        
        displayJobFiles(sortedDocs);
        updateStatusSummary(jobFiles);

    }, (error) => {
        console.error("Error fetching job files: ", error);
        showNotification("Error loading job files.", true);
    });
}

export async function saveJobFile() {
    if (!db) { showNotification("Database not connected.", true); return; }
    
    const jobFileNoInput = document.getElementById('job-file-no');
    const jobFileNo = jobFileNoInput.value.trim();
    const isUpdating = jobFileNoInput.disabled;

    const invoiceNo = document.getElementById('invoice-no').value.trim();
    const mawbNo = document.getElementById('mawb').value.trim();

    if (!jobFileNo) { 
        showNotification("Please enter a Job File No.", true); 
        return; 
    }
    
    showLoader();
    const docId = jobFileNo.replace(/\//g, '_');

    const checks = [];
    if (!isUpdating) {
         checks.push({ field: 'jfn', value: jobFileNo, label: 'Job File No.' });
    }
    if (invoiceNo) checks.push({ field: 'in', value: invoiceNo, label: 'Invoice No.' });
    if (mawbNo) checks.push({ field: 'mawb', value: mawbNo, label: 'MAWB No.' });

    for (const check of checks) {
        try {
            const q = query(collection(db, 'jobfiles'), where(check.field, '==', check.value));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                if (isUpdating) {
                    for (const foundDoc of querySnapshot.docs) {
                        if (foundDoc.id !== docId) {
                            hideLoader();
                            showNotification(`Duplicate ${check.label} "${check.value}" found in job file: ${foundDoc.data().jfn}`, true);
                            return;
                        }
                    }
                } else {
                    hideLoader();
                    showNotification(`Duplicate ${check.label} "${check.value}" already exists in job file: ${querySnapshot.docs[0].data().jfn}`, true);
                    return;
                }
            }
        } catch (error) { 
            hideLoader();
            console.error("Error checking for duplicates:", error);
            showNotification("Could not verify uniqueness. Please try again.", true);
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
            const existingData = docSnap.data();
            data.lastUpdatedBy = currentUser.displayName;
            data.updatedAt = serverTimestamp();

            if (existingData.status === 'approved' || existingData.status === 'checked') {
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

export async function checkJobFile(docId = null) {
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

export async function uncheckJobFile(docId) {
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

export async function rejectJobFile(fileIdToReject) {
    const reason = document.getElementById('rejection-reason-input').value.trim();
    if (!reason) {
        showNotification("Rejection reason is required.", true);
        return;
    }

    const docId = fileIdToReject || document.getElementById('job-file-no').value.replace(/\//g, '_');
    if (!docId) {
         showNotification("No file selected for rejection.", true);
         return;
    }

    showLoader();
    const rejectionData = {
        rejectedBy: currentUser.displayName,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason,
        status: 'rejected'
    };

    try {
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
        showNotification("Job File Rejected!");
    } catch (error) {
        hideLoader();
        console.error("Error rejecting document: ", error);
        showNotification("Error rejecting job file.", true);
    }
}

// --- Client Management ---
export function loadClients() {
    if (!db) return;
    const clientsCollection = collection(db, 'clients');
    onSnapshot(query(clientsCollection), (snapshot) => {
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clients.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        setClientsCache(clients);
        displayClients(clients);
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
    try {
        let docRef;
        if (clientId) {
            docRef = doc(db, 'clients', clientId);
            await setDoc(docRef, clientData, { merge: true });
            showNotification("Client updated successfully!");
        } else {
            clientData.createdAt = serverTimestamp();
            const clientsCollection = collection(db, 'clients');
            docRef = await addDoc(clientsCollection, clientData);
            showNotification("Client added successfully!");
        }
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


// --- Admin Panel & User Management ---
export async function openAdminPanel() {
    if (currentUser.role !== 'admin') {
        showNotification("Access denied.", true);
        return;
    }
    showLoader();
    const usersCollectionRef = collection(db, 'users');
    const userQuerySnapshot = await getDocs(usersCollectionRef);
    const userListDiv = document.getElementById('user-list');
    let userListHtml = '';

    userQuerySnapshot.forEach(doc => {
        const userData = doc.data();
        const userId = doc.id;
        const isDisabled = userId === currentUser.uid;
        userListHtml += `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center p-2 border-b">
                <input type="text" data-uid="${userId}" class="display-name-input input-field col-span-1" value="${userData.displayName}" ${isDisabled ? 'disabled' : ''}>
                <select data-uid="${userId}" class="role-select input-field col-span-1" ${isDisabled ? 'disabled' : ''}>
                    <option value="user" ${userData.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="checker" ${userData.role === 'checker' ? 'selected' : ''}>Checker</option>
                    <option value="driver" ${userData.role === 'driver' ? 'selected' : ''}>Driver</option>
                    <option value="warehouse_supervisor" ${userData.role === 'warehouse_supervisor' ? 'selected' : ''}>Warehouse Supervisor</option>
                    <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <select data-uid="${userId}" class="status-select input-field col-span-1" ${isDisabled ? 'disabled' : ''}>
                    <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${userData.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    <option value="blocked" ${userData.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                </select>
            </div>
        `;
    });
    userListDiv.innerHTML = userListHtml;
    hideLoader();
    openModal('admin-panel-modal');
}

export async function saveUserChanges() {
    showLoader();
    const batch = writeBatch(db);
    const userRows = document.querySelectorAll('#user-list > div');
    
    userRows.forEach(row => {
        const nameInput = row.querySelector('.display-name-input');
        if (nameInput.disabled) return;

        const roleSelect = row.querySelector('.role-select');
        const statusSelect = row.querySelector('.status-select');
        const uid = nameInput.dataset.uid;
        
        const userDocRef = doc(db, 'users', uid);
        batch.update(userDocRef, { 
            displayName: nameInput.value,
            role: roleSelect.value,
            status: statusSelect.value
        });
    });

    try {
        await batch.commit();
        hideLoader();
        showNotification("User details updated successfully!");
        closeModal('admin-panel-modal');
    } catch (error) {
        hideLoader();
        console.error("Error updating roles: ", error);
        showNotification("Failed to update user details.", true);
    }
}


// --- Backup & Restore ---
export async function backupAllData() {
    if (currentUser.role !== 'admin') {
        showNotification("Access denied. Only admins can perform backups.", true);
        return;
    }
    showLoader();
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
                <p class="mt-2">This will <b class="underline">overwrite any existing data</b> with the content from the backup file. Documents not in the backup file will not be affected.</p>
                <p class="mt-2 text-red-600 font-bold">This action cannot be undone. Are you sure you want to proceed?</p>
            `;
            modal.querySelector('#confirm-ok').className = 'bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded';
            openModal('confirm-modal');

            const okButton = modal.querySelector('#confirm-ok');
            const cancelButton = modal.querySelector('#confirm-cancel');

            const onOk = async () => {
                closeConfirm();
                showLoader();
                try {
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
            cancelButton.addEventListener('click', closeConfirm, { once: true });

        } catch (error) {
            console.error("Error reading restore file:", error);
            showNotification("Failed to read or parse the backup file. Please ensure it's a valid JSON backup.", true);
        } finally {
            event.target.value = '';
        }
    };

    reader.readAsText(file);
}

// --- Recycle Bin ---
export async function moveToRecycleBin(docId) {
    showLoader();
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

export async function restoreJobFile(docId) {
    showLoader();
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

export async function permanentlyDeleteJobFile(docId) {
    showLoader();
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

    