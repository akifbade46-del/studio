import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc, updateDoc, deleteDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global variables ---
let db, auth;
let currentUser = null;
let jobFilesCache = [];
let allUsersCache = [];
let deliveriesCache = [];
let feedbackCache = [];
let selectedJobFile = null;
let currentGeolocation = null;
let deliveriesUnsubscribe = () => {};
let driverTasksUnsubscribe = () => {};
let completionSignaturePad;
let activeDeliveryForReceipt = null;
let activeDeliveryForCompletion = null;
let driverChartInstance = null;


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

// --- App Initialization ---
async function initializeAppLogic() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        const urlParams = new URLSearchParams(window.location.search);
        const podId = urlParams.get('podId');
        const feedbackId = urlParams.get('feedbackId');

        if (feedbackId) {
            showPublicFeedbackView(feedbackId);
        } else if (podId) {
            showPublicPodView(podId);
        } else {
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists() && userDoc.data().status === 'active') {
                        currentUser = { uid: user.uid, ...userDoc.data() };
                        showApp();
                    } else {
                        if (userDoc.exists()) {
                            showNotification("Your account is inactive or pending admin approval.", true);
                        }
                        currentUser = null;
                        await signOut(auth);
                        showLogin();
                    }
                } else {
                    currentUser = null;
                    showLogin();
                }
                document.body.classList.remove('loading');
            });
        }
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Could not connect to the database.", true);
        document.body.classList.remove('loading');
    }
}

// --- Authentication Logic ---
async function handleLogin() {
    const email = document.getElementById('email-address').value;
    const password = document.getElementById('password').value;
    if (!email || !password) {
        showNotification("Please enter both email and password.", true);
        return;
    }
    showLoader();
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login failed:", error);
        let message = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Incorrect email or password.";
        }
        showNotification(message, true);
    } finally {
        hideLoader();
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    if(!name || !email || !password) {
        showNotification("Please fill out all fields.", true);
        return;
    }
    if(password.length < 6) {
        showNotification("Password must be at least 6 characters long.", true);
        return;
    }
    showLoader();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await setDoc(doc(db, "users", user.uid), {
            displayName: name,
            email: email,
            role: 'driver',
            status: 'inactive', // inactive until admin approves
            createdAt: serverTimestamp()
        });
        
        closeModal('signup-modal');
        showNotification("Account created! Please wait for admin approval.", false);
        await signOut(auth);

    } catch (error) {
        console.error("Signup failed:", error);
        if (error.code === 'auth/email-already-in-use') {
            showNotification("This email address is already in use.", true);
        } else {
            showNotification("Could not create account. Please try again.", true);
        }
    } finally {
        hideLoader();
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    if(!email) {
        showNotification("Please enter your email address.", true);
        return;
    }
    showLoader();
    try {
        await sendPasswordResetEmail(auth, email);
        closeModal('forgot-password-modal');
        showNotification("Password reset link sent! Check your email.", false);
    } catch (error) {
        console.error("Password reset failed:", error);
        showNotification("Could not send reset link. Check the email address.", true);
    } finally {
        hideLoader();
    }
}

// --- UI & View Management ---
function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('public-pod-view').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    document.getElementById('user-display-name').textContent = currentUser.displayName;
    document.getElementById('user-role').textContent = currentUser.role;

    document.getElementById('admin-staff-view').style.display = 'none';
    document.getElementById('driver-view').style.display = 'none';
    document.getElementById('admin-panel-btn').classList.add('hidden');
    document.getElementById('driver-dashboard-btn').classList.add('hidden');
    
    // Allow any active user to log in. The UI will adapt based on their role.
    if (currentUser.role === 'driver') {
        document.getElementById('driver-view').style.display = 'block';
        document.getElementById('header-subtitle').textContent = "View and complete your assigned deliveries.";
        loadDriverTasks();
    } else { // Default view for admin, staff, and other roles
        document.getElementById('admin-staff-view').style.display = 'block';
        document.getElementById('header-subtitle').textContent = "Assign, track, and manage deliveries.";
        if (currentUser.role === 'admin' || currentUser.role === 'staff') {
            document.getElementById('driver-dashboard-btn').classList.remove('hidden');
        }
        if (currentUser.role === 'admin') {
            document.getElementById('admin-panel-btn').classList.remove('hidden');
        }
        loadAdminData();
    } 
}

// --- Admin / Staff Logic ---
async function loadAdminData() {
    showLoader();
    try {
        const jobFilesPromise = getDocs(collection(db, 'jobfiles'));
        const usersPromise = getDocs(collection(db, 'users'));

        const [jobFilesSnapshot, usersSnapshot] = await Promise.all([jobFilesPromise, usersPromise]);

        jobFilesCache = jobFilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allUsersCache = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
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

function listenForDeliveries() {
    if (deliveriesUnsubscribe) deliveriesUnsubscribe(); // Unsubscribe from previous listener
    const deliveriesRef = collection(db, 'deliveries');
    deliveriesUnsubscribe = onSnapshot(deliveriesRef, (snapshot) => {
        deliveriesCache = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        deliveriesCache.sort((a,b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
        
        renderAllDeliveryViews();
    }, (error) => {
        console.error("Firestore Error (Deliveries):", error);
        showNotification("Permission error: Could not load delivery data.", true);
    });
}

function renderAllDeliveryViews() {
    renderDashboardMetrics();
    
    const pendingList = document.getElementById('pending-deliveries-list');
    const completedList = document.getElementById('completed-deliveries-list');
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

function createDeliveryCard(delivery) {
    const card = document.createElement('div');
    card.className = 'border p-3 rounded-lg bg-gray-50 delivery-card';
    const jobData = delivery.jobFileData || {};
    let actionButtons = '';

    if (delivery.status === 'Delivered') {
        if (currentUser.role === 'admin') {
            actionButtons += `<button class="btn btn-danger btn-xs text-xs" onclick="confirmPodCancel('${delivery.id}', '${jobData.jfn}')">Cancel POD</button>`;
        }
        actionButtons += `${delivery.podId ? `<button class="btn btn-secondary btn-xs text-xs" onclick="openReceiptModal('${delivery.id}')">View Receipt</button>` : ''}`;
    }

    const deliveredInfo = delivery.status === 'Delivered' ? `
        <div class="mt-2 pt-2 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div class="mb-2 sm:mb-0">
                <p class="text-xs"><strong>Receiver:</strong> ${delivery.receiverName || 'N/A'}</p>
                <p class="text-xs"><strong>Completed:</strong> ${delivery.completedAt?.toDate().toLocaleString() || 'N/A'}</p>
            </div>
            <div class="flex gap-2">
               ${actionButtons}
            </div>
        </div>
        ` : '';

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <p class="font-bold">${jobData.jfn || 'Unknown Job'}</p>
                <p class="text-sm text-gray-700">${jobData.sh || 'N/A'} to ${jobData.co || 'N/A'}</p>
                <p class="text-xs text-gray-500">Assigned to: <strong>${delivery.driverName || 'N/A'}</strong></p>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${delivery.status === 'Delivered' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}">
                ${delivery.status}
            </span>
        </div>
        ${deliveredInfo}
    `;

    return card;
}

function handleJobFileSearch(e) {
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

function selectJobFile(e) {
    if (e.target.classList.contains('suggestion-item')) {
        const jobId = e.target.dataset.id;
        selectedJobFile = jobFilesCache.find(job => job.id === jobId);
        
        if (selectedJobFile) {
            document.getElementById('form-job-file-no').textContent = selectedJobFile.jfn;
            document.getElementById('form-job-shipper-consignee').textContent = `${selectedJobFile.sh} / ${selectedJobFile.co}`;
            document.getElementById('job-file-search').value = selectedJobFile.jfn;
            // Corrected Auto-fill logic using keys from the main file
            document.getElementById('delivery-origin').value = selectedJobFile.or || '';
            document.getElementById('delivery-destination').value = selectedJobFile.de || '';
            document.getElementById('delivery-airlines').value = selectedJobFile.ca || '';
            document.getElementById('delivery-mawb').value = selectedJobFile.mawb || '';
            document.getElementById('delivery-inv').value = selectedJobFile.in || '';
        }
        document.getElementById('job-file-suggestions').classList.add('hidden');
    }
}

async function handleAssignDelivery(e) {
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

    // Check for existing delivery
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
            jobFileData: { // Store a snapshot of key data, reading from the form and using main system keys
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
        selectedJobFile = null;

    } catch(error) {
        console.error("Error assigning delivery:", error);
        showNotification("Could not assign delivery. Check Firestore permissions.", true);
    } finally {
        hideLoader();
    }
}

// --- Driver Logic & Simulation ---
function createDriverTaskCard(task) {
    const taskCard = document.createElement('div');
    taskCard.className = `border p-4 rounded-lg shadow-sm delivery-card ${task.status === 'Pending' ? 'bg-white' : 'bg-gray-200'}`;
    const jobData = task.jobFileData || {};

    let actionButton = '';
    if (task.status === 'Pending') {
        actionButton = `<button class="btn btn-primary text-sm">Complete Delivery</button>`;
        taskCard.classList.add('cursor-pointer', 'hover:bg-gray-50');
    } else {
        actionButton = `<button class="btn btn-secondary text-sm">View Receipt</button>`;
    }

    taskCard.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div class="mb-3 sm:mb-0">
                <p class="font-bold text-lg">${jobData.jfn}</p>
                <p class="text-sm text-gray-700"><strong>To:</strong> ${task.deliveryLocation}</p>
                <p class="text-xs text-gray-500"><strong>Assigned:</strong> ${task.createdAt?.toDate().toLocaleString()}</p>
            </div>
            <div class="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                <span class="text-sm font-semibold px-2 py-1 rounded-full ${task.status === 'Delivered' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}">
                    ${task.status}
                </span>
                ${actionButton}
            </div>
        </div>
    `;
    taskCard.querySelector('button')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (task.status === 'Pending') {
            openCompletionModal(task)
        } else {
            openReceiptModal(task.id)
        }
    });
    return taskCard;
}

function loadDriverTasks() {
    if (driverTasksUnsubscribe) driverTasksUnsubscribe();
    const q = query(collection(db, "deliveries"), where("driverUid", "==", currentUser.uid));
    
    driverTasksUnsubscribe = onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('driver-tasks-list');
        listEl.innerHTML = '';
        
        const tasks = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        tasks.sort((a,b) => {
            if (a.status === 'Pending' && b.status !== 'Pending') return -1;
            if (a.status !== 'Pending' && b.status === 'Pending') return 1;
            return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
        });

        if (tasks.length > 0) {
            tasks.forEach(task => listEl.appendChild(createDriverTaskCard(task)));
        } else {
            listEl.innerHTML = '<p class="text-gray-500">You have no assigned deliveries.</p>';
        }
        
        // Display performance summary on driver page
        displayDriverPerformanceSummary(currentUser.uid, tasks);

    }, (error) => {
        console.error("Firestore Error (Driver Tasks):", error);
        showNotification("Permission error: Could not load your assigned tasks.", true);
    });
}

function openCompletionModal(delivery) {
    activeDeliveryForCompletion = delivery; 
    document.getElementById('delivery-id-input').value = delivery.id;
    document.getElementById('modal-job-no').textContent = delivery.jobFileData.jfn;
    document.getElementById('modal-location').textContent = delivery.deliveryLocation;
    document.getElementById('completion-form').reset();

    // Reset modal to show completion form first
    document.getElementById('completion-form-wrapper').style.display = 'block';
    document.getElementById('post-delivery-qr-wrapper').style.display = 'none';

    
    const canvas = document.getElementById('completion-signature-pad');
    const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        const context = canvas.getContext("2d");
        context.scale(ratio, ratio);
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (completionSignaturePad) completionSignaturePad.clear();
    }
    setTimeout(resizeCanvas, 10);
    
    if (!completionSignaturePad) {
        completionSignaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)' // Set background to white
        });
    } else {
        completionSignaturePad.clear();
    }

    document.getElementById('location-status').textContent = '';
    currentGeolocation = null;
    openModal('delivery-completion-modal');
}

