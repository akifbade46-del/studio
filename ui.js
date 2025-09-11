import { getFirestore, doc, getDoc, getDocs, collection, query, where, writeBatch, deleteDoc, deleteField, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from './auth.js';
import { 
    currentUser, 
    jobFilesCache, 
    allUsersCache, 
    deliveriesCache,
    feedbackCache,
    setDeliveriesCache,
    setFeedbackCache,
    setAllUsersCache,
    activeDeliveryForReceipt,
    setActiveDeliveryForReceipt,
    activeDeliveryForCompletion,
    setActiveDeliveryForCompletion,
    currentGeolocation,
    setCurrentGeolocation
} from './state.js';
import { loadAdminData, loadDriverTasks } from './delivery.js';

// --- Global variables for UI state ---
export let completionSignaturePad;
let driverChartInstance = null;

// --- General UI Functions ---
export function showLoader() { document.getElementById('loader-overlay').classList.add('visible'); }
export function hideLoader() { document.getElementById('loader-overlay').classList.remove('visible'); }

export function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#dc2626' : '#1e293b';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// --- Modal Management ---
export function openModal(id, keepParent = false) {
    const modal = document.getElementById(id);
    if (keepParent) {
        const highestZ = Array.from(document.querySelectorAll('.overlay.visible'))
            .reduce((max, el) => Math.max(max, parseInt(window.getComputedStyle(el).zIndex || 1000)), 1000);
        modal.style.zIndex = highestZ + 10;
    }
    modal.classList.add('visible');
}

export function closeModal(id) {
    document.getElementById(id).classList.remove('visible');
}

// --- View Management ---
export function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('public-pod-view').style.display = 'none';
    document.getElementById('public-feedback-view').style.display = 'none';
}

export function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('public-pod-view').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    document.getElementById('user-display-name').textContent = currentUser.displayName;
    document.getElementById('user-role').textContent = currentUser.role;

    document.getElementById('admin-staff-view').style.display = 'none';
    document.getElementById('driver-view').style.display = 'none';
    document.getElementById('admin-panel-btn').classList.add('hidden');
    document.getElementById('driver-dashboard-btn').classList.add('hidden');
    
    if (currentUser.role === 'driver') {
        document.getElementById('driver-view').style.display = 'block';
        document.getElementById('header-subtitle').textContent = "View and complete your assigned deliveries.";
        loadDriverTasks(); // <-- ONLY call driver-specific data loader
    } else { // For 'admin' and 'staff'
        document.getElementById('admin-staff-view').style.display = 'block';
        document.getElementById('header-subtitle').textContent = "Assign, track, and manage deliveries.";
        if (currentUser.role === 'admin' || currentUser.role === 'staff') {
            document.getElementById('driver-dashboard-btn').classList.remove('hidden');
        }
        if (currentUser.role === 'admin') {
            document.getElementById('admin-panel-btn').classList.remove('hidden');
        }
        loadAdminData(); // <-- ONLY call admin-specific data loader
    } 
}

// --- Delivery List Rendering ---
export function renderAllDeliveryViews() {
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

export function createDeliveryCard(delivery) {
    const card = document.createElement('div');
    card.className = 'border p-3 rounded-lg bg-gray-50 delivery-card';
    const jobData = delivery.jobFileData || {};
    let actionButtons = '';

    if (delivery.status === 'Delivered') {
        if (currentUser.role === 'admin') {
            actionButtons += `<button data-action="cancel-pod" data-id="${delivery.id}" data-job="${jobData.jfn}" class="btn btn-danger btn-xs text-xs">Cancel POD</button>`;
        }
        actionButtons += `${delivery.podId ? `<button data-action="view-receipt" data-id="${delivery.id}" class="btn btn-secondary btn-xs text-xs">View Receipt</button>` : ''}`;
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

    card.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'view-receipt') {
            openReceiptModal(id);
        } else if (action === 'cancel-pod') {
            const jobNo = target.dataset.job;
            confirmPodCancel(id, jobNo);
        }
    });

    return card;
}


