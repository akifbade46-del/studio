import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let db;
let currentUser;

export function initializeFirestore(firestoreDb, user) {
    db = firestoreDb;
    currentUser = user;
}

export async function saveJobFile(data, isUpdating, docId) {
    const invoiceNo = data.in;
    const mawbNo = data.mawb;

    const checks = [];
    if (!isUpdating) {
        checks.push({ field: 'jfn', value: data.jfn, label: 'Job File No.' });
    }
    if (invoiceNo) checks.push({ field: 'in', value: invoiceNo, label: 'Invoice No.' });
    if (mawbNo) checks.push({ field: 'mawb', value: mawbNo, label: 'MAWB No.' });

    for (const check of checks) {
        const q = query(collection(db, 'jobfiles'), where(check.field, '==', check.value));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            if (isUpdating) {
                for (const foundDoc of querySnapshot.docs) {
                    if (foundDoc.id !== docId) {
                        throw new Error(`Duplicate ${check.label} "${check.value}" found in job file: ${foundDoc.data().jfn}`);
                    }
                }
            } else {
                throw new Error(`Duplicate ${check.label} "${check.value}" already exists in job file: ${querySnapshot.docs[0].data().jfn}`);
            }
        }
    }

    const docRef = doc(db, 'jobfiles', docId);
    const docSnap = await getDoc(docRef);
    let requiresReapproval = false;

    if (docSnap.exists()) {
        const existingData = docSnap.data();
        data.lastUpdatedBy = currentUser.displayName;
        data.updatedAt = serverTimestamp();

        if (existingData.status === 'approved' || existingData.status === 'checked') {
            requiresReapproval = true;
            data.status = 'pending';
            data.checkedBy = null;
            data.checkedAt = null;
            data.approvedBy = null;
            data.approvedAt = null;
            data.rejectionReason = null;
            data.rejectedBy = null;
            data.rejectedAt = null;
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
    return requiresReapproval;
}

export async function checkJobFile(fileId) {
    if (!currentUser || !['admin', 'checker'].includes(currentUser.role)) {
        throw new Error("You do not have permission to check files.");
    }
    const checkData = {
        checkedBy: currentUser.displayName,
        checkedAt: serverTimestamp(),
        status: 'checked'
    };
    const docRef = doc(db, 'jobfiles', fileId);
    await setDoc(docRef, checkData, { merge: true });
    return getDoc(docRef);
}

export async function uncheckJobFile(fileId) {
     if (!currentUser || !['admin', 'checker'].includes(currentUser.role)) {
        throw new Error("You do not have permission to uncheck files.");
    }
    const uncheckData = {
        checkedBy: null,
        checkedAt: null,
        status: 'pending'
    };
    const docRef = doc(db, 'jobfiles', fileId);
    await setDoc(docRef, uncheckData, { merge: true });
}

export async function approveJobFile(fileId) {
    if (currentUser.role !== 'admin') {
        throw new Error("Only admins can approve job files.");
    }
    const approvalData = {
        approvedBy: currentUser.displayName,
        approvedAt: serverTimestamp(),
        status: 'approved',
        rejectionReason: null,
        rejectedBy: null,
        rejectedAt: null
    };
    const docRef = doc(db, 'jobfiles', fileId);
    await setDoc(docRef, approvalData, { merge: true });
    return getDoc(docRef);
}

export async function rejectJobFile(fileId, reason) {
     const rejectionData = {
        rejectedBy: currentUser.displayName,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason,
        status: 'rejected'
    };
    const docRef = doc(db, 'jobfiles', fileId);
    await setDoc(docRef, rejectionData, { merge: true });
    return getDoc(docRef);
}

export function listenForJobFiles(callback) {
    const jobFilesCollection = collection(db, 'jobfiles');
    const q = query(jobFilesCollection);
    return onSnapshot(q, (querySnapshot) => {
        const jobFilesCache = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(jobFilesCache);
    });
}

export async function loadJobFileById(docId) {
    const docRef = doc(db, 'jobfiles', docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        throw new Error("Document not found.");
    }
}

export async function moveToRecycleBin(docId) {
    const docRef = doc(db, 'jobfiles', docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const dataToMove = docSnap.data();
        dataToMove.deletedAt = serverTimestamp();
        dataToMove.deletedBy = currentUser.displayName;
        
        const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
        await setDoc(deletedDocRef, dataToMove);
        await deleteDoc(docRef);
    } else {
        throw new Error("Document not found in main collection.");
    }
}

export function listenForClients(callback) {
    const clientsCollection = collection(db, 'clients');
    return onSnapshot(query(clientsCollection), (snapshot) => {
        const clientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clientsCache.sort((a, b) => a.name.localeCompare(b.name));
        callback(clientsCache);
    });
}

export async function saveClient(clientData, clientId) {
    let docRef;
    if (clientId) {
        docRef = doc(db, 'clients', clientId);
        await setDoc(docRef, clientData, { merge: true });
    } else {
        clientData.createdAt = serverTimestamp();
        const clientsCollection = collection(db, 'clients');
        docRef = await addDoc(clientsCollection, clientData);
    }
}

export async function deleteClient(clientId) {
    await deleteDoc(doc(db, 'clients', clientId));
}

export async function getUsers() {
    const usersCollectionRef = collection(db, 'users');
    const userQuerySnapshot = await getDocs(usersCollectionRef);
    return userQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function saveUserChanges(updates) {
    const batch = writeBatch(db);
    updates.forEach(update => {
        const userDocRef = doc(db, 'users', update.uid);
        batch.update(userDocRef, update.data);
    });
    await batch.commit();
}

export async function getBackupData() {
    const jobFilesQuery = query(collection(db, 'jobfiles'));
    const usersQuery = query(collection(db, 'users'));
    const jobFilesSnapshot = await getDocs(jobFilesQuery);
    const usersSnapshot = await getDocs(usersQuery);
    const jobfilesData = jobFilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { jobfiles: jobfilesData, users: usersData };
}

export async function restoreBackupData(backupData) {
    const restoreBatch = writeBatch(db);
    backupData.jobfiles.forEach(jobFile => {
        const docRef = doc(db, 'jobfiles', jobFile.id);
        const { id, ...dataToRestore } = jobFile;
        restoreBatch.set(docRef, dataToRestore);
    });
    backupData.users.forEach(user => {
        const docRef = doc(db, 'users', user.id);
        const { id, ...dataToRestore } = user;
        restoreBatch.set(docRef, dataToRestore);
    });
    await restoreBatch.commit();
}

export async function getRecycleBinFiles() {
    const deletedFilesRef = collection(db, 'deleted_jobfiles');
    const q = query(deletedFilesRef);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function restoreJobFile(docId) {
    const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
    const docSnap = await getDoc(deletedDocRef);
    if (docSnap.exists()) {
        const dataToRestore = docSnap.data();
        delete dataToRestore.deletedAt;
        delete dataToRestore.deletedBy;
        const newDocRef = doc(db, 'jobfiles', docId);
        await setDoc(newDocRef, dataToRestore);
        await deleteDoc(deletedDocRef);
    } else {
        throw new Error("Document not found in recycle bin.");
    }
}

export async function permanentlyDeleteJobFile(docId) {
    const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
    await deleteDoc(deletedDocRef);
}

export async function loadChargeDescriptions() {
    const stored = localStorage.getItem('chargeDescriptions');
    if (stored) {
        return JSON.parse(stored);
    } else {
        const defaultCharges = [
            'Ex-works Charges:', 'Land/Air / Sea Freight:', 'Fuell Security / War Surcharge:', 'Formalities:', 'Delivery Order Fee:', 'Transportation Charges:', 'Inspection / Computer Print Charges:', 'Handling Charges:', 'Labor / Forklift Charges:', 'Documentation Charges:', 'Clearance Charges:', 'Customs Duty:', 'Terminal Handling Charges:', 'Legalization Charges:', 'Demurrage Charges:', 'Loading / Offloading Charges:', 'Destination Clearance Charges:', 'Packing Charges:', 'Port Charges:', 'Other Charges:', 'PAI Approval :', 'Insurance Fee :', 'EPA Charges :'
        ];
        localStorage.setItem('chargeDescriptions', JSON.stringify(defaultCharges));
        return defaultCharges;
    }
}