async function handleCompleteDelivery(e) {
    e.preventDefault();
    const deliveryId = document.getElementById('delivery-id-input').value;
    const receiverName = document.getElementById('receiver-name').value.trim();
    const receiverMobile = document.getElementById('receiver-mobile').value.trim();

    if (!receiverName || !receiverMobile) {
        showNotification("Please enter the receiver's name and mobile number.", true);
        return;
    }
    if (completionSignaturePad.isEmpty()) {
        showNotification("Please capture the receiver's signature.", true);
        return;
    }

    showLoader();
    try {
        const signatureDataUrl = completionSignaturePad.toDataURL('image/jpeg', 0.5);
        
        const deliveryData = activeDeliveryForCompletion;
        if (!deliveryData) {
            throw new Error("Could not find the delivery data to process.");
        }

        const podData = {
            deliveryId: deliveryId,
            jobFileId: deliveryData.jobFileId,
            jobFileData: deliveryData.jobFileData,
            deliveryLocation: deliveryData.deliveryLocation,
            receiverName: receiverName,
            receiverMobile: receiverMobile,
            signatureDataUrl: signatureDataUrl, // Save as Data URL
            completedAt: serverTimestamp(),
            driverUid: currentUser.uid,
            driverName: currentUser.displayName,
        };
        if (currentGeolocation) {
            podData.geolocation = currentGeolocation.coords;
            podData.geolocationName = currentGeolocation.displayName;
        }

        const podDocRef = doc(db, 'pods', deliveryId);
        await setDoc(podDocRef, podData);

        const deliveryRef = doc(db, 'deliveries', deliveryId);
        await updateDoc(deliveryRef, {
            status: 'Delivered',
            completedAt: serverTimestamp(),
            podId: deliveryId,
            receiverName: receiverName
        });

        // Transition to QR code view
        document.getElementById('completion-form-wrapper').style.display = 'none';
        document.getElementById('post-delivery-qr-wrapper').style.display = 'block';

        const qrContainer = document.getElementById('feedback-qrcode-container');
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: `${window.location.origin}${window.location.pathname}?feedbackId=${deliveryId}`,
            width: 150,
            height: 150,
        });


    } catch (error) {
        console.error("Error completing delivery:", error);
        showNotification(`Failed to complete delivery: ${error.message}`, true);
    } finally {
        hideLoader();
    }
}

