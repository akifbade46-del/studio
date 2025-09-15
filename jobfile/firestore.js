import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showLoader, hideLoader, showNotification, populateFormFromData, closeModal, displayJobFiles, updateStatusSummary } from './ui.js';
import { state } from './state.js';

const appModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
const app = appModule.initializeApp({
    apiKey: "AIzaSyAAulR2nJQm-4QtNyEqKTnnDPw-iKW92Mc",
    authDomain: "my-job-file-system.firebaseapp.com",
    projectId: "my-job-file-system",
    storageBucket: "my-job-file-system.appspot.com",
    messagingSenderId: "145307873304",
    appId: "1:145307873304:web:d661ea6ec118801b4a136d",
    measurementId: "G-8EHX5K7YHL"
});
export const db = getFirestore(app);
export const auth = (await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js")).getAuth(app);


export async function saveJobFile(data) {
    const jobFileNo = data.jfn;
    if (!jobFileNo) { 
        showNotification("Please enter a Job File No.", true); 
        return; 
    }
    
    const isUpdating = document.getElementById('job-file-no').disabled;
    showLoader();
    const docId = jobFileNo.replace(/\//g, '_');
    
    if (!isUpdating) {
        try {
            const existingDoc = await getDoc(doc(db, 'jobfiles', docId));
            if (existingDoc.exists()) {
                hideLoader();
                showNotification(`Job File No. "${jobFileNo}" already exists.`, true);
                return;
            }
        } catch(e) {
            hideLoader();
            showNotification("Error checking for duplicates.", true);
            return;
        }
    }

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

export async function previewJobFileById(docId) {
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
                new QRCode(qrContainer, { text: `${window.location.href.split('?')[0]}?jobId=${encodeURIComponent(data.jfn)}`, width: 96, height: 96 });
            }
            openModal('preview-modal');
        } else {
            showNotification("Document not found.", true);
        }
    } catch (error) {
        console.error("Error previewing document:", error);
    } finally {
        hideLoader();
    }
}

export function loadJobFiles() {
    onSnapshot(collection(db, 'jobfiles'), (querySnapshot) => {
        state.jobFilesCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sortedDocs = [...state.jobFilesCache].sort((a,b) => (b.updatedAt?.toDate()?.getTime() || 0) - (a.updatedAt?.toDate()?.getTime() || 0));
        displayJobFiles(sortedDocs);
        updateStatusSummary('status-summary-main', state.jobFilesCache);
    }, (error) => {
        console.error("Error fetching job files: ", error);
        showNotification("Error loading job files.", true);
    });
}

export async function logUserActivity(jobFileNo) {
    if (!state.currentUser) return;
    try {
        await addDoc(collection(db, 'activityLog'), {
            userId: state.currentUser.uid,
            userName: state.currentUser.displayName,
            jobFileNo: jobFileNo,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging activity: ", error);
    }
}

export function loadClients() {
    // Implementation can be added here
}

export function loadChargeDescriptions() {
    onSnapshot(doc(db, 'config', 'chargeDescriptions'), (doc) => {
        if (doc.exists()) {
            state.chargeDescriptions = doc.data().descriptions || [];
            const list = document.getElementById('charge-description-list');
            const datalist = document.createElement('datalist');
            datalist.id = 'charge-options';
            
            list.innerHTML = state.chargeDescriptions.map(desc => {
                datalist.innerHTML += `<option value="${desc}"></option>`;
                return `<div class="flex justify-between items-center p-2 bg-gray-100 rounded">
                    <span>${desc}</span>
                    <button data-action="delete" data-description="${desc}" class="text-red-500 hover:text-red-700">&times;</button>
                </div>`;
            }).join('');

            const oldDatalist = document.getElementById('charge-options');
            if(oldDatalist) oldDatalist.remove();
            document.body.appendChild(datalist);
        }
    });
}

export async function saveChargeDescription() {
    const input = document.getElementById('new-charge-description');
    const newDesc = input.value.trim();
    if (!newDesc) return;
    if (state.chargeDescriptions.includes(newDesc)) {
        showNotification("This description already exists.", true);
        return;
    }
    const updatedDescriptions = [...state.chargeDescriptions, newDesc].sort();
    try {
        await setDoc(doc(db, 'config', 'chargeDescriptions'), { descriptions: updatedDescriptions });
        showNotification("Description saved.", false);
        input.value = '';
    } catch (error) {
        showNotification("Error saving description.", true);
        console.error(error);
    }
}

export async function deleteChargeDescription(descriptionToDelete) {
    const updatedDescriptions = state.chargeDescriptions.filter(d => d !== descriptionToDelete);
    try {
        await setDoc(doc(db, 'config', 'chargeDescriptions'), { descriptions: updatedDescriptions });
        showNotification("Description deleted.", false);
    } catch (error) {
        showNotification("Error deleting description.", true);
        console.error(error);
    }
}

export async function saveUserChanges() {
    // Implementation can be added here
}
export async function backupAllData() {
    // Implementation can be added here
}
export async function handleRestoreFile() {
    // Implementation can be added here
}

export async function checkFile() {
    const jobFileNo = document.getElementById('job-file-no').value.trim();
    if (!jobFileNo || document.getElementById('job-file-no').disabled === false) {
        showNotification("Please save and load a file before checking.", true);
        return;
    }
    
    showLoader();
    try {
        const docId = jobFileNo.replace(/\//g, '_');
        const docRef = doc(db, 'jobfiles', docId);
        await updateDoc(docRef, {
            status: 'checked',
            checkedBy: state.currentUser.displayName,
            checkedAt: serverTimestamp()
        });
        showNotification("File marked as 'Checked'.", false);
        loadJobFileById(docId); // Reload to show updated status
    } catch (error) {
        console.error("Error checking file:", error);
        showNotification("Could not check file.", true);
    } finally {
        hideLoader();
    }
}


export async function approveFile() {
    const jobFileNo = document.getElementById('job-file-no').value.trim();
    if (!jobFileNo || document.getElementById('job-file-no').disabled === false) {
        showNotification("Please load a file before approving.", true);
        return;
    }
    
    showLoader();
    try {
        const docId = jobFileNo.replace(/\//g, '_');
        const docRef = doc(db, 'jobfiles', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.data().status === 'pending') {
            hideLoader();
            showNotification("File must be 'Checked' before it can be approved.", true);
            return;
        }

        await updateDoc(docRef, {
            status: 'approved',
            approvedBy: state.currentUser.displayName,
            approvedAt: serverTimestamp()
        });
        showNotification("File approved.", false);
        loadJobFileById(docId);
    } catch (error) {
        console.error("Error approving file:", error);
        showNotification("Could not approve file.", true);
    } finally {
        hideLoader();
    }
}

export async function rejectFile() {
    const jobFileNo = document.getElementById('job-file-no').value.trim();
    const reason = document.getElementById('rejection-reason-input').value.trim();

    if (!reason) {
        showNotification("Please provide a reason for rejection.", true);
        return;
    }
    
    showLoader();
    try {
        const docId = jobFileNo.replace(/\//g, '_');
        const docRef = doc(db, 'jobfiles', docId);
        await updateDoc(docRef, {
            status: 'rejected',
            rejectedBy: state.currentUser.displayName,
            rejectedAt: serverTimestamp(),
            rejectionReason: reason
        });
        showNotification("File rejected.", false);
        closeModal('reject-reason-modal');
        loadJobFileById(docId);
    } catch (error) {
        console.error("Error rejecting file:", error);
        showNotification("Could not reject file.", true);
    } finally {
        hideLoader();
    }
}
