import { initializeAppLogic, handleLogout } from './auth.js';
import { 
    openModal, 
    closeModal,
    renderAllDeliveryViews,
    openReceiptModal,
    downloadReceiptAsPDF,
    printReceipt,
    openAdminPanel,
    saveUserChanges,
    openDriverPerformanceDashboard,
    showDriverDeliveries,
    showDriverFeedback,
    showMyFeedback,
    shareReceipt,
    copyReceiptLink,
    generateReceipt,
    generateQRCodes,
    handleCompleteDelivery,
    handleGetLocation,
    completionSignaturePad
} from './ui.js';
import { handleAssignDelivery, handleJobFileSearch, selectJobFile } from './delivery.js';

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
    
    // Auth related listeners are in auth.js
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Delivery assignment
    document.getElementById('job-file-search').addEventListener('input', handleJobFileSearch);
    document.getElementById('job-file-suggestions').addEventListener('click', selectJobFile);
    document.getElementById('delivery-form').addEventListener('submit', handleAssignDelivery);
    
    // Delivery list searching
    document.getElementById('pending-search').addEventListener('input', renderAllDeliveryViews);
    document.getElementById('completed-search').addEventListener('input', renderAllDeliveryViews);

    // Delivery completion
    document.getElementById('completion-form').addEventListener('submit', handleCompleteDelivery);
    document.getElementById('clear-completion-signature-btn').addEventListener('click', () => completionSignaturePad.clear());
    document.getElementById('get-location-btn').addEventListener('click', handleGetLocation);
    
    // Receipt actions
    document.getElementById('pdf-receipt-btn').addEventListener('click', downloadReceiptAsPDF);
    document.getElementById('print-receipt-btn').addEventListener('click', printReceipt);
    document.getElementById('share-btn').addEventListener('click', shareReceipt);
    document.getElementById('copy-link-btn').addEventListener('click', copyReceiptLink);
    document.getElementById('generate-as-copy').addEventListener('change', (e) => {
        const isCopy = e.target.checked;
        const receiptHTML = generateReceipt(isCopy);
        document.getElementById('receipt-content').innerHTML = receiptHTML;
        generateQRCodes();
    });

    // Admin/Staff actions
    document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
    document.getElementById('driver-dashboard-btn').addEventListener('click', openDriverPerformanceDashboard);
    
    // Driver actions
    document.getElementById('my-feedback-btn').addEventListener('click', showMyFeedback);

    // General Modal close actions
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        const okButton = document.getElementById('confirm-ok');
        // A better way to remove event listeners is to clone the node
        const newOkButton = okButton.cloneNode(true);
        okButton.parentNode.replaceChild(newOkButton, okButton);
        closeModal('confirm-modal');
    });

    const simpleCloseButtons = [
        'admin-panel-modal', 
        'delivery-completion-modal', 
        'receipt-modal', 
        'signup-modal', 
        'forgot-password-modal',
        'driver-performance-modal',
        'user-jobs-modal',
        'view-feedback-modal'
    ];
    simpleCloseButtons.forEach(modalId => {
        const modal = document.getElementById(modalId);
        const closeBtn = modal.querySelector('button[onclick^="closeModal"]');
        if (closeBtn) {
            closeBtn.removeAttribute('onclick');
            closeBtn.addEventListener('click', () => closeModal(modalId));
        }
    });

});

// Make functions globally accessible for inline onclick handlers from the old code if any are left
// These are mainly for buttons inside dynamically generated HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.saveUserChanges = saveUserChanges;
window.openReceiptModal = openReceiptModal;
window.showDriverDeliveries = showDriverDeliveries;
window.showDriverFeedback = showDriverFeedback;