function handleGetLocation() {
    const statusEl = document.getElementById('location-status');
    if (!navigator.geolocation) {
        statusEl.textContent = 'Geolocation is not supported by your browser.';
        return;
    }

    statusEl.textContent = 'Getting location...';
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            statusEl.textContent = `Coordinates captured. Fetching address...`;

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`);
                if(!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                const displayName = data.display_name || 'Address not found';
                
                currentGeolocation = {
                    coords: coords,
                    displayName: displayName
                };
                statusEl.textContent = `Location: ${displayName}`;
                statusEl.style.color = '#16a34a';

            } catch (error) {
                console.error('Reverse geocoding error:', error);
                statusEl.textContent = 'Could not fetch address name, but coordinates saved.';
                currentGeolocation = { coords: coords, displayName: 'N/A' };
                statusEl.style.color = '#eab308';
            }
        },
        () => {
            statusEl.textContent = 'Unable to retrieve your location.';
            statusEl.style.color = '#dc2626';
        }
    );
}

// --- Receipt Logic ---
async function openReceiptModal(deliveryId) {
    showLoader();
    try {
        const podDocRef = doc(db, 'pods', deliveryId);
        const podDoc = await getDoc(podDocRef);
        
        if (podDoc.exists()) {
            activeDeliveryForReceipt = podDoc.data();
        } else {
            throw new Error("Receipt data not found in PODs collection.");
        }
        
        document.getElementById('generate-as-copy').checked = false;
        openModal('receipt-modal', true);
        const receiptHTML = generateReceipt(false);
        document.getElementById('receipt-content').innerHTML = receiptHTML;
        generateQRCodes();


    } catch (error) {
        console.error("Error opening receipt:", error);
        showNotification(error.message, true);
    } finally {
        hideLoader();
    }
}

function generateQRCodes(container = document) {
     const data = activeDeliveryForReceipt;
     const publicUrl = window.location.origin + window.location.pathname + '?podId=' + data.deliveryId;

     const qrVerifyContainer = container.querySelector('#receipt-verification-qrcode');
     if(qrVerifyContainer) {
        qrVerifyContainer.innerHTML = '';
        new QRCode(qrVerifyContainer, {
            text: publicUrl,
            width: 80, height: 80, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
        });
     }
     
     const qrDownloadContainer = container.querySelector('#receipt-download-qrcode');
      if(qrDownloadContainer) {
        qrDownloadContainer.innerHTML = '';
        new QRCode(qrDownloadContainer, {
            text: publicUrl,
            width: 80, height: 80, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
        });
     }
}

function generateReceipt(isCopy = false) {
    const data = activeDeliveryForReceipt;
    const jobData = data.jobFileData;
    const deliveryDate = (data.completedAt?.toDate() || new Date()).toLocaleString();

    let locationInfo = data.geolocationName || 'Not Captured.';
    if (data.geolocation) {
        locationInfo += ` <a href="https://www.google.com/maps?q=${data.geolocation.lat},${data.geolocation.lng}" target="_blank" class="text-blue-600 hover:underline text-xs ml-2">[View on Map]</a>`;
    }
    
    const copyWatermark = isCopy ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 8rem; color: rgba(255, 0, 0, 0.15); font-weight: bold; z-index: 1000; pointer-events: none;">COPY</div>` : '';

    // Define logos as Base64 strings to ensure they always load
    const iataLogo = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAwIDMwMCI+PHBhdGggZD0iTTc0LjggMjY2LjR2LTkyLjNINjAuMXY5Mi4zSDIzdjI4LjdoMTA1di0yOC43SDc0Ljh6bTIwOC42LTI4LjdsMTcuMy05Mi4zaDE4LjlsLTE3LjMgOTIuM0gyODMuNHptNDMuMSAwTDMxMS4xIDc0aDQ0bC0xNS40IDk5LjgtMTUuMyA5Mi42aC00My4xbDE1LjQtOTkuNyAxNS4yLTkyLjdoNDQuMmwzMi44IDE5Mi40aC00My41bC0xNS4yLTkyLjZMMzU1IDc0aC00My42bDE1LjQgOTkuOCAxNS4yIDkyLjZoNDMuMXptMTkxLjYgMjguN2g0My44VjI2Nkg1MTguMnYtOTIuM2gtNDMuOHY5Mi4zaC0yMi41djI4LjdoODYuOHYtMjguN3ptOTYuNSAwaDQzLjdWMTAyLjRoLTM4LjlMNjA0IDc0aDk0djIyMC43aDQzLjh2MjguN0g2MDJWMzAwaC0xLjR6bTE5NS4yLTI4LjdsMTcuMy05Mi4zaDE4LjlsLTE3LjMgOTIuM0g4MTUuM3ptNDMuMSAwTjg0MyA3NGg0NC4xbC0xNS40IDk5LjgtMTUuMyA5Mi42aC00My4xbDE1LjQtOTkuNyAxNS4yLTkyLjdoNDQuMmwzMi44IDE5Mi40aC00My41bC0xNS4yLTkyLjZMOTAwLjUgNzRoLTQzLjZsMTUuNCA5OS44IDE1LjIgOTIuNmg0My4xek0xMDY5LjQgNzRoLTM1LjdsLTU0LjUgMzAwaDQ1LjNsMTEuNC02My42aDUzLjVsMTEuMyA2My42aDQ1LjRMMTA2OS40IDc0em0tNi40IDE4NC4xbC0xOC44LTExMC4xLTE4LjggMTEwLjFoMzcuNnoiLz48L3N2Zz4=";
    const wcaLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACACAMAAABrZuVzAAAAYFBMVEX///8AQ4sAQIsAP4oAO4kAN4gANIcAOYgAOIkAOYoAN4sAOIjp7fUAOIlso9EAM4a/x94gS5QAT5sAUJgAQYpUkcYAQ4zp7vMAYqEAL4AAKnsALoEAMYIAJ3UAKn4AKX/q7/cAUIyTAAADcklEQVR4nO3b63aqOBSG4fAQQkBtqU3tde//ikdbS1sLtTSS5+z9fn+x504yE8jDDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYF/2+0vV/Vn2+z88G/291v+2F/V21d01q/09A6t/Qf0h1l/a/n7t9X+wn8pP1W2v/c/9mY5Xf2h/a/1r/Vv+1/oV+/sZ+ysdVf+k/lr/tL61/pH+rf4b/Wv9e/3b/jf6z5003V/sB7DPqg81v1V/qf/aP1r/TP+2/5b+y/qP3v6d/rf6H/Uf6596+3f65/pf3t/Z/13/tfenbX9v/2t/W//S3sB+7M820n/Wz/S39lf2h/ZH9lv21/b39v/29/bP9s862j/b79u/21/ar9jf2d/bH9i/2b/bb9u/6l/Zf1f+y/q/9l/Uf6T/Rf1b+i/rH9B/s/1H+i/pH+i/vP6v/Tf13+k/tv6n/R+bY/v/LMP2/8M0/b/1L+yv7J+w/8k+JP/V/kn7D/e/uv+L/f/tP9l/6f9X/Tf6X+6/9f+n/p/6n/d/zv/T/yP/b/xP+h/r/8h/6v+g/4n+g/23+v/3/7X/f/1/8B/d/w7+o/xP81/lv4r+K/iv6b+a/ov5b+u/tv47+e/mv5b+S/kv7b+K/hv4b+G/tv4b+C/gv6L+C/iv57+a/mv5r+a/lv6L+W/rv7b+u/tv6T+k/pP7b+k/pP6L+i/ov6L+i/rv6r+6/qv7j+o/uP7T+0/pP7T+0/ov6L+i/ov5r+a/mv5r+a/mv5b+W/lv67+W/rv7T+w/sP7b+w/pP6T+k/tP6L+k/ov6r+q/uv6r+6/tP7T+2/rP+A/uP4D+w/vP6D+8/tP7L+y/tv6b+m/tv6b+o/sP7D+o/ov6T+s/rP4z+M/rP6T+w/sP7T+s/rP6z+s/rP7z+8/tP6L+i/tv6r+u/pv6b+m/tv6b+m/tv6T+o/rP7D+o/rP6z+o/vP7L+i/sv67+q/ru6r+u/uv6j+o/rP4j+I/vP6j+q/uP4j+0/pP6T+0/pP7T+i/qv6L+q/kv5r+a/mv5r+a/kv6b+u/tu6b+u/tu47+e/tv47+O/jv5r+K/tv4b+G/hv4b+e/gv4L+K/gv4b+e/lv5r+a/mv5b+a/mv5r+O/jv67+e/rv7T+g/tP6j+o/qP6j+g/pP6j+k/qP7T+g/tP6T+8/qP7j+q/uP6z+s/vP6z+u/vP67+w/sP7T+w/sP7T+y/sv6j+i/qP6L+m/qP6r+m/rP4D+w/oP6L+y/sP7L+o/pP6T+i/tP6L+0/pP6T+2/pP7b+2/rP67+u/uP4j+4/pP7j+s/pP7z+4/uP6j+w/sP7T+g/pP6z+y/uP6j+8/qP7z+i/rP6z+g/qP6z+o/qP6z+k/rP6T+8/qP7T+k/qP6T+k/qP6T+k/qP6L+wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgH/9A7aQ4B/4cQ/qAAAAAElFTkSuQmCC";
    const iamLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAACACAMAAAB49WnWAAAAQlBMVEX////AADcAAADa2tsAADOysrL6+voAAAb29vYAAAnMzMzp6ekAAAjh4eEAABBMS0toamp+fn4AAATExMSlpaWbm5s2NjZLS0s6ODgI5M0QAAAD0klEQVR4nO2byXaCMAxFIVsJsbrD/V/hAvJpMu6Nplk5/29EDgp6cFAggAAAAAAAAAAAAAAAAAAAAAAAIzY+np29PX5qQ+kPkD6/uG58S+pD3A+hPjH3R8W/tD6Yen3n/5+gr8l/b30x9cfsH/V35n6A+ovU39p/bX1D63/YP/n/S+rv7z+o/tvqn9y/3f+B/kf/L/r/4T/Jf8h98f8P/Nf83/V/zn/Q/4L/z/V/0f/F/1/+b/j/1r/zP+h/wP/R/y//x+3f7b/1/6v/h/6v+P/kP+x/4P/v/o/4f+c/1v+D/0/7X/w/1n/uP5b/g/97/A/1P/d/yn/f/v/2v/j/h/7f+z/iP/X/wP/9/1f8v/A/7v/T//w8//+v5X/P/u/8H/e/+H/d/wv/F/wv+7/X/3//x/7f+D/j/9r/Gf/P/j/+r/6f8//T/t/+D/h/9v/Bf4r/f/2/9v/S/+f+B/8P+v/r/9//T/v/5X/d/yv+l/3f9//Vf8H/N/xf+T/qf+n/rf9//I/8/+X/4P+T/h/6v/N/7v/B/2f9L/2/8p/2/+T/6v/J/wP/F/wv/7/B/5v/5/5v/x/6/+l/5v/1/zP/T/rf/z/p/4v/b/3/+7/t/+f+D/6v9b/w/+D/3v+D/3v8T/t/7f9T/t/7v/r/yP/h/yP/7/8H/h/+H/5f8X/r/5X/v/2/8v/P/w//r/j/8//Gf8//lf+f+r/2/+n/f/zP/H/0P+H/9/+r/6/9P/e/+H/D/0P/B/3P/J/0v+3/l/6v/V/0f+z/m/63/b/yP+n/0f9//X/9v+3/r/8H/H/7f/P/wv+T/9f8X/H/4v+f/n/6X/h/7P/T/xv+X/w/+b/gP+p/w/9X/N/5v+x/yP/p/z/9D/g/57/O/7P+j/sf+D/g/53/E/5/+T/pf9n/W/6v+B/8f+d/yv+7/2f8f/e/6/+P/x//F//P+v/of+n/h/5P+f/kf+X/pf8n/S/5v+v/of9n/Q/9P/a/7P+t/w/8v/U/5P+l/xf9P/I/6X/B/4v/R/y//H/if9v/Q/4P+T/sf/D/9/+t/3f+D/lf93/D/9/+d/3f8v/W/9/+n/v/43/e/yv/L/8f8v/d/0f/b/sf/7/l/+n/x/6v/L/zP/d/3P/H/s/73/n/y//n/z/8n/Q/93/b/w//n/9/7/9D/4f+j/z/8z/f/7v/D/wf+D/qf/z/j/6n/d/y/+b/2/+T/if+H/k/4H/m/5H/i/+v/b/+f+3/l/4X/9/wf+j/of93/N/8P/f/wf87/O/8//E/7/+H/lf8n/F/wf9T/Gf9X/E/6H/F/0P+7/z/+x/z/+l/3/8j/T/yv+x/wv+z/r/8P/H/y//n/l/8v/v/4P+x/4P/p/7f9n/n/6H/e/+H/u/7v+x/8f+L/3f+D/2/+D/uf+L/g/7H/s/8v/V/7f+z/wf9z/N/8H/h/+3/n/9v/f/of+n/if9X/U/9v/s/4v/j/xv/9/zv9D/q/93/q/5n/l/2/9j/x/+T/sf9P/X/4v/h/x//B/4v+x/8/9T/c/8f/+/4n/+/4n/i/8X/Q/9v/e/6H/l/43/K/8X/y/6X/D/1P+H/3/+z/m/+r/p/+3/g/4H/p/73/1/6f+v/qf9X/QAAAAAAAAAAAAAAAAAAAAAAAOCZf9t2f3r9c8sCAAAAAElFTkSuQmCC";

    const receiptHTML = `
        <div class="space-y-4 text-gray-800" style="position: relative;">
            ${copyWatermark}
            <!-- ============================ NEW HEADER ============================ -->
            <div class="flex flex-col sm:flex-row justify-between items-start pb-4 border-b-2 border-gray-200">
                <div>
                    <h1 class="text-4xl font-extrabold" style="color: #0E639C;">Q'go<span style="color: #4FB8AF;">Cargo</span></h1>
                    <p class="text-xs text-gray-500">www.qgocargo.com</p>
                    <p class="text-xs text-gray-500 italic">Formerly known as Boodai Aviation Group</p>
                </div>
                <div class="text-right text-xs mt-4 sm:mt-0">
                    <p class="font-bold">CARGO DIVISION</p>
                    <p>A/F Cargo Complex, Waha Mall,</p>
                    <p>Ground Floor, Office # 28, Kuwait</p>
                    <p>Tel: 1887887, 22087411/2</p>
                    <p>Email: cargo@qgoaviation.com</p>
                </div>
            </div>
            <!-- ============================ END NEW HEADER ============================ -->

            <!-- Title and QR Code -->
            <div class="flex flex-wrap justify-between items-start pt-2 gap-4">
                <div>
                     <h2 class="text-2xl font-bold text-gray-700">PROOF OF DELIVERY</h2>
                </div>
                <div class="flex gap-4">
                    <div class="text-center p-2 rounded-lg bg-gray-100">
                        <p class="text-sm font-bold text-gray-800">Verify POD</p>
                        <div id="receipt-verification-qrcode" class="p-1 bg-white border rounded-md inline-block mt-1"></div>
                    </div>
                    <div class="text-center p-2 rounded-lg bg-gray-100">
                        <p class="text-sm font-bold text-gray-800">Download PDF</p>
                        <div id="receipt-download-qrcode" class="p-1 bg-white border rounded-md inline-block mt-1"></div>
                    </div>
                </div>
            </div>

            <!-- Job Details -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div><strong class="text-gray-500 block">Job File No:</strong> <span class="font-mono">${jobData.jfn || 'N/A'}</span></div>
                <div><strong class="text-gray-500 block">Invoice No:</strong> <span class="font-mono">${jobData.in || 'N/A'}</span></div>
                <div><strong class="text-gray-500 block">AWB / MAWB:</strong> <span class="font-mono">${jobData.mawb || 'N/A'}</span></div>
                <div><strong class="text-gray-500 block">Airlines:</strong> ${jobData.ca || 'N/A'}</div>
                <div><strong class="text-gray-500 block">Shipper:</strong> ${jobData.sh || 'N/A'}</div>
                <div><strong class="text-gray-500 block">Consignee:</strong> ${jobData.co || 'N/A'}</div>
                <div><strong class="text-gray-500 block">Origin:</strong> ${jobData.or || 'N/A'}</div>
                <div><strong class="text-gray-500 block">Destination:</strong> ${jobData.de || 'N/A'}</div>
                <div class="col-span-1 sm:col-span-2"><strong class="text-gray-500 block">Description:</strong> ${jobData.dsc || 'N/A'}</div>
                <div class="col-span-1 sm:col-span-2"><strong class="text-gray-500 block">Gross Weight:</strong> ${jobData.gw || 'N/A'}</div>
            </div>

            <!-- Delivery Details -->
            <div class="bg-gray-50 p-4 rounded-lg border">
                <h4 class="font-bold text-lg mb-3">Delivery Confirmation</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <div><strong class="text-gray-500 block">Delivered To:</strong> ${data.receiverName}</div>
                    <div><strong class="text-gray-500 block">Contact:</strong> ${data.receiverMobile}</div>
                    <div class="col-span-1 sm:col-span-2"><strong class="text-gray-500 block">Date & Time:</strong> ${deliveryDate}</div>
                    <div class="col-span-1 sm:col-span-2"><strong class="text-gray-500 block">Delivery Address:</strong> ${data.deliveryLocation}</div>
                    <div class="col-span-1 sm:col-span-2"><strong class="text-gray-500 block">GPS Location:</strong> ${locationInfo}</div>
                    <div class="col-span-1 sm:col-span-2"><strong class="text-gray-500 block">POD Confirmed By (Driver):</strong> ${data.driverName}</div>
                </div>
                <div class="mt-4 pt-4 border-t">
                    <p class="text-gray-600 text-sm italic mb-2">"I, <strong>${data.receiverName}</strong>, confirm I have received this shipment from the driver, <strong>${data.driverName}</strong>, in good condition on the date specified above."</p>
                    <p class="text-gray-500 text-sm font-bold mb-1">Receiver's Signature:</p>
                    <img src="${data.signatureDataUrl}" alt="Signature" class="w-48 bg-white border-2 p-1 rounded-md shadow-inner"/>
                </div>
            </div>
            
            <!-- ============================ NEW FOOTER WITH LOGOS ============================ -->
             <div class="pt-4 border-t-2 border-gray-200 text-xs text-gray-600 space-y-3">
               <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div class="flex items-center gap-4 flex-wrap justify-center">
                       <img src="${iataLogo}" alt="IATA Logo" class="h-6 object-contain">
                       <img src="${wcaLogo}" alt="WCA Logo" class="h-8 object-contain">
                       <img src="${iamLogo}" alt="IAM Logo" class="h-8 object-contain">
                    </div>
                    <p class="font-semibold text-center sm:text-right">We are your one-stop-shop for logistics solutions.</p>
               </div>
               <div class="text-center border-t pt-3 mt-3">
                   <p class="font-bold">Q'GO TRAVEL & TOURISM COMPANY W.L.L</p>
                   <p>Address: P.O. Box 5798 Safat 13058 Kuwait | Tel: 1 887 887 | Fax: 22087419</p>
               </div>
            </div>
            <!-- ============================ END NEW FOOTER ============================ -->
        </div>
    `;
    return receiptHTML;
}

