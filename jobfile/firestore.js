import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { showLoader, hideLoader, showNotification, populateFormFromData, refreshOpenModals, displayJobFiles, updateStatusSummary, displayClients, clearClientForm, closeModal, openRecycleBin, openModal, confirmDelete } from './ui.js';
import { getFormData, logUserActivity } from './utils.js';
import { currentUser, setJobFilesCache, setClientsCache } from './state.js';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAAulR2nJQm-4QtNyEqKTnnDPw-iKW92Mc",
    authDomain: "my-job-file-system.firebaseapp.com",
    projectId: "my-job-file-system",
    storageBucket: "my-job-file-system.appspot.com",
    messagingSenderId: "145307873304",
    appId: "1:145307873304:web:d661ea6ec118801b4a136d",
    measurementId: "G-8EHX5K7YHL"
};

const app = initializeApp(firebaseConfig, 'jobfile-secondary'); // Use a unique name to avoid conflicts
const db = getFirestore(app);

// --- Job File Data Handling ---
export function loadJobFiles() {
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
    const jobFileNoInput = document.getElementById('job-file-no');
    const jobFileNo = jobFileNoInput.value.trim();
    if (!jobFileNo) { 
        showNotification("Please enter a Job File No.", true); 
        return; 
    }

    const isUpdating = jobFileNoInput.disabled;
    const invoiceNo = document.getElementById('invoice-no').value.trim();
    const mawbNo = document.getElementById('mawb').value.trim();
    
    showLoader();
    const docId = jobFileNo.replace(/\//g, '_');

    // Uniqueness checks
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
                const foundDoc = querySnapshot.docs[0];
                if (!isUpdating || (isUpdating && foundDoc.id !== docId)) {
                    hideLoader();
                    showNotification(`Duplicate ${check.label} "${check.value}" already exists in job file: ${foundDoc.data().jfn}`, true);
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
            data.lastUpdatedBy = currentUser.displayName;
            data.updatedAt = serverTimestamp();
            if (['approved', 'checked'].includes(docSnap.data().status)) {
                Object.assign(data, {
                    status: 'pending', checkedBy: null, checkedAt: null, approvedBy: null,
                    approvedAt: null, rejectionReason: null, rejectedBy: null, rejectedAt: null
                });
                showNotification("File modified. Re-approval is now required.", false);
            }
            await setDoc(docRef, data, { merge: true });
        } else {
            Object.assign(data, {
                createdBy: currentUser.displayName, createdAt: serverTimestamp(),
                lastUpdatedBy: currentUser.displayName, updatedAt: serverTimestamp(), status: 'pending'
            });
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

// --- Client Management ---
export function loadClients() {
    const clientsCollection = collection(db, 'clients');
    onSnapshot(query(clientsCollection), (snapshot) => {
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clients.sort((a, b) => a.name.localeCompare(b.name));
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
        if (clientId) {
            await setDoc(doc(db, 'clients', clientId), clientData, { merge: true });
            showNotification("Client updated successfully!");
        } else {
            clientData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'clients'), clientData);
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

// --- Admin Panel & User Management ---
export async function openAdminPanel() {
    if (currentUser.role !== 'admin') {
        showNotification("Access denied.", true);
        return;
    }
    showLoader();
    try {
        const userQuerySnapshot = await getDocs(collection(db, 'users'));
        const userListDiv = document.getElementById('user-list');
        userListDiv.innerHTML = '';
        userQuerySnapshot.forEach(docSnap => {
            const userData = docSnap.data();
            const userId = docSnap.id;
            const isDisabled = userId === currentUser.uid;
            userListDiv.innerHTML += `
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
        hideLoader();
        openModal('admin-panel-modal');
    } catch (e) {
        hideLoader();
        showNotification("Failed to load users.", true);
    }
}

export async function saveUserChanges() {
    showLoader();
    const batch = writeBatch(db);
    document.querySelectorAll('#user-list .display-name-input:not(:disabled)').forEach(input => {
        const uid = input.dataset.uid;
        const roleSelect = document.querySelector(`.role-select[data-uid='${uid}']`);
        const statusSelect = document.querySelector(`.status-select[data-uid='${uid}']`);
        const userDocRef = doc(db, 'users', uid);
        batch.update(userDocRef, { 
            displayName: input.value,
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
        showNotification("Access denied.", true);
        return;
    }
    showLoader();
    try {
        const [jobFilesSnapshot, usersSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'jobfiles'))),
            getDocs(query(collection(db, 'users')))
        ]);
        const backupData = {
            version: "1.0",
            createdAt: new Date().toISOString(),
            data: {
                jobfiles: jobFilesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
                users: usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            }
        };
        const jsonString = JSON.stringify(backupData, (k, v) => (v && v.toDate) ? v.toDate().toISOString() : v, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `qgo-cargo-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showNotification("Backup created and download started.");
    } catch (error) {
        console.error("Backup failed:", error);
        showNotification("An error occurred during backup.", true);
    } finally {
        hideLoader();
    }
}

export function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (currentUser.role !== 'admin') return showNotification("Access denied.", true);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backupData = JSON.parse(e.target.result);
            if (!backupData.data || !backupData.data.jobfiles || !backupData.data.users) {
                return showNotification("Invalid backup file format.", true);
            }
            confirmDelete(`restore-${Date.now()}`, 'restore', backupData);
        } catch (error) {
            showNotification("Failed to read or parse the backup file.", true);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}