// --- Driver UI ---
export function createDriverTaskCard(task) {
    const taskCard = document.createElement('div');
    taskCard.className = `border p-4 rounded-lg shadow-sm delivery-card ${task.status === 'Pending' ? 'bg-white' : 'bg-gray-200'}`;
    const jobData = task.jobFileData || {};

    let actionButton = '';
    if (task.status === 'Pending') {
        actionButton = `<button class="btn btn-primary text-sm">Complete Delivery</button>`;
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


export async function displayDriverPerformanceSummary(driverId, tasks) {
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


// --- Delivery Completion ---
function openCompletionModal(delivery) {
    setActiveDeliveryForCompletion(delivery); 
    document.getElementById('delivery-id-input').value = delivery.id;
    document.getElementById('modal-job-no').textContent = delivery.jobFileData.jfn;
    document.getElementById('modal-location').textContent = delivery.deliveryLocation;
    document.getElementById('completion-form').reset();

    document.getElementById('completion-form-wrapper').style.display = 'block';
    document.getElementById('post-delivery-qr-wrapper').style.display = 'none';
    
    const canvas = document.getElementById('completion-signature-pad');
    
    // Defer canvas resizing and signature pad initialization
    setTimeout(() => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        const context = canvas.getContext("2d");
        context.scale(ratio, ratio);

        if (completionSignaturePad) {
            completionSignaturePad.clear();
        } else {
            completionSignaturePad = new SignaturePad(canvas, {
                backgroundColor: 'rgb(255, 255, 255)'
            });
        }
        completionSignaturePad.clear(); // Clear any previous content
    }, 50);

    document.getElementById('location-status').textContent = '';
    setCurrentGeolocation(null);
    openModal('delivery-completion-modal');
}


export async function handleCompleteDelivery(e) {
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
        
        if (!activeDeliveryForCompletion) {
            throw new Error("Could not find the delivery data to process.");
        }

        const podData = {
            deliveryId: deliveryId,
            jobFileId: activeDeliveryForCompletion.jobFileId,
            jobFileData: activeDeliveryForCompletion.jobFileData,
            deliveryLocation: activeDeliveryForCompletion.deliveryLocation,
            receiverName: receiverName,
            receiverMobile: receiverMobile,
            signatureDataUrl: signatureDataUrl,
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

export function handleGetLocation() {
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
                
                setCurrentGeolocation({
                    coords: coords,
                    displayName: displayName
                });
                statusEl.textContent = `Location: ${displayName}`;
                statusEl.style.color = '#16a34a';

            } catch (error) {
                console.error('Reverse geocoding error:', error);
                statusEl.textContent = 'Could not fetch address name, but coordinates saved.';
                setCurrentGeolocation({ coords: coords, displayName: 'N/A' });
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
export async function openReceiptModal(deliveryId) {
    showLoader();
    try {
        const podDocRef = doc(db, 'pods', deliveryId);
        const podDoc = await getDoc(podDocRef);
        
        if (podDoc.exists()) {
            setActiveDeliveryForReceipt(podDoc.data());
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

export function generateQRCodes(container = document) {
     const data = activeDeliveryForReceipt;
     if (!data) return;
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

export function generateReceipt(isCopy = false) {
    const data = activeDeliveryForReceipt;
    if (!data) return '<p>No receipt data loaded.</p>';
    const jobData = data.jobFileData;
    const deliveryDate = (data.completedAt?.toDate() || new Date()).toLocaleString();

    let locationInfo = data.geolocationName || 'Not Captured.';
    if (data.geolocation) {
        locationInfo += ` <a href="https://www.google.com/maps?q=${data.geolocation.lat},${data.geolocation.lng}" target="_blank" class="text-blue-600 hover:underline text-xs ml-2">[View on Map]</a>`;
    }
    
    const copyWatermark = isCopy ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 8rem; color: rgba(255, 0, 0, 0.15); font-weight: bold; z-index: 1000; pointer-events: none;">COPY</div>` : '';
    const iataLogo = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAwIDMwMCI+PHBhdGggZD0iTTc0LjggMjY2LjR2LTkyLjNINjAuMXY5Mi4zSDIzdjI4LjdoMTA1di0yOC43SDc0Ljh6bTIwOC42LTI4LjdsMTcuMy05Mi4zaDE4LjlsLTE3LjMgOTIuM0gyODMuNHptNDMuMSAwTDMxMS4xIDc0aDQ0bC0xNS40IDk5LjgtMTUuMyA5Mi42aC00My4xbDE1LjQtOTkuNyAxNS4yLTkyLjdoNDQuMmwzMi44IDE5Mi40aC00My41bC0xNS4yLTkyLjZMMzU1IDc0aC00My42bDE1LjQgOTkuOCAxNS4yIDkyLjZoNDMuMXptMTkxLjYgMjguN2g0My44VjI2Nkg1MTguMnYtOTIuM2gtNDMuOHY5Mi4zaC0yMi41djI4LjdoODYuOHYtMjguN3ptOTYuNSAwaDQzLjdWMTAyLjRoLTM4LjlMNjA0IDc0aDk0djIyMC43aDQzLjh2MjguN0g2MDJWMzAwaC0xLjR6bTE5NS4yLTI4LjdsMTcuMy05Mi4zaDE4LjlsLTE3LjMgOTIuM0g4MTUuM3ptNDMuMSAwTjg0MyA3NGg0NC4xbC0xNS40IDk5LjgtMTUuMyA5Mi42aC00My4xbDE1LjQtOTkuNyAxNS4yLTkyLjdoNDQuMmwzMi44IDE5Mi40aC00My41bC0xNS4yLTkyLjZMOTAwLjUgNzRoLTQzLjZsMTUuNCA5OS44IDE1LjIgOTIuNmg0My4xek0xMDY5LjQgNzRoLTM1LjdsLTU0LjUgMzAwaDQ1LjNsMTEuNC02My42aDUzLjVsMTEuMyA2My42aDQ1LjRMMTA2OS40IDc0em0tNi40IDE4NC4xbC0xOC44LTExMC4xLTE4LjggMTEwLjFoMzcuNnoiLz48L3N2Zz4=";
    const wcaLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACACAMAAABrZuVzAAAAYFBMVEX///8AQ4sAQIsAP4oAO4kAN4gANIcAOYgAOIkAOYoAN4sAOIjp7fUAOIlso9EAM4a/x94gS5QAT5sAUJgAQYpUkcYAQ4zp7vMAYqEAL4AAKnsALoEAMYIAJ3UAKn4AKX/q7/cAUIyTAAADcklEQVR4nO3b63aqOBSG4fAQQkBtqU3tde//ikdbS1sLtTSS5+z9fn+x504yE8jDDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYF/2+0vV/Vn2+z88G/291v+2F/V21d01q/09A6t/Qf0h1l/a/n7t9X+wn8pP1W2v/c/9mY5Xf2h/a/1r/Vv+1/oV+/sZ+ysdVf+k/lr/tL61/pH+rf4b/Wv9e/3b/jf6z5003V/sB7DPqg81v1V/qf/aP1r/TP+2/5b+y/qP3v6d/rf6H/Uf6596+3f65/pf3t/Z/13/tfenbX9v/2t/W//S3sB+7M820n/Wz/S39lf2h/ZH9lv21/b39v/29/bP9s862j/b79u/21/ar9jf2d/bH9i/2b/bb9u/6l/Zf1f+y/q/9l/Uf6T/Rf1b+i/rH9B/s/1H+i/pH+i/vP6v/Tf13+k/tv6n/R+bY/v/LMP2/8M0/b/1L+yv7J+w/8k+JP/V/kn7D/e/uv+L/f/tP9l/6f9X/Tf6X/6v+d/n/p/6n/d/zv/T/yP/b/xP+h/r/8h/6v+g/4n+g/23+v/3/7X/f/1/8B/d/w7+o/xP81/lv4r+K/iv6b+a/ov5b+u/tv47+e/mv5b+S/kv7b+K/hv4b+G/tv4b+C/gv6L+C/iv57+a/mv5r+a/lv6L+W/rv7b+u/tv6T+k/pP7b+k/pP6L+i/ov6L+i/rv6r+6/qv7j+o/uP7T+0/pP7T+0/ov6L+i/ov5r+a/mv5r+a/mv5b+W/lv67+W/rv7T+w/sP7b+w/pP6T+k/tP6L+k/ov6r+q/uv6r+6/tP7T+2/rP+A/uP4D+w/vP6D+8/tP7L+y/tv6b+m/tv6b+o/sP7D+o/ov6T+s/rP4z+M/rP6T+w/sP7T+s/rP6z+s/rP7z+8/tP6L+i/tv6r+u/pv6b+m/tv6b+m/tv6T+o/rP7D+o/rP6z+o/vP7L+i/sv67+q/ru6r+u/uv6j+o/rP4j+I/vP6j+q/uP4j+0/pP6T+0/pP7T+i/qv6L+q/kv5r+a/mv5r+a/kv6b+u/tu6b+u/tu47+e/tv47+O/jv5r+K/tv4b+G/hv4b+e/gv4L+K/gv4b+e/lv5r+a/mv5b+a/mv5r+O/jv67+e/rv7T+g/tP6j+o/qP6j+g/pP6j+k/qP7T+g/tP6T+8/qP7j+q/uP6z+s/vP6z+u/vP67+w/sP7T+w/sP7T+y/sv6j+i/qP6L+m/qP6r+m/rP4D+w/oP6L+y/sP7L+o/pP6T+i/tP6L+0/pP6T+2/pP7b+2/rP67+u/uP4j+4/pP7j+s/pP7z+4/uP6j+w/sP7T+g/pP6z+y/uP6j+8/qP7z+i/rP6z+g/qP6z+o/qP6z+k/rP6T+8/qP7T+k/qP6T+k/qP6T+k/qP6L+wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgH/9A7aQ4B/4cQ/qAAAAAElFTkSuQmCC";
    const iamLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAACACAMAAAB49WnWAAAAQlBMVEX////AADcAAADa2tsAADOysrL6+voAAAb29vYAAAnMzMzp6ekAAAjh4eEAABBMS0toamp+fn4AAATExMSlpaWbm5s2NjZLS0s6ODgI5M0QAAAD0klEQVR4nO2byXaCMAxFIVsJsbrD/V/hAvJpMu6Nplk5/29EDgp6cFAggAAAAAAAAAAAAAAAAAAAAAAAIzY+np29PX5qQ+kPkD6/uG58S+pD3A+hPjH3R8W/tD6Yen3n/5+gr8l/b30x9cfsH/V35n6A+ovU39p/bX1D63/YP/n/S+rv7z+o/tvqn9y/3f+B/kf/L/r/4T/Jf8h98f8P/Nf83/V/zn/Q/4L/z/V/0f/F/1/+b/j/1r/zP+h/wP/R/y//x+3f7b/1/6v/h/6v+P/kP+x/4P/v/o/4f+c/1v+D/0/7X/w/1n/uP5b/g/97/A/1P/d/yn/f/v/2v/j/h/7f+z/iP/X/wP/9/1f8v/A/7v/T//w8//+v5X/P/u/8H/e/+H/d/wv/F/wv+7/X/3//x/7f+D/j/9r/Gf/P/j/+r/6f8//T/t/+D/h/9v/Bf4r/f/2/9v/S/+f+B/8P+v/r/9//T/v/5X/d/yv+l/3f9//Vf8H/N/xf+T/qf+n/rf9//I/8/+X/4P+T/h/6v/N/7v/B/2f9L/2/8p/2/+T/6v/J/wP/F/wv/7/B/5v/5/5v/x/6v+l/5v/1/zP/T/rf/z/p/4v/b/3/+7/t/+f+D/6v9b/w/+D/3v+D/3v8T/t/7f9T/t/7v/r/yP/h/yP/7/8H/h/+H/5f8X/r/5X/v/2/8v/P/w//r/j/8//Gf8//lf+f+r/2/+n/f/zP/H/0P+H/9/+r/6/9P/e/+H/D/0P/B/3P/J/0v+3/l/6v/V/0f+z/m/63/b/yP+n/0f9//X/9v+3/r/8H/H/7f/P/wv+T/9f8X/H/4v+f/n/6X/h/7P/T/xv+X/w/+b/gP+p/w/9X/N/5v+x/yP/p/z/9D/g/57/O/7P+j/sf+D/g/53/E/5/+T/pf9n/W/6v+B/8f+d/yv+7/2f8f/e/6/+P/x//F//P+v/of+n/h/5P+f/kf+X/pf8n/S/5v+v/of9n/Q/9P/a/7P+t/w/8v/U/5P+l/xf9P/I/6X/B/4v/R/y//H/if9v/Q/4P+T/sf/D/9/+t/3f+D/lf93/D/9/+d/3f8v/W/9/+n/v/43/e/yv/L/8f8v/d/0f/b/sf/7/l/+n/x/6v/L/zP/d/3P/H/s/73/n/y//n/z/8n/Q/93/b/w//n/9/7/9D/4f+j/z/8z/f/7v/D/wf+D/qf/z/j/6n/d/y/+b/2/+T/if+H/k/4H/m/5H/i/+v/b/+f+3/l/4X/9/wf+j/of93/N/8P/f/wf87/O/8//E/7/+H/lf8n/F/wf9T/Gf9X/E/6H/F/0P+7/z/+x/z/+l/3/8j/T/yv+x/wv+z/r/8P/H/y//n/l/8v/v/4P+x/8P/p/7f9n/n/6H/e/+H/u/7v+x/8f+L/3f+D/2/+D/uf+L/g/7H/s/8v/V/7f+z/wf9z/N/8H/h/+3/n/9v/f/of+n/if9X/U/9v/s/4v/j/xv/9/zv9D/q/93/q/5n/l/2/9j/x/+T/sf9P/X/iv/h/x//B/4v+x/8/9T/c/8f/+/4n/+/4n/i/8X/Q/9v/e/6H/l/43/K/8X/y/6X/D/1P+H/3/+z/m/+r/p/+3/g/4H/p/73/1/6f+v/qf9X/QAAAAAAAAAAAAAAAAAAAAAAAOCZf9t2f3r9c8sCAAAAAElFTkSuQmCC";

    return `
        <div class="space-y-4 text-gray-800" style="position: relative;">
            ${copyWatermark}
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
        </div>
    `;
}

async function getReceiptCanvas(isCopy) {
    const receiptHTML = generateReceipt(isCopy);
    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    printContainer.style.width = '210mm';
    printContainer.style.padding = '15mm';
    printContainer.style.backgroundColor = 'white';
    printContainer.style.boxSizing = 'border-box';
    printContainer.innerHTML = receiptHTML;
    document.body.appendChild(printContainer);

    generateQRCodes(printContainer);
    
    // Use html2canvas
    const canvas = await html2canvas(printContainer, { scale: 2 });
    document.body.removeChild(printContainer);
    return canvas;
}

export async function downloadReceiptAsPDF() {
    const isCopy = document.getElementById('generate-as-copy')?.checked || false;
    showLoader();
    const { jsPDF } = window.jspdf;
    
    try {
        const canvas = await getReceiptCanvas(isCopy);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const ratio = canvas.width / canvas.height;
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

export function printReceipt() {
    const isCopy = document.getElementById('generate-as-copy')?.checked || false;
    const receiptHTML = generateReceipt(isCopy);
    const printWindow = window.open('', '', 'height=842,width=595');
    printWindow.document.write(`<html><head><title>Delivery Receipt</title><script src="https://cdn.tailwindcss.com"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><style>@media print { @page { size: A4; margin: 15mm; } } body { font-family: 'Inter', sans-serif; }</style></head><body>`);
    printWindow.document.write(receiptHTML);
    printWindow.document.write(`<script>
        window.onload = function() {
            const data = ${JSON.stringify(activeDeliveryForReceipt)};
            const publicUrl = window.location.origin + window.location.pathname + '?podId=' + data.deliveryId;
            new QRCode(document.getElementById('receipt-verification-qrcode'), { text: publicUrl, width: 80, height: 80 });
            new QRCode(document.getElementById('receipt-download-qrcode'), { text: publicUrl, width: 80, height: 80 });
            setTimeout(() => { window.print(); window.close(); }, 500);
        }
    </script></body></html>`);
    printWindow.document.close();
}


// --- Admin Panel ---
export async function openAdminPanel() {
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
                const deleteButton = canDelete ? `<button data-action="delete-user" data-uid="${user.id}" data-name="${user.displayName}" class="btn btn-danger text-xs">Delete</button>` : '';
                
                const userEl = document.createElement('div');
                userEl.className = "p-3 border-b space-y-2 md:space-y-0 md:grid md:grid-cols-4 md:gap-4 md:items-center";
                userEl.innerHTML = `
                    <div class="flex justify-between items-center md:block col-span-1">
                        <div>
                            <p class="font-medium">${user.displayName}</p>
                            <p class="text-xs text-gray-500">${user.email}</p>
                        </div>
                        <div class="md:hidden text-sm text-gray-600 capitalize p-1 bg-gray-100 rounded">${user.role}</div>
                    </div>
                    <div class="col-span-1">
                        <label class="text-xs font-semibold text-gray-500 md:hidden">Status</label>
                        <select data-uid="${user.id}" class="input-field status-select text-sm p-2">
                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="hidden md:block text-sm text-gray-600 capitalize col-span-1">${user.role}</div>
                    <div class="text-right col-span-1">
                        ${deleteButton}
                    </div>
                `;
                listEl.appendChild(userEl);
            });

            listEl.addEventListener('click', e => {
                if (e.target.dataset.action === 'delete-user') {
                    const userId = e.target.dataset.uid;
                    const userName = e.target.dataset.name;
                    confirmUserDelete(userId, userName);
                }
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

export async function saveUserChanges() {
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

function confirmUserDelete(userId, userName) {
    const modal = document.getElementById('confirm-modal');
    modal.querySelector('#confirm-title').textContent = 'Confirm User Deletion';
    modal.querySelector('#confirm-message').innerHTML = `Are you sure you want to delete the user "${userName}"? This will only remove them from the application database, not from Firebase Authentication.`;
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    okButton.addEventListener('click', () => {
        deleteUserFromFirestore(userId);
        closeModal('confirm-modal');
    }, { once: true });
}

function confirmPodCancel(deliveryId, jobFileNo) {
    const modal = document.getElementById('confirm-modal');
    modal.querySelector('#confirm-title').textContent = 'Confirm POD Cancellation';
    modal.querySelector('#confirm-message').innerHTML = `Are you sure you want to cancel the POD for job file "${jobFileNo}"? This will delete the receipt and set the delivery back to "Pending".`;
    openModal('confirm-modal', true);

    const okButton = modal.querySelector('#confirm-ok');
    okButton.addEventListener('click', () => {
        cancelPod(deliveryId);
        closeModal('confirm-modal');
    }, { once: true });
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
        openAdminPanel();
    } catch (error) {
        console.error("Error deleting user:", error);
        showNotification("Failed to delete user.", true);
    } finally {
        hideLoader();
    }
}


// --- Public Pages ---
export async function showPublicPodView(podId) {
    showLoader();
    showLogin(); // Hide all other main divs first
    
    try {
        const podDocRef = doc(db, 'pods', podId);
        const podDoc = await getDoc(podDocRef);

        if (podDoc.exists()) {
            setActiveDeliveryForReceipt(podDoc.data());
            const view = document.getElementById('public-pod-view');
            view.style.display = 'block';
            view.innerHTML = `
                <div class="container mx-auto p-4 sm:p-6 lg:p-8">
                    <div id="receipt-content-public" class="p-4 border rounded-md bg-white shadow-lg"></div>
                    <div class="text-center mt-4">
                        <button id="public-download-pdf" class="btn btn-primary">Download PDF</button>
                    </div>
                </div>`;
            
            const receiptHTML = generateReceipt(false);
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
        const canvas = await getReceiptCanvas(false);
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
export async function openDriverPerformanceDashboard() {
    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
        showNotification("Access denied.", true);
        return;
    }

    showLoader();
    try {
        const feedbackQuery = query(collection(db, 'feedback'));
        const feedbackSnapshot = await getDocs(feedbackQuery);
        setFeedbackCache(feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

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

        driverStats.sort((a, b) => b.completed - a.completed);

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

        const chartCanvas = document.getElementById('driver-chart');
        if (driverChartInstance) driverChartInstance.destroy();
        
        driverChartInstance = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: driverStats.map(d => d.displayName),
                datasets: [{
                    label: 'Completed Deliveries',
                    data: driverStats.map(d => d.completed),
                    backgroundColor: 'rgba(79, 184, 175, 0.6)',
                    borderColor: 'rgba(79, 184, 175, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                plugins: { legend: { display: false }, title: { display: true, text: 'Completed Deliveries per Driver' } }
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

export function showDriverDeliveries(driverId) {
    const driver = allUsersCache.find(u => u.id === driverId);
    if (!driver) return;
    const driverDeliveries = deliveriesCache.filter(d => d.driverUid === driverId);
    
    document.getElementById('user-jobs-modal-title').textContent = `Deliveries for ${driver.displayName}`;
    const list = document.getElementById('user-jobs-list');
    list.innerHTML = '';
    
    if (driverDeliveries.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-center p-4">This driver has no assigned deliveries.</p>';
    } else {
        driverDeliveries.forEach(delivery => list.appendChild(createDeliveryCard(delivery)));
    }
    openModal('user-jobs-modal', true); 
}

// --- Public Feedback Logic ---
export async function showPublicFeedbackView(feedbackId) {
    showLogin(); // Hide other views
    document.getElementById('public-feedback-view').style.display = 'flex';
    document.body.classList.remove('loading');
    showLoader();
    try {
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
            document.getElementById('feedback-form').addEventListener('submit', handleFeedbackSubmit, { once: true });
        } else {
            throw new Error('Delivery not found.');
        }
    } catch (error) {
        document.getElementById('feedback-form-container').innerHTML = '<p class="text-red-500 font-semibold">COULD NOT LOAD DELIVERY DETAILS.</p><p class="text-xs text-gray-500 mt-2">This may be due to a network issue or a permissions problem. Please try again later.</p>';
        console.error("Error loading for feedback:", error);
    } finally {
        hideLoader();
    }
}

function getDeviceDetails() { return navigator.userAgent || 'Unknown'; }

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

function parseDeviceInfo(ua) {
    if (!ua) return 'N/A';
    // Simplified parser for brevity
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android Device';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Macintosh/i.test(ua)) return 'Mac';
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

        const feedbackData = {
            deliveryId: deliveryId,
            driverUid: deliveryData.driverUid,
            driverName: deliveryData.driverName,
            rating: parseInt(rating.value, 10),
            comment: comment,
            createdAt: serverTimestamp(),
            deviceInfo: getDeviceDetails(),
            ipAddress: await getIPAddress()
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

export async function showDriverFeedback(driverId) {
    const driver = allUsersCache.find(u => u.id === driverId);
    if (!driver) return;
    
    const driverFeedback = feedbackCache.filter(f => f.driverUid === driverId)
        .sort((a,b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

    document.getElementById('feedback-modal-title').textContent = `Feedback for ${driver.displayName}`;
    const list = document.getElementById('feedback-list');
    
    if (driverFeedback.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-center p-4">This driver has not received any feedback yet.</p>';
    } else {
        list.innerHTML = driverFeedback.map(feedback => {
            const delivery = deliveriesCache.find(d => d.id === feedback.deliveryId);
            const jobFileNo = delivery?.jobFileData?.jfn || 'N/A';
            let adminInfo = '';
            if (currentUser.role === 'admin') {
                adminInfo = `
                <div class="mt-2 pt-2 border-t text-xs text-gray-500 space-y-1">
                    <p><strong>Device:</strong> ${parseDeviceInfo(feedback.deviceInfo)}</p>
                    <p><strong>IP Address:</strong> ${feedback.ipAddress || 'N/A'}</p>
                </div>`;
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
            </div>`;
        }).join('');
    }
    openModal('view-feedback-modal', true);
}

export async function showMyFeedback() {
    showLoader();
    try {
        const q = query(collection(db, "feedback"), where("driverUid", "==", currentUser.uid));
        const feedbackSnapshot = await getDocs(q);
        const myFeedback = feedbackSnapshot.docs.map(doc => doc.data())
            .sort((a,b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));

        document.getElementById('feedback-modal-title').textContent = `My Feedback & Ratings`;
        const list = document.getElementById('feedback-list');
        
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
                </div>`;
            }).join('');
        }
        openModal('view-feedback-modal');

    } catch(error) {
        console.error("Error fetching driver feedback:", error);
        showNotification("Could not load your feedback.", true);
    } finally {
        hideLoader();
    }
}


// --- Sharing and Copying ---
export async function shareReceipt() {
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
            } else {
                showNotification("Sharing is not supported on this browser.", true);
            }
        }, 'image/png');
    } catch (error) {
        console.error('Error sharing receipt:', error);
        showNotification('Could not share receipt.', true);
    }
}

export function copyReceiptLink() {
    const publicUrl = `${window.location.origin}${window.location.pathname}?podId=${activeDeliveryForReceipt.deliveryId}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
        showNotification("Link copied to clipboard!");
    }, () => {
        showNotification("Could not copy link.", true);
    });
}