// Helper to generate a printable/pdf-friendly canvas of the receipt
async function getReceiptCanvas(isCopy) {
    const receiptHTML = generateReceipt(isCopy);
    
    // Create a hidden, A4-styled div for rendering
    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px'; // Move it off-screen
    printContainer.style.width = '210mm'; // A4 width
    printContainer.style.padding = '15mm';
    printContainer.style.backgroundColor = 'white';
    printContainer.style.boxSizing = 'border-box';
    printContainer.innerHTML = receiptHTML;
    document.body.appendChild(printContainer);

    // Re-generate QR codes inside the temporary container before capturing
    generateQRCodes(printContainer);
    
    const canvas = await html2canvas(printContainer, { scale: 2 });
    document.body.removeChild(printContainer); // Clean up
    return canvas;
}

async function downloadReceiptAsPDF() {
    const isCopy = document.getElementById('generate-as-copy')?.checked || false;
    showLoader();
    const { jsPDF } = window.jspdf;
    
    try {
        const canvas = await getReceiptCanvas(isCopy);
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        
        // Fit image to page width with some margin
        const finalWidth = pdfWidth - 40; 
        const finalHeight = finalWidth / ratio;
        
        pdf.addImage(imgData, 'PNG', 20, 20, finalWidth, finalHeight);
        pdf.save(`Receipt-${activeDeliveryForReceipt.jobFileData.jfn}${isCopy ? '-COPY' : ''}.pdf`);

    } catch (error) {
        console.error("Error generating PDF:", error);
        showNotification("Could not generate PDF.", true);
    } finally {
        hideLoader();
    }
}

