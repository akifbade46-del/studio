import { getFirestore, doc, getDocs, collection, onSnapshot, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './auth.js';
import { showLoader, hideLoader, showNotification, renderAllDeliveryViews, createDriverTaskCard, displayDriverPerformanceSummary } from './ui.js';
import { 
    currentUser, 
    jobFilesCache,
    setJobFilesCache, 
    allUsersCache,
    setAllUsersCache,
    deliveriesCache,
    setDeliveriesCache,
    selectedJobFile,
    setSelectedJobFile
} from './state.js';

let deliveriesUnsubscribe = () => {};
let driverTasksUnsubscribe = () => {};

export async function loadAdminData() {
    showLoader();
    try {
        const jobFilesPromise = getDocs(collection(db, 'jobfiles'));
        const usersPromise = getDocs(collection(db, 'users'));

        const [jobFilesSnapshot, usersSnapshot] = await Promise.all([jobFilesPromise, usersPromise]);

        setJobFilesCache(jobFilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setAllUsersCache(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        populateDriverDropdown();
        listenForDeliveries();

    } catch (error) {
        console.error("Error loading admin data: ", error);
        showNotification("Failed to load initial data. Check Firestore permissions.", true);
    } finally {
        hideLoader();
    }
}

function populateDriverDropdown() {
    const assignmentSelect = document.getElementById('driver-select');
    if (!assignmentSelect) return;

    assignmentSelect.innerHTML = '<option value="">-- Select a Driver --</option>';
    const activeDrivers = allUsersCache.filter(u => u.role === 'driver' && u.status === 'active');
    activeDrivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.id;
        option.textContent = driver.displayName;
        assignmentSelect.appendChild(option);
    });
}

export function listenForDeliveries() {
    if (deliveriesUnsubscribe) deliveriesUnsubscribe();
    const deliveriesRef = collection(db, 'deliveries');
    deliveriesUnsubscribe = onSnapshot(deliveriesRef, (snapshot) => {
        const newDeliveries = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        newDeliveries.sort((a,b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
        setDeliveriesCache(newDeliveries);
        renderAllDeliveryViews();
    }, (error) => {
        console.error("Firestore Error (Deliveries):", error);
        showNotification("Permission error: Could not load delivery data.", true);
    });
}

export function handleJobFileSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const suggestionsEl = document.getElementById('job-file-suggestions');

    if (searchTerm.length < 2) {
        suggestionsEl.innerHTML = '';
        suggestionsEl.classList.add('hidden');
        return;
    }

    const filteredJobs = jobFilesCache.filter(job => 
        (job.jfn && job.jfn.toLowerCase().includes(searchTerm)) ||
        (job.sh && job.sh.toLowerCase().includes(searchTerm)) ||
        (job.co && job.co.toLowerCase().includes(searchTerm))
    ).slice(0, 10);

    if (filteredJobs.length > 0) {
        suggestionsEl.innerHTML = filteredJobs.map(job => 
            `<div class="suggestion-item p-2 hover:bg-gray-100 cursor-pointer" data-id="${job.id}">${job.jfn} - ${job.sh}</div>`
        ).join('');
        suggestionsEl.classList.remove('hidden');
    } else {
        suggestionsEl.innerHTML = '';
        suggestionsEl.classList.add('hidden');
    }
}

export function selectJobFile(e) {
    if (e.target.classList.contains('suggestion-item')) {
        const jobId = e.target.dataset.id;
        const job = jobFilesCache.find(job => job.id === jobId);
        setSelectedJobFile(job);
        
        if (job) {
            document.getElementById('form-job-file-no').textContent = job.jfn;
            document.getElementById('form-job-shipper-consignee').textContent = `${job.sh} / ${job.co}`;
            document.getElementById('job-file-search').value = job.jfn;
            document.getElementById('delivery-origin').value = job.or || '';
            document.getElementById('delivery-destination').value = job.de || '';
            document.getElementById('delivery-airlines').value = job.ca || '';
            document.getElementById('delivery-mawb').value = job.mawb || '';
            document.getElementById('delivery-inv').value = job.in || '';
        }
        document.getElementById('job-file-suggestions').classList.add('hidden');
    }
}

export async function handleAssignDelivery(e) {
    e.preventDefault();
    if (!selectedJobFile) {
        showNotification("Please select a job file first.", true);
        return;
    }

    const driverId = document.getElementById('driver-select').value;
    const location = document.getElementById('delivery-location').value.trim();

    if (!driverId || !location) {
        showNotification("Please select a driver and enter a location.", true);
        return;
    }

    const existingDelivery = deliveriesCache.find(delivery => delivery.jobFileId === selectedJobFile.id);
    if (existingDelivery) {
        showNotification(`A delivery for Job File "${selectedJobFile.jfn}" has already been assigned.`, true);
        return;
    }
    
    showLoader();
    try {
        const driver = allUsersCache.find(d => d.id === driverId);
        const deliveryData = {
            jobFileId: selectedJobFile.id,
            jobFileData: {
                jfn: selectedJobFile.jfn || 'N/A',
                sh: selectedJobFile.sh || 'N/A',
                co: selectedJobFile.co || 'N/A',
                dsc: selectedJobFile.dsc || 'N/A',
                gw: selectedJobFile.gw || 'N/A',
                mawb: document.getElementById('delivery-mawb').value.trim() || 'N/A',
                or: document.getElementById('delivery-origin').value.trim() || 'N/A', 
                de: document.getElementById('delivery-destination').value.trim() || 'N/A',
                ca: document.getElementById('delivery-airlines').value.trim() || 'N/A',
                in: document.getElementById('delivery-inv').value.trim() || 'N/A',
            },
            deliveryLocation: location,
            deliveryNotes: document.getElementById('additional-notes')?.value.trim(),
            driverUid: driver.id,
            driverName: driver.displayName,
            status: 'Pending',
            createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'deliveries'), deliveryData);

        showNotification("Delivery assigned successfully!");
        document.getElementById('delivery-form').reset();
        document.getElementById('form-job-file-no').textContent = 'Select a job';
        document.getElementById('form-job-shipper-consignee').textContent = 'N/A';
        document.getElementById('job-file-search').value = '';
        setSelectedJobFile(null);

    } catch(error) {
        console.error("Error assigning delivery:", error);
        showNotification("Could not assign delivery. Check Firestore permissions.", true);
    } finally {
        hideLoader();
    }
}

// --- Driver Logic ---
export function loadDriverTasks() {
    if (driverTasksUnsubscribe) driverTasksUnsubscribe();
    
    if (!currentUser || !currentUser.uid) {
        console.error("No current user found for loading tasks.");
        return;
    }

    const q = query(collection(db, "deliveries"), where("driverUid", "==", currentUser.uid));
    
    driverTasksUnsubscribe = onSnapshot(q, (snapshot) => {
        const driverTasks = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

        driverTasks.sort((a,b) => {
            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
            return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
        });
        
        const listEl = document.getElementById('driver-tasks-list');
        listEl.innerHTML = '';
        if (driverTasks.length > 0) {
            driverTasks.forEach(task => listEl.appendChild(createDriverTaskCard(task)));
        } else {
            listEl.innerHTML = '<p class="text-gray-500">You have no assigned deliveries.</p>';
        }
        
        displayDriverPerformanceSummary(currentUser.uid, driverTasks);

    }, (error) => {
        console.error("Firestore Error (Driver Tasks):", error);
        showNotification("Permission error: Could not load your assigned tasks.", true);
    });
}
