
import { initializeAppLogic, handleLogout } from './auth.js';
import { 
    openModal, 
    closeModal,
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
    handlePhotoUpload,
    handleSkipFeedback,
    completionSignaturePad,
    handleStartDelivery,
    openCompletionModal,
    closeMapModal
} from './ui.js';
import { handleAssignDelivery, handleJobFileSearch, selectJobFile, renderAllDeliveryViews } from './delivery.js';

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    initializeAppLogic();
    
    // Auth related listeners are in auth.js
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Delivery assignment
    const jobFileSearch = document.getElementById('job-file-search');
    const jobFileSuggestions = document.getElementById('job-file-suggestions');
    const deliveryForm = document.getElementById('delivery-form');
    if(jobFileSearch) jobFileSearch.addEventListener('input', handleJobFileSearch);
    if(jobFileSuggestions) jobFileSuggestions.addEventListener('click', selectJobFile);
    if(deliveryForm) deliveryForm.addEventListener('submit', handleAssignDelivery);
    
    // Delivery list searching
    const pendingSearch = document.getElementById('pending-search');
    const completedSearch = document.getElementById('completed-search');
    if(pendingSearch) pendingSearch.addEventListener('input', renderAllDeliveryViews);
    if(completedSearch) completedSearch.addEventListener('input', renderAllDeliveryViews);

    // Delivery completion
    const completionForm = document.getElementById('completion-form');
    const clearSignatureBtn = document.getElementById('clear-completion-signature-btn');
    const getLocationBtn = document.getElementById('get-location-btn');
    const takePhotoBtn = document.getElementById('take-photo-btn');
    const photoUploadInput = document.getElementById('photo-upload-input');
    const skipFeedbackBtn = document.getElementById('skip-feedback-btn');

    if(completionForm) completionForm.addEventListener('submit', handleCompleteDelivery);
    if(clearSignatureBtn) clearSignatureBtn.addEventListener('click', () => completionSignaturePad.clear());
    if(getLocationBtn) getLocationBtn.addEventListener('click', handleGetLocation);
    if(takePhotoBtn) takePhotoBtn.addEventListener('click', () => photoUploadInput.click());
    if(photoUploadInput) photoUploadInput.addEventListener('change', handlePhotoUpload);
    if(skipFeedbackBtn) skipFeedbackBtn.addEventListener('click', handleSkipFeedback);
    
    // Receipt actions
    const pdfReceiptBtn = document.getElementById('pdf-receipt-btn');
    const printReceiptBtn = document.getElementById('print-receipt-btn');
    const shareBtn = document.getElementById('share-btn');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const generateAsCopy = document.getElementById('generate-as-copy');

    if(pdfReceiptBtn) pdfReceiptBtn.addEventListener('click', downloadReceiptAsPDF);
    if(printReceiptBtn) printReceiptBtn.addEventListener('click', printReceipt);
    if(shareBtn) shareBtn.addEventListener('click', shareReceipt);
    if(copyLinkBtn) copyLinkBtn.addEventListener('click', copyReceiptLink);
    if(generateAsCopy) generateAsCopy.addEventListener('change', (e) => {
        const isCopy = e.target.checked;
        const receiptHTML = generateReceipt(isCopy);
        document.getElementById('receipt-content').innerHTML = receiptHTML;
        generateQRCodes();
    });

    // Admin/Staff actions
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const driverDashboardBtn = document.getElementById('driver-dashboard-btn');
    if(adminPanelBtn) adminPanelBtn.addEventListener('click', openAdminPanel);
    if(driverDashboardBtn) driverDashboardBtn.addEventListener('click', openDriverPerformanceDashboard);
    
    // Driver actions
    const myFeedbackBtn = document.getElementById('my-feedback-btn');
    if(myFeedbackBtn) myFeedbackBtn.addEventListener('click', showMyFeedback);

    // General Modal close actions
    const confirmCancel = document.getElementById('confirm-cancel');
    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => {
            const okButton = document.getElementById('confirm-ok');
            // A better way to remove event listeners is to clone the node
            const newOkButton = okButton.cloneNode(true);
            okButton.parentNode.replaceChild(newOkButton, okButton);
            closeModal('confirm-modal');
        });
    }

    const simpleCloseButtons = [
        'admin-panel-modal', 
        'delivery-completion-modal', 
        'receipt-modal', 
        'signup-modal', 
        'forgot-password-modal',
        'driver-performance-modal',
        'user-jobs-modal',
        'view-feedback-modal',
        'map-modal'
    ];
    simpleCloseButtons.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            const closeBtn = modal.querySelector('button[onclick^="closeModal"]');
            if (closeBtn) {
                closeBtn.removeAttribute('onclick');
                if(modalId === 'map-modal') {
                     closeBtn.addEventListener('click', () => closeMapModal());
                } else {
                     closeBtn.addEventListener('click', () => closeModal(modalId));
                }
            }
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
window.openCompletionModal = openCompletionModal;
window.handleStartDelivery = handleStartDelivery;
window.closeMapModal = closeMapModal;

    