function printReceipt() {
    const isCopy = document.getElementById('generate-as-copy')?.checked || false;
    const receiptHTML = generateReceipt(isCopy);
    const printWindow = window.open('', '', 'height=842,width=595');
    printWindow.document.write('<html><head><title>Delivery Receipt</title>');
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"><\/script>');
    printWindow.document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>');
    printWindow.document.write(`
        <style>
            @media print { @page { size: A4; margin: 15mm; } }
            body { font-family: 'Inter', sans-serif; }
        </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(receiptHTML);
    printWindow.document.write(`
        <script>
            window.onload = function() {
                const data = ${JSON.stringify(activeDeliveryForReceipt)};
                const publicUrl = window.location.origin + window.location.pathname + '?podId=' + data.deliveryId;
                
                const qrVerifyContainer = document.getElementById('receipt-verification-qrcode');
                if (qrVerifyContainer) {
                    new QRCode(qrVerifyContainer, { text: publicUrl, width: 80, height: 80 });
                }
                const qrDownloadContainer = document.getElementById('receipt-download-qrcode');
                 if (qrDownloadContainer) {
                    new QRCode(qrDownloadContainer, { text: publicUrl, width: 80, height: 80 });
                }

                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500);
            }
        <\/script>
    `);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
}

// --- Admin Panel ---
async function openAdminPanel() {
    showLoader();
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const listEl = document.getElementById('user-list-admin');
        listEl.innerHTML = '';
        if(users.length === 0) {
            listEl.innerHTML = `<p class="text-gray-500 text-center p-4">No users found.</p>`;
        } else {
            users.forEach(user => {
                const canDelete = currentUser.uid !== user.id;
                const deleteButton = canDelete ? `<button onclick="confirmUserDelete('${user.id}', '${user.displayName}')" class="btn btn-danger text-xs">Delete</button>` : '';
                
                const userEl = document.createElement('div');
                // Mobile-first responsive design for the user list
                userEl.className = "p-3 border-b space-y-2 md:space-y-0 md:grid md:grid-cols-4 md:gap-4 md:items-center";
                userEl.innerHTML = `
                     <!-- User Info (always visible) -->
                    <div class="flex justify-between items-center md:block col-span-1">
                        <div>
                            <p class="font-medium">${user.displayName}</p>
                            <p class="text-xs text-gray-500">${user.email}</p>
                        </div>
                        <div class="md:hidden text-sm text-gray-600 capitalize p-1 bg-gray-100 rounded">${user.role}</div>
                    </div>
                    <!-- Status Select (always visible) -->
                    <div class="col-span-1">
                        <label class="text-xs font-semibold text-gray-500 md:hidden">Status</label>
                        <select data-uid="${user.id}" class="input-field status-select text-sm p-2">
                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                     <!-- Role (visible on medium screens and up) -->
                    <div class="hidden md:block text-sm text-gray-600 capitalize col-span-1">${user.role}</div>
                     <!-- Actions (always visible) -->
                    <div class="text-right col-span-1">
                        ${deleteButton}
                    </div>
                `;
                listEl.appendChild(userEl);
            });
        }
        openModal('admin-panel-modal');
    } catch (error) {
        console.error("Error opening admin panel:", error);
        showNotification("Could not load user data.", true);
    } finally {
        hideLoader();
    }
}

async function saveUserChanges() {
    showLoader();
    const batch = writeBatch(db);
    const statusSelects = document.querySelectorAll('.status-select');
    
    statusSelects.forEach(select => {
        const uid = select.dataset.uid;
        const newStatus = select.value;
        const docRef = doc(db, 'users', uid);
        batch.update(docRef, { status: newStatus });
    });

    try {
        await batch.commit();
        showNotification("User statuses updated successfully!", false);
        closeModal('admin-panel-modal');
        loadAdminData();
    } catch (error) {
        console.error("Error saving user statuses:", error);
        showNotification("Failed to update statuses.", true);
    } finally {
        hideLoader();
    }
}

window.confirmUserDelete = (userId, userName) => {
    const modal = document.getElementById('confirm-modal');
    modal.querySelector('#confirm-title').textContent = 'Confirm User Deletion';
    modal.querySelector('#confirm-message').innerHTML = `Are you sure you want to delete the user "${userName}"? This will only remove them from the application database, not from Firebase Authentication.`;
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const handleOkClick = () => {
        deleteUserFromFirestore(userId);
        closeModal('confirm-modal');
    };
    okButton.addEventListener('click', handleOkClick, { once: true });
}

window.confirmPodCancel = (deliveryId, jobFileNo) => {
    const modal = document.getElementById('confirm-modal');
    modal.querySelector('#confirm-title').textContent = 'Confirm POD Cancellation';
    modal.querySelector('#confirm-message').innerHTML = `Are you sure you want to cancel the POD for job file "${jobFileNo}"? This will delete the receipt and set the delivery back to "Pending".`;
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    const handleOkClick = () => {
        cancelPod(deliveryId);
        closeModal('confirm-modal');
    };
    okButton.addEventListener('click', handleOkClick, { once: true });
}

async function cancelPod(deliveryId) {
    showLoader();
    try {
        const batch = writeBatch(db);

        const podRef = doc(db, 'pods', deliveryId);
        batch.delete(podRef);

        const deliveryRef = doc(db, 'deliveries', deliveryId);
        batch.update(deliveryRef, {
            status: 'Pending',
            podId: deleteField(),
            completedAt: deleteField(),
            receiverName: deleteField(),
            receiverMobile: deleteField(),
        });
        
        await batch.commit();
        showNotification("POD cancelled and delivery status reset.", false);
    } catch (error) {
        console.error("Error cancelling POD:", error);
        showNotification("Failed to cancel POD.", true);
    } finally {
        hideLoader();
    }
}

async function deleteUserFromFirestore(userId) {
    showLoader();
    try {
        await deleteDoc(doc(db, 'users', userId));
        showNotification("User deleted successfully from Firestore.", false);
        openAdminPanel(); // Refresh the list
    } catch (error) {
        console.error("Error deleting user:", error);
        showNotification("Failed to delete user.", true);
    } finally {
        hideLoader();
    }
}

async function showPublicPodView(podId) {
    showLoader();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'none';
    
    try {
        const podDocRef = doc(db, 'pods', podId);
        const podDoc = await getDoc(podDocRef);

        if (podDoc.exists()) {
            activeDeliveryForReceipt = podDoc.data();
            const view = document.getElementById('public-pod-view');
            view.style.display = 'block';
            view.innerHTML = `
                <div class="container mx-auto p-4 sm:p-6 lg:p-8">
                    <div id="receipt-content-public" class="p-4 border rounded-md bg-white shadow-lg"></div>
                    <div class="text-center mt-4">
                        <button id="public-download-pdf" class="btn btn-primary">Download PDF</button>
                    </div>
                </div>`;
            
            const receiptHTML = generateReceipt(false); // Generate without copy watermark
            document.getElementById('receipt-content-public').innerHTML = receiptHTML;
            generateQRCodes(document.getElementById('public-pod-view'));
            
            document.getElementById('public-download-pdf').addEventListener('click', downloadPublicReceiptAsPDF);

        } else {
            document.body.innerHTML = `<div class="p-4 text-center text-red-700 bg-red-100">POD with ID "${podId}" not found.</div>`;
        }

    } catch(e) {
        console.error("Error fetching public POD:", e);
        document.body.innerHTML = `<div class="p-4 text-center text-red-700 bg-red-100">Error loading POD.</div>`;
    } finally {
        hideLoader();
        document.body.classList.remove('loading');
    }
}

async function downloadPublicReceiptAsPDF() {
    showLoader();
    const { jsPDF } = window.jspdf;
    
    try {
        const publicReceiptHTML = generateReceipt(false);

        const printContainer = document.createElement('div');
        printContainer.style.position = 'absolute';
        printContainer.style.left = '-9999px';
        printContainer.style.width = '210mm';
        printContainer.style.padding = '15mm';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.boxSizing = 'border-box';
        printContainer.innerHTML = publicReceiptHTML;
        document.body.appendChild(printContainer);

        generateQRCodes(printContainer);

        const canvas = await html2canvas(printContainer, { scale: 2 });
        document.body.removeChild(printContainer);

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const ratio = canvas.width / canvas.height;
        const finalWidth = pdfWidth - 40;
        const finalHeight = finalWidth / ratio;
        
        pdf.addImage(imgData, 'PNG', 20, 20, finalWidth, finalHeight);
        pdf.save(`Receipt-${activeDeliveryForReceipt.jobFileData.jfn}.pdf`);
    } catch (error) {
        console.error("Error generating public PDF:", error);
        showNotification("Could not generate PDF.", true);
    } finally {
        hideLoader();
    }
}


// --- Driver Performance Dashboard ---
async function openDriverPerformanceDashboard() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
        showNotification("Access denied.", true);
        return;
    }

    showLoader();
    try {
        // Fetch feedback on demand
        const feedbackQuery = query(collection(db, 'feedback'));
        const feedbackSnapshot = await getDocs(feedbackQuery);
        feedbackCache = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const drivers = allUsersCache.filter(u => u.role === 'driver');
        const driverStats = drivers.map(driver => {
            const completed = deliveriesCache.filter(d => d.driverUid === driver.id && d.status === 'Delivered').length;
            const pending = deliveriesCache.filter(d => d.driverUid === driver.id && d.status !== 'Delivered').length;
            const skipped = deliveriesCache.filter(d => d.driverUid === driver.id && d.feedbackStatus === 'skipped').length;
            
            const driverFeedback = feedbackCache.filter(f => f.driverUid === driver.id);
            const totalRatings = driverFeedback.length;
            const averageRating = totalRatings > 0 ? (driverFeedback.reduce((sum, f) => sum + f.rating, 0) / totalRatings) : 0;

            return { ...driver, completed, pending, averageRating, totalRatings, skipped };
        });

        driverStats.sort((a, b) => b.completed - a.completed); // Sort by most completed

        const statsListEl = document.getElementById('driver-stats-list');
        statsListEl.innerHTML = '';

        if (driverStats.length > 0) {
            driverStats.forEach(stat => {
                const starRating = '★'.repeat(Math.round(stat.averageRating)) + '☆'.repeat(5 - Math.round(stat.averageRating));
                const statCard = document.createElement('div');
                statCard.className = 'p-4 border rounded-lg bg-white space-y-4 md:space-y-0 md:flex md:justify-between md:items-center';
                statCard.innerHTML = `
                     <div class="flex-shrink-0">
                        <p class="font-bold text-lg">${stat.displayName}</p>
                        <p class="text-sm text-gray-600">${stat.email}</p>
                    </div>
                    <div class="flex flex-wrap justify-center md:justify-end items-center gap-4 text-center flex-grow">
                        <div title="Average Rating: ${stat.averageRating.toFixed(2)} (${stat.totalRatings} ratings)">
                            <p class="text-2xl font-bold text-yellow-500">${starRating}</p>
                            <p class="text-xs text-gray-500">Avg. Rating</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-green-600">${stat.completed}</p>
                            <p class="text-xs text-gray-500">Completed</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-yellow-600">${stat.pending}</p>
                            <p class="text-xs text-gray-500">Pending</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-red-500">${stat.skipped || 0}</p>
                            <p class="text-xs text-gray-500">Skipped</p>
                        </div>
                    </div>
                    <div class="flex justify-center md:justify-end gap-2 flex-shrink-0 w-full md:w-auto">
                        <button onclick="showDriverFeedback('${stat.id}')" class="btn btn-primary btn-xs text-xs">View Feedback</button>
                        <button onclick="showDriverDeliveries('${stat.id}')" class="btn btn-secondary btn-xs text-xs">View Deliveries</button>
                    </div>
                `;
                statsListEl.appendChild(statCard);
            });
        } else {
            statsListEl.innerHTML = '<p class="text-center text-gray-500">No active drivers found.</p>';
        }

        // Chart.js rendering
        const chartCanvas = document.getElementById('driver-chart');
        if (driverChartInstance) {
            driverChartInstance.destroy();
        }
        
        const chartLabels = driverStats.map(d => d.displayName);
        const chartData = driverStats.map(d => d.completed);

        driverChartInstance = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Completed Deliveries',
                    data: chartData,
                    backgroundColor: 'rgba(79, 184, 175, 0.6)',
                    borderColor: 'rgba(79, 184, 175, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Completed Deliveries per Driver'
                    }
                }
            }
        });

        openModal('driver-performance-modal');
    } catch (error) {
        console.error("Error opening driver dashboard:", error);
        showNotification("Could not load driver performance data.", true);
    } finally {
        hideLoader();
    }
}

function showDriverDeliveries(driverId) {
    const driver = allUsersCache.find(u => u.id === driverId);
    if (!driver) return;
    const driverDeliveries = deliveriesCache.filter(d => d.driverUid === driverId);
    
    const modalTitle = document.getElementById('user-jobs-modal-title');
    const list = document.getElementById('user-jobs-list');

    modalTitle.textContent = `Deliveries for ${driver.displayName}`;
    
    if (driverDeliveries.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-center p-4">This driver has no assigned deliveries.</p>';
    } else {
        list.innerHTML = '';
        driverDeliveries.forEach(delivery => {
            const card = createDeliveryCard(delivery); 
            list.appendChild(card);
        });
    }
    openModal('user-jobs-modal', true); 
}

// --- Public Feedback Logic ---
async function showPublicFeedbackView(feedbackId) {
    document.querySelectorAll('body > div').forEach(el => el.style.display = 'none');
    document.getElementById('public-feedback-view').style.display = 'flex';
    document.body.classList.remove('loading');
    showLoader();
    try {
        // First, check if feedback already exists
        const feedbackRef = doc(db, 'feedback', feedbackId);
        const feedbackSnap = await getDoc(feedbackRef);

        if (feedbackSnap.exists()) {
            document.getElementById('feedback-form-container').style.display = 'none';
            document.getElementById('feedback-thanks-message').style.display = 'block';
            document.getElementById('feedback-thanks-message').innerHTML += '<p class="text-sm mt-2">You have already rated this delivery.</p>';
            return; 
        }

        const deliveryRef = doc(db, 'deliveries', feedbackId);
        const deliverySnap = await getDoc(deliveryRef);
        if (deliverySnap.exists()) {
            const deliveryData = deliverySnap.data();
            document.getElementById('feedback-delivery-id').value = feedbackId;
            document.getElementById('feedback-job-no').textContent = deliveryData.jobFileData.jfn;
            document.getElementById('feedback-driver-name').textContent = deliveryData.driverName;
        } else {
            throw new Error('Delivery not found.');
        }
    } catch (error) {
        // DEVELOPER NOTE: This error is often caused by Firestore security rules.
        // For this public feedback page to work, unauthenticated users need read access
        // to individual documents in the 'deliveries' and 'feedback' collections.
        // Your rules should look something like this:
        // match /deliveries/{deliveryId} { allow get: if true; ... }
        // match /feedback/{feedbackId} { allow get: if true; ... }
        document.getElementById('feedback-form-container').innerHTML = '<p class="text-red-500 font-semibold">COULD NOT LOAD DELIVERY DETAILS.</p><p class="text-xs text-gray-500 mt-2">This may be due to a network issue or a permissions problem. Please try again later.</p>';
        console.error("Error loading for feedback:", error);
    } finally {
        hideLoader();
    }
}

// --- Feedback Helpers to get Device and IP ---
function getDeviceDetails() {
    return navigator.userAgent || 'Unknown';
}

async function getIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        if (!response.ok) return 'Unavailable';
        const data = await response.json();
        return data.ip || 'Unavailable';
    } catch (error) {
        console.error("Could not fetch IP address:", error);
        return 'Unavailable';
    }
}

// UPDATED AND ENHANCED: More comprehensive device parser
function parseDeviceInfo(ua) {
    if (!ua) return 'N/A';

    // --- More specific models for better readability (Most Reliable Method) ---
    // Apple
    if (/iPhone16,2/i.test(ua)) return 'iPhone 15 Pro Max';
    if (/iPhone16,1/i.test(ua)) return 'iPhone 15 Pro';
    if (/iPhone15,3/i.test(ua)) return 'iPhone 15 Pro Max';
    if (/iPhone15,2/i.test(ua)) return 'iPhone 15';
    if (/iPhone14,8/i.test(ua)) return 'iPhone 14 Plus';
    if (/iPhone14,7/i.test(ua)) return 'iPhone 14';
    if (/iPhone14,3/i.test(ua)) return 'iPhone 13 Pro Max';
    if (/iPhone14,2/i.test(ua)) return 'iPhone 13 Pro';
    if (/iPhone13,4/i.test(ua)) return 'iPhone 12 Pro Max';
    if (/iPhone13,3/i.test(ua)) return 'iPhone 12 Pro';
    
    // Samsung
    if (/SM-S928/i.test(ua)) return 'Samsung Galaxy S24 Ultra';
    if (/SM-S918/i.test(ua)) return 'Samsung Galaxy S23 Ultra';
    if (/SM-S908/i.test(ua)) return 'Samsung Galaxy S22 Ultra';
    if (/SM-G998/i.test(ua)) return 'Samsung Galaxy S21 Ultra';
    if (/SM-F946/i.test(ua)) return 'Samsung Galaxy Z Fold5';
    if (/SM-F731/i.test(ua)) return 'Samsung Galaxy Z Flip5';
    if (/SM-A546/i.test(ua)) return 'Samsung Galaxy A54';
    if (/SM-A146/i.test(ua)) return 'Samsung Galaxy A14';


    // Google
    if (/Pixel 8 Pro/i.test(ua)) return 'Google Pixel 8 Pro';
    if (/Pixel 8/i.test(ua)) return 'Google Pixel 8';
    if (/Pixel 7 Pro/i.test(ua)) return 'Google Pixel 7 Pro';
    if (/Pixel 7/i.test(ua)) return 'Google Pixel 7';
    if (/Pixel Fold/i.test(ua)) return 'Google Pixel Fold';
    
    // Xiaomi / Redmi / Poco
    if (/2201116TG/i.test(ua)) return 'Xiaomi 12 Pro';
    if (/23021RAA2Y/i.test(ua)) return 'Xiaomi 13';
    if (/M2102J20SG/i.test(ua)) return 'Poco F3';

    // OnePlus
    if (/CPH2417/i.test(ua)) return 'OnePlus 11';
    if (/NE2213/i.test(ua)) return 'OnePlus 10 Pro';


    // --- Generic Parsing ---
    // Try to extract model from Android user agent
    if (/android/i.test(ua)) {
        const modelMatch = ua.match(/\(([^)]+)\)/); // Get everything in parentheses
        if (modelMatch && modelMatch[1]) {
            const parts = modelMatch[1].split(';').map(p => p.trim());
            // The model identifier is often the last part.
            let model = parts[parts.length - 1]; 
            
            if (model) {
                // If the last part contains 'Build/', extract the model name before it.
                const buildIndex = model.toLowerCase().indexOf(' build/');
                if (buildIndex !== -1) {
                    model = model.substring(0, buildIndex);
                }
                
                // Check if the model is not something generic like 'Linux' or the OS version
                if (model.toLowerCase() !== 'linux' && !model.toLowerCase().startsWith('android')) {
                    return model.trim(); // This will return the model name or code
                }
            }
        }
        return 'Android Device'; // Fallback if no specific model found
    }
    
    // Generic Fallbacks for other OS
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    if (/macintosh/i.test(ua)) return 'Mac';
    if (/windows nt/i.test(ua)) return 'Windows PC';
    if (/linux/i.test(ua) && !/android/i.test(ua)) return 'Linux PC';

    return 'Unknown Device';
}


async function handleFeedbackSubmit(event) {
    event.preventDefault();
    const deliveryId = document.getElementById('feedback-delivery-id').value;
    const rating = document.querySelector('input[name="rating"]:checked');
    const comment = document.getElementById('feedback-comment').value.trim();

    if (!rating) {
        showNotification("Please select a star rating.", true);
        return;
    }
    
    showLoader();
    try {
        const deliveryRef = doc(db, 'deliveries', deliveryId);
        const deliverySnap = await getDoc(deliveryRef);

        if(!deliverySnap.exists()) throw new Error("Original delivery not found.");
        const deliveryData = deliverySnap.data();

        // Get device info and IP
        const deviceInfo = getDeviceDetails();
        const ipAddress = await getIPAddress();

        const feedbackData = {
            deliveryId: deliveryId,
            driverUid: deliveryData.driverUid,
            driverName: deliveryData.driverName,
            rating: parseInt(rating.value, 10),
            comment: comment,
            createdAt: serverTimestamp(),
            deviceInfo: deviceInfo, // Raw user agent
            ipAddress: ipAddress
        };

        await setDoc(doc(db, 'feedback', deliveryId), feedbackData);
        await updateDoc(deliveryRef, { feedbackStatus: 'rated' });

        document.getElementById('feedback-form-container').style.display = 'none';
        document.getElementById('feedback-thanks-message').style.display = 'block';

    } catch (error) {
        console.error("Error submitting feedback:", error);
        showNotification("Could not submit feedback. Please try again.", true);
    } finally {
        hideLoader();
    }
}

async function showDriverFeedback(driverId) {
    const driver = allUsersCache.find(u => u.id === driverId);
    if (!driver) return;
    
    const driverFeedback = feedbackCache.filter(f => f.driverUid === driverId)
        .sort((a,b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    const modalTitle = document.getElementById('feedback-modal-title');
    const list = document.getElementById('feedback-list');
    modalTitle.textContent = `Feedback for ${driver.displayName}`;
    
    if (driverFeedback.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-center p-4">This driver has not received any feedback yet.</p>';
    } else {
        list.innerHTML = driverFeedback.map(feedback => {
            const delivery = deliveriesCache.find(d => d.id === feedback.deliveryId);
            const jobFileNo = delivery?.jobFileData?.jfn || 'N/A';
            
            let adminInfo = '';
            if (currentUser.role === 'admin') {
                // USE THE NEW PARSER FUNCTION HERE
                const deviceName = parseDeviceInfo(feedback.deviceInfo);
                adminInfo = `
                <div class="mt-2 pt-2 border-t text-xs text-gray-500 space-y-1">
                    <p><strong>Device:</strong> ${deviceName}</p>
                    <p><strong>IP Address:</strong> ${feedback.ipAddress || 'N/A'}</p>
                </div>
                `;
            }

            return `
            <div class="p-3 border rounded-lg bg-gray-50">
                <div class="flex justify-between items-center">
                    <div>
                       <p class="text-xl text-yellow-500">${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)}</p>
                       <p class="text-xs text-gray-500 mt-1">For Job: <strong>${jobFileNo}</strong></p>
                    </div>
                    <p class="text-xs text-gray-400">${feedback.createdAt?.toDate().toLocaleString()}</p>
                </div>
                <p class="mt-2 text-gray-700">${feedback.comment || '<i>No comment left.</i>'}</p>
                ${adminInfo}
            </div>
        `}).join('');
    }
    
    openModal('view-feedback-modal', true);
}

async function showMyFeedback() {
    showLoader();
    try {
        const q = query(collection(db, "feedback"), where("driverUid", "==", currentUser.uid));
        const feedbackSnapshot = await getDocs(q);
        const myFeedback = feedbackSnapshot.docs.map(doc => doc.data())
            .sort((a,b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

        const modalTitle = document.getElementById('feedback-modal-title');
        const list = document.getElementById('feedback-list');
        modalTitle.textContent = `My Feedback & Ratings`;
        
        if (myFeedback.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-center p-4">You have not received any feedback yet.</p>';
        } else {
            list.innerHTML = myFeedback.map(feedback => {
                const delivery = deliveriesCache.find(d => d.id === feedback.deliveryId);
                const jobFileNo = delivery?.jobFileData?.jfn || 'N/A';
                return `
                <div class="p-3 border rounded-lg bg-gray-50">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="text-xl text-yellow-500">${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)}</p>
                            <p class="text-xs text-gray-500 mt-1">For Job: <strong>${jobFileNo}</strong></p>
                        </div>
                        <p class="text-xs text-gray-400">${feedback.createdAt?.toDate().toLocaleString()}</p>
                    </div>
                    <p class="mt-2 text-gray-700">${feedback.comment || '<i>No comment left.</i>'}</p>
                </div>
            `}).join('');
        }
        openModal('view-feedback-modal');

    } catch(error) {
        console.error("Error fetching driver feedback:", error);
        showNotification("Could not load your feedback.", true);
    } finally {
        hideLoader();
    }
}

async function shareReceipt() {
    const isCopy = document.getElementById('generate-as-copy')?.checked || false;
    const jobData = activeDeliveryForReceipt.jobFileData;
    const publicUrl = `${window.location.origin}${window.location.pathname}?podId=${activeDeliveryForReceipt.deliveryId}`;

    try {
        const canvas = await getReceiptCanvas(isCopy);
        canvas.toBlob(async (blob) => {
            const file = new File([blob], `Receipt-${jobData.jfn}${isCopy ? '-COPY' : ''}.png`, { type: 'image/png' });
            const shareData = {
                title: `Delivery Receipt for ${jobData.jfn}`,
                text: `View the delivery receipt for job file ${jobData.jfn}.`,
                url: publicUrl,
                files: [file]
            };

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share(shareData);
            } else if (navigator.canShare && navigator.canShare({url: publicUrl})) {
                await navigator.share({
                    title: `Delivery Receipt for ${jobData.jfn}`,
                    text: `View the delivery receipt for job file ${jobData.jfn}.`,
                    url: publicUrl
                });
            } else {
                showNotification("Sharing is not supported on this browser.", true);
            }
        }, 'image/png');

    } catch (error) {
        console.error('Error sharing receipt:', error);
        showNotification('Could not share receipt.', true);
    }
}

function copyReceiptLink() {
    const publicUrl = `${window.location.origin}${window.location.pathname}?podId=${activeDeliveryForReceipt.deliveryId}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
        showNotification("Link copied to clipboard!");
    }, () => {
        showNotification("Could not copy link.", true);
    });
}

