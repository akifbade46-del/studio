import { getFirestore, doc, getDocs, collection, onSnapshot, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './auth.js';
import { showLoader, hideLoader, showNotification, createDeliveryCard, createDriverTaskCard, displayDriverPerformanceSummary } from './ui.js';
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
        (job.co && job.co.toLowerCase().includes(searchTerm)) ||
        (job.mawb && job.mawb.toLowerCase().includes(searchTerm)) // Search by AWB/MAWB
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
            document.getElementById('manual-job-file-no').value = job.jfn || '';
            document.getElementById('manual-mawb').value = job.mawb || '';
            document.getElementById('manual-shipper').value = job.sh || '';
            document.getElementById('manual-consignee').value = job.co || '';
            document.getElementById('job-file-search').value = job.jfn;
        }
        document.getElementById('job-file-suggestions').classList.add('hidden');
    }
}

export async function handleAssignDelivery(e) {
    e.preventDefault();
    const driverId = document.getElementById('driver-select').value;
    const location = document.getElementById('delivery-location').value.trim();

    const manualJobFileNo = document.getElementById('manual-job-file-no').value.trim();
    
    if (!driverId || !location) {
        showNotification("Please select a driver and enter a delivery location.", true);
        return;
    }

    if (!manualJobFileNo && !selectedJobFile) {
        showNotification("Please select a job file or enter the Job File No. manually.", true);
        return;
    }

    showLoader();
    try {
        const driver = allUsersCache.find(d => d.id === driverId);
        
        let jobFileId = selectedJobFile ? selectedJobFile.id : `manual_${Date.now()}`;
        let jobFileData = selectedJobFile ? {
             jfn: selectedJobFile.jfn || 'N/A',
             sh: selectedJobFile.sh || 'N/A',
             co: selectedJobFile.co || 'N/A',
             dsc: selectedJobFile.dsc || 'N/A',
             gw: selectedJobFile.gw || 'N/A',
             mawb: selectedJobFile.mawb || 'N/A',
        } : {
            jfn: manualJobFileNo,
            mawb: document.getElementById('manual-mawb').value.trim(),
            sh: document.getElementById('manual-shipper').value.trim(),
            co: document.getElementById('manual-consignee').value.trim(),
            dsc: 'Manual Entry',
            gw: 'N/A',
        };

        const deliveryData = {
            jobFileId: jobFileId,
            jobFileData: jobFileData,
            deliveryLocation: location,
            deliveryNotes: document.getElementById('additional-notes')?.value.trim(),
            driverUid: driver.id,
            driverName: driver.displayName,
            status: 'Pending',
            createdAt: serverTimestamp(),
            createdBy: currentUser.displayName,
            createdById: currentUser.uid,
        };

        await addDoc(collection(db, 'deliveries'), deliveryData);

        showNotification("Delivery assigned successfully!");
        document.getElementById('delivery-form').reset();
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
        let driverTasks = [];
        let shouldRenderAll = false;
        
        snapshot.docChanges().forEach((change) => {
            const taskData = { id: change.doc.id, ...change.doc.data() };
            const existingTaskIndex = deliveriesCache.findIndex(t => t.id === taskData.id);

            // If a change is not just a location update, we should re-render the whole list
            if (change.type !== 'modified' || !change.doc.data().liveCoordinates) {
                 shouldRenderAll = true;
            }

            if (change.type === "added") {
                if(existingTaskIndex === -1) deliveriesCache.push(taskData);
            }
            if (change.type === "modified") {
                if(existingTaskIndex > -1) deliveriesCache[existingTaskIndex] = taskData;
            }
            if (change.type === "removed") {
                if(existingTaskIndex > -1) deliveriesCache.splice(existingTaskIndex, 1);
            }
        });
        
        driverTasks = [...deliveriesCache];

        driverTasks.sort((a,b) => {
            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
            return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
        });
        
        setDeliveriesCache(driverTasks);
        
        if (shouldRenderAll) {
            const listEl = document.getElementById('driver-tasks-list');
            listEl.innerHTML = '';
            if (driverTasks.length > 0) {
                driverTasks.forEach(task => listEl.appendChild(createDriverTaskCard(task)));
            } else {
                listEl.innerHTML = '<p class="text-gray-500">You have no assigned deliveries.</p>';
            }
            displayDriverPerformanceSummary(currentUser.uid, driverTasks);
        }


    }, (error) => {
        console.error("Firestore Error (Driver Tasks):", error);
        showNotification("Permission error: Could not load your assigned tasks.", true);
    });
}

// --- Delivery List Rendering (for Admin) ---
export function renderAllDeliveryViews() {
    renderDashboardMetrics();
    
    const pendingList = document.getElementById('pending-deliveries-list');
    const completedList = document.getElementById('completed-deliveries-list');
    if (!pendingList || !completedList) return;

    pendingList.innerHTML = '';
    completedList.innerHTML = '';

    const pendingSearchTerm = document.getElementById('pending-search').value.toLowerCase();
    const completedSearchTerm = document.getElementById('completed-search').value.toLowerCase();

    const searchFilter = (delivery, term) => {
        if (!term) return true;
        const job = delivery.jobFileData || {};
        return (
            (job.jfn && job.jfn.toLowerCase().includes(term)) ||
            (job.sh && job.sh.toLowerCase().includes(term)) ||
            (job.co && job.co.toLowerCase().includes(term)) ||
            (delivery.driverName && delivery.driverName.toLowerCase().includes(term)) ||
            (delivery.receiverName && delivery.receiverName.toLowerCase().includes(term))
        );
    };

    const pendingDeliveries = deliveriesCache
        .filter(d => d.status !== 'Delivered')
        .filter(d => searchFilter(d, pendingSearchTerm));

    const completedDeliveries = deliveriesCache
        .filter(d => d.status === 'Delivered')
        .filter(d => searchFilter(d, completedSearchTerm));


    if (pendingDeliveries.length > 0) {
        pendingDeliveries.forEach(delivery => pendingList.appendChild(createDeliveryCard(delivery)));
    } else {
        pendingList.innerHTML = '<p class="text-gray-500 text-center py-4">No pending deliveries found.</p>';
    }

    if (completedDeliveries.length > 0) {
        completedDeliveries.forEach(delivery => completedList.appendChild(createDeliveryCard(delivery)));
    } else {
        completedList.innerHTML = '<p class="text-gray-500 text-center py-4">No completed deliveries found.</p>';
    }
}

function renderDashboardMetrics() {
    const pendingCount = deliveriesCache.filter(d => d.status !== 'Delivered').length;
    const completedCount = deliveriesCache.filter(d => d.status === 'Delivered').length;
    
    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-completed').textContent = completedCount;
    document.getElementById('stat-total').textContent = deliveriesCache.length;
}