async function displayDriverPerformanceSummary(driverId, tasks) {
    const summaryEl = document.getElementById('driver-performance-summary');
    if (!summaryEl) return;

    try {
        const feedbackQuery = query(collection(db, "feedback"), where("driverUid", "==", driverId));
        const feedbackSnapshot = await getDocs(feedbackQuery);
        const driverFeedback = feedbackSnapshot.docs.map(doc => doc.data());

        const completed = tasks.filter(d => d.status === 'Delivered').length;
        const pending = tasks.length - completed;
        
        const totalRatings = driverFeedback.length;
        const averageRating = totalRatings > 0 ? (driverFeedback.reduce((sum, f) => sum + f.rating, 0) / totalRatings) : 0;
        
        const starRating = '★'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating));

        summaryEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div class="bg-yellow-100 p-4 rounded-lg" title="Average Rating: ${averageRating.toFixed(2)} (${totalRatings} ratings)">
                    <p class="text-sm text-yellow-800">My Average Rating</p>
                    <p class="text-3xl font-bold text-yellow-500 mt-1">${starRating}</p>
                </div>
                <div class="bg-green-100 p-4 rounded-lg">
                    <p class="text-sm text-green-800">Completed Deliveries</p>
                    <p class="text-3xl font-bold text-green-900">${completed}</p>
                </div>
                <div class="bg-blue-100 p-4 rounded-lg">
                    <p class="text-sm text-blue-800">Pending Deliveries</p>
                    <p class="text-3xl font-bold text-blue-900">${pending}</p>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error displaying driver performance summary:", error);
        summaryEl.innerHTML = '<p class="text-red-500 text-center">Could not load performance summary.</p>';
    }
}


// --- General Functions ---
function showLoader() { document.getElementById('loader-overlay').classList.add('visible'); }
function hideLoader() { document.getElementById('loader-overlay').classList.remove('visible'); }
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#dc2626' : '#1e293b';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

window.openModal = (id, keepParent = false) => {
    const modal = document.getElementById(id);
    if (keepParent) {
        const highestZ = Array.from(document.querySelectorAll('.overlay.visible'))
            .reduce((max, el) => Math.max(max, parseInt(window.getComputedStyle(el).zIndex || 1000)), 1000);
        modal.style.zIndex = highestZ + 10;
    }
    modal.classList.add('visible');
};
window.closeModal = (id) => document.getElementById(id).classList.remove('visible');

function handleLogout() {
    signOut(auth).catch((error) => {
        console.error("Logout failed:", error);
        showNotification("Logout failed. Please try again.", true);
    });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    initializeAppLogic();
    
    document.getElementById('auth-btn').addEventListener('click', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('driver-signup-link').addEventListener('click', (e) => { e.preventDefault(); openModal('signup-modal'); });
    document.getElementById('forgot-password-link').addEventListener('click', (e) => { e.preventDefault(); openModal('forgot-password-modal'); });
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);

    document.getElementById('job-file-search').addEventListener('input', handleJobFileSearch);
    document.getElementById('job-file-suggestions').addEventListener('click', selectJobFile);
    document.getElementById('delivery-form').addEventListener('submit', handleAssignDelivery);
    
    document.getElementById('pending-search').addEventListener('input', renderAllDeliveryViews);
    document.getElementById('completed-search').addEventListener('input', renderAllDeliveryViews);

    document.getElementById('completion-form').addEventListener('submit', handleCompleteDelivery);
    document.getElementById('clear-completion-signature-btn').addEventListener('click', () => completionSignaturePad.clear());
    document.getElementById('get-location-btn').addEventListener('click', handleGetLocation);
    
    document.getElementById('pdf-receipt-btn').addEventListener('click', downloadReceiptAsPDF);
    document.getElementById('print-receipt-btn').addEventListener('click', printReceipt);
    document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
    document.getElementById('driver-dashboard-btn').addEventListener('click', openDriverPerformanceDashboard);
    document.getElementById('feedback-form').addEventListener('submit', handleFeedbackSubmit);
    document.getElementById('my-feedback-btn').addEventListener('click', showMyFeedback);
    document.getElementById('share-btn').addEventListener('click', shareReceipt);
    document.getElementById('copy-link-btn').addEventListener('click', copyReceiptLink);
     document.getElementById('generate-as-copy').addEventListener('change', (e) => {
        const isCopy = e.target.checked;
        const receiptHTML = generateReceipt(isCopy);
        document.getElementById('receipt-content').innerHTML = receiptHTML;
        generateQRCodes();
    });


    const confirmCancelBtn = document.getElementById('confirm-cancel');
    confirmCancelBtn.addEventListener('click', () => {
        const okButton = document.getElementById('confirm-ok');
        const newOkButton = okButton.cloneNode(true);
        okButton.parentNode.replaceChild(newOkButton, okButton);
        closeModal('confirm-modal');
    });

});

// Make functions globally accessible for inline onclick handlers
window.saveUserChanges = saveUserChanges;
window.openReceiptModal = openReceiptModal;
window.confirmUserDelete = confirmUserDelete;
window.confirmPodCancel = confirmPodCancel;
window.showDriverDeliveries = showDriverDeliveries;
window.showDriverFeedback = showDriverFeedback;

    