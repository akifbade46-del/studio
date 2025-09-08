document.addEventListener('DOMContentLoaded', function () {
    const config = {
        company: {
            name: "Q'go Cargo",
            address: "123 Cargo Lane, Kuwait City, Kuwait",
            phone: "+965 1234 5678",
            email: "contact@qgocargo.com"
        },
        currency: "KWD",
        pricing: {
            cbmRate: 15,
            insuranceRate: 0.015, // 1.5%
            markupRate: 0.10, // 10%
            vatRate: 0.05, // 5%
        },
        items: {
            "Living Room": ["Sofa 3-seater (200x90x80 cm)", "Sofa 2-seater (150x90x80 cm)", "Armchair (80x80x80 cm)", "Coffee Table (120x60x45 cm)", "TV Unit (180x40x50 cm)", "Bookshelf (80x30x200 cm)"],
            "Dining Room": ["Dining Table (180x90x75 cm)", "Dining Chair (45x45x90 cm)", "Sideboard (160x45x80 cm)"],
            "Bedroom": ["King Bed (200x200x100 cm)", "Queen Bed (160x200x100 cm)", "Nightstand (50x40x60 cm)", "Dresser (120x50x80 cm)", "Wardrobe (150x60x200 cm)"],
            "Kitchen": ["Refrigerator (90x90x180 cm)", "Washing Machine (60x60x85 cm)", "Dishwasher (60x60x85 cm)", "Microwave (50x40x30 cm)"],
            "Boxes": ["Carton S (45x45x45 cm)", "Carton M (60x60x60 cm)", "Carton L (80x80x80 cm)", "Wardrobe Box (60x50x120 cm)"]
        },
        packing: ["Wrapping", "Crating", "Bubble Wrap"],
        services: ["Handyman", "AC Removal/Installation", "Chandelier Fixing"]
    };

    let surveyData = {
        customer: {},
        items: [],
        packing: [],
        services: [],
        photos: [],
        signature: null,
        costs: {}
    };

    let currentStep = 1;
    const totalSteps = 6;
    
    // --- FIREBASE CONFIG ---
    // IMPORTANT: This object is automatically generated and should not be changed.
    const firebaseConfig = {
      "apiKey": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ5Y2E3MjZkY2E2MGUwM2MyYzE5ODliY2Y4MDU2MjIwOWZiZWI5YjUiLCJ0eXAiOiJKV1QifQ.eyJhcHBfaWQiOiIxOjM2MzQwOTI3MjQ2NTphbmRyb2lkOjYyNzM4N2U1ZTA4MWY4ZWIzYjA0MzYiLCJhdWQiOiJmaXJlYmFzZS1jbGllbnRzIiwiaXNzIjoiaHR0cHM6Ly9maXJlYmFzZS5nb29nbGUuY29tL3Byb2plY3RzL2ZpcmViYXNlLXNka3MvYXBwcyIsImV4cCI6MTcxNTgwODAwMCwic3ViIjoicHJvamVjdDozNjM0MDkyNzI0NjUifQ.iC1zD2zE_b-u-r0l8z4G_Q9y2n7v-W5f-U5W3H0q5r0l3R4Q7z7H-b3J-l4f-N9x-V3h-n4r7h2W7v-d2l-i9K-V1z-t4g-j3h-l7h-u4w-b7l-i8U-k2f-x3U-h7k-U5c-r5y-d3H-x4k-L6k-h4I-c5H-e6s-G2l-I9l-G4k-z7l-d2n-V3r-s8U-C4r-T8w-h6I-K2h-F6g-l3s-z7l-G8o-N2h-g7k-f3l-G6c-V3h-t3l-n2f-k3G-V2g-y7j-g2s-Z7o-x3r-Q8k",
      "authDomain": "qgo-cargo-survey-app-static.firebaseapp.com",
      "projectId": "qgo-cargo-survey-app-static",
      "storageBucket": "qgo-cargo-survey-app-static.appspot.com",
      "messagingSenderId": "363409272465",
      "appId": "1:363409272465:web:8e3c6c5a2b1a0d8f3b0436",
      "measurementId": "G-555N10PBMJ"
    };

    // --- FIREBASE INITIALIZATION ---
    let app, auth;
    try {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
    } catch(e) {
        console.error("Firebase initialization failed. Please provide your Firebase config in script.js", e);
        // You could show a message to the user here
    }


    // Element selectors
    const elements = {
        // Login
        loginScreen: document.getElementById('login-screen'),
        emailInput: document.getElementById('emailInput'),
        passwordInput: document.getElementById('passwordInput'),
        loginBtn: document.getElementById('loginBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        loginError: document.getElementById('login-error'),
        appContainer: document.getElementById('app-container'),
        signupLink: document.getElementById('signup-link'),

        // Main App
        steps: document.querySelectorAll('.step'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        stepIndicator: document.getElementById('step-indicator'),
        itemButtonsContainer: document.getElementById('item-buttons'),
        itemList: document.getElementById('itemList'),
        packingList: document.getElementById('packingList'),
        servicesList: document.getElementById('servicesList'),
        reviewDetails: document.getElementById('reviewDetails'),

        // Modals
        itemModal: document.getElementById('itemModal'),
        itemModalTitle: document.getElementById('itemModalTitle'),
        itemQuantity: document.getElementById('itemQuantity'),
        itemModalCancel: document.getElementById('itemModalCancel'),
        itemModalSave: document.getElementById('itemModalSave'),
        editorModal: document.getElementById('editorModal'),
        editorModeBtn: document.getElementById('editorModeBtn'),
        jsonEditor: document.getElementById('jsonEditor'),
        editorSave: document.getElementById('editorSave'),
        editorCancel: document.getElementById('editorCancel'),
        loadSurveyModal: document.getElementById('loadSurveyModal'),
        loadSurveyBtn: document.getElementById('loadSurveyBtn'),
        savedSurveysList: document.getElementById('savedSurveysList'),
        loadSurveyCancel: document.getElementById('loadSurveyCancel'),
        
        previewModal: document.getElementById('previewModal'),
        previewContent: document.getElementById('preview-content'),

        // Photo Capture
        addPhotoBtn: document.getElementById('addPhotoBtn'),
        photoInput: document.getElementById('photoInput'),
        photoPreviewContainer: document.getElementById('photoPreviewContainer'),
        
        // Signature
        signaturePad: document.getElementById('signature-pad'),
        signatureCanvas: document.getElementById('signatureCanvas'),
        clearSignatureBtn: document.getElementById('clearSignatureBtn'),

        // PDF Generation
        generateCustomerPdfBtn: document.getElementById('generateCustomerPdfBtn'),
        generateOfficePdfBtn: document.getElementById('generateOfficePdfBtn')
    };

    let signaturePad;

    // --- AUTHENTICATION ---
    function initAuth() {
        if (!auth) return;

        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in.
                elements.loginScreen.classList.add('hidden');
                elements.appContainer.classList.remove('hidden');
                initializeApp();
            } else {
                // User is signed out.
                elements.loginScreen.classList.remove('hidden');
                elements.appContainer.classList.add('hidden');
            }
        });
        
        elements.loginBtn.addEventListener('click', handleLogin);
        elements.logoutBtn.addEventListener('click', handleLogout);
        elements.passwordInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
        
        elements.signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleSignUp();
        });
    }

    function handleLogin() {
        if (!auth) return;
        const email = elements.emailInput.value;
        const password = elements.passwordInput.value;

        if (!email || !password) {
            showLoginError("Please enter email and password.");
            return;
        }

        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                console.error("Login Error:", error);
                showLoginError(error.message);
            });
    }
    
    function handleSignUp() {
        if (!auth) return;
        const email = elements.emailInput.value;
        const password = elements.passwordInput.value;

        if (!email || !password) {
            showLoginError("Please enter email and password to sign up.");
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in 
                console.log("User created:", userCredential.user);
                alert("Sign up successful! Please log in.");
                // You might want to automatically log them in, or redirect to login
            })
            .catch((error) => {
                console.error("SignUp Error:", error);
                showLoginError(error.message);
            });
    }

    function handleLogout() {
        if (auth) auth.signOut();
    }

    function showLoginError(message) {
        elements.loginError.textContent = message;
        elements.loginError.classList.remove('hidden');
        setTimeout(() => elements.loginError.classList.add('hidden'), 3000);
    }


    // --- INITIALIZATION ---
    function initializeApp() {
        populateItemButtons();
        populateChecklist('packing', config.packing, elements.packingList);
        populateChecklist('services', config.services, elements.servicesList);
        setupEventListeners();
        updateStepUI();
        initSignaturePad();
    }

    function setupEventListeners() {
        elements.prevBtn.addEventListener('click', () => changeStep(-1));
        elements.nextBtn.addEventListener('click', () => changeStep(1));
        elements.itemModalCancel.addEventListener('click', () => elements.itemModal.style.display = 'none');
        elements.itemModalSave.addEventListener('click', saveItem);
        elements.editorModeBtn.addEventListener('click', openEditor);
        elements.editorSave.addEventListener('click', saveJsonAndReload);
        elements.editorCancel.addEventListener('click', () => elements.editorModal.style.display = 'none');
        elements.loadSurveyBtn.addEventListener('click', openLoadSurvey);
        elements.loadSurveyCancel.addEventListener('click', () => elements.loadSurveyModal.style.display = 'none');
        elements.clearSignatureBtn.addEventListener('click', () => signaturePad.clear());
        elements.generateCustomerPdfBtn.addEventListener('click', () => generatePdf(false));
        elements.generateOfficePdfBtn.addEventListener('click', () => generatePdf(true));

        elements.addPhotoBtn.addEventListener('click', () => elements.photoInput.click());
        elements.photoInput.addEventListener('change', handlePhotoSelect);
    }
    
    function initSignaturePad() {
        const canvas = elements.signatureCanvas;
        // Adjust canvas size for high DPI screens
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        
        // Simple signature pad logic
        let drawing = false;
        const ctx = canvas.getContext('2d');

        function getMousePos(canvas, evt) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };
        }
        
        function getTouchPos(canvas, touch) {
             const rect = canvas.getBoundingClientRect();
             return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }

        function startDrawing(e) {
            drawing = true;
            const pos = e.touches ? getTouchPos(canvas, e.touches[0]) : getMousePos(canvas, e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            e.preventDefault();
        }

        function draw(e) {
            if (!drawing) return;
            const pos = e.touches ? getTouchPos(canvas, e.touches[0]) : getMousePos(canvas, e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            e.preventDefault();
        }

        function stopDrawing(e) {
            drawing = false;
            e.preventDefault();
        }
        
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Mouse events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        // Touch events
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);
        canvas.addEventListener('touchcancel', stopDrawing);


        signaturePad = {
            clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
            toDataURL: () => canvas.toDataURL()
        };
    }


    // --- UI & STEP LOGIC ---
    function changeStep(direction) {
        const newStep = currentStep + direction;
        if (newStep > 0 && newStep <= totalSteps) {
            if (direction > 0 && !validateStep(currentStep)) return;

            if (newStep === 2 && surveyData.items.length === 0) {
                 resetSurveyData();
            }

            if (newStep === totalSteps) {
                saveCustomerInfo();
                calculateCosts();
                displayReview();
            }
            document.getElementById(`step-${currentStep}`).classList.add('hidden');
            currentStep = newStep;
            document.getElementById(`step-${currentStep}`).classList.remove('hidden');
            updateStepUI();
        }
    }

    function updateStepUI() {
        elements.stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
        elements.prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
        elements.nextBtn.textContent = currentStep === totalSteps ? 'Save' : 'Next';
        elements.nextBtn.onclick = currentStep === totalSteps ? saveSurvey : null;
    }

    function validateStep(step) {
        if (step === 1) {
            const name = document.getElementById('customerName').value;
            if (!name) {
                alert('Please enter a customer name.');
                return false;
            }
        }
        return true;
    }

    function populateItemButtons() {
        let html = '';
        for (const category in config.items) {
            html += `<h3 class="col-span-full text-lg font-semibold mt-4">${category}</h3>`;
            config.items[category].forEach(item => {
                const itemName = item.split(' (')[0];
                html += `<button class="item-button" data-item="${item}">${itemName}</button>`;
            });
        }
        elements.itemButtonsContainer.innerHTML = html;
        elements.itemButtonsContainer.querySelectorAll('.item-button').forEach(btn => {
            btn.addEventListener('click', () => openItemModal(btn.dataset.item));
        });
    }

    function populateChecklist(type, items, container) {
        let html = '';
        items.forEach(item => {
            html += `
                <div class="flex items-center justify-between">
                    <label for="${type}-${item}">${item}</label>
                    <input type="checkbox" id="${type}-${item}" data-type="${type}" data-item="${item}" class="form-checkbox h-5 w-5 text-blue-600">
                </div>
            `;
        });
        container.innerHTML = html;
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const { item, type } = e.target.dataset;
                if (e.target.checked) {
                    surveyData[type].push(item);
                } else {
                    surveyData[type] = surveyData[type].filter(i => i !== item);
                }
            });
        });
    }


    // --- DATA HANDLING ---
    function openItemModal(item) {
        elements.itemModalTitle.textContent = item.split(' (')[0];
        elements.itemModal.dataset.currentItem = item;
        elements.itemQuantity.value = 1;
        elements.itemModal.style.display = 'flex';
    }

    function saveItem() {
        const itemFullName = elements.itemModal.dataset.currentItem;
        const quantity = parseInt(elements.itemQuantity.value, 10);
        const itemName = itemFullName.split(' (')[0];

        const existingItem = surveyData.items.find(i => i.name === itemName);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            const dimensionsMatch = itemFullName.match(/(\d+)x(\d+)x(\d+)/);
            let cbm = 0;
            if (dimensionsMatch) {
                const [, l, w, h] = dimensionsMatch.map(Number);
                cbm = (l * w * h) / 1000000;
            }
            surveyData.items.push({ name: itemName, fullName: itemFullName, quantity, cbm });
        }
        
        updateItemList();
        document.querySelector(`.item-button[data-item="${itemFullName}"]`).classList.add('added');
        elements.itemModal.style.display = 'none';
    }
    
    function updateItemList() {
        let html = '';
        if (surveyData.items.length > 0) {
            surveyData.items.forEach((item, index) => {
                html += `
                    <div class="flex items-center justify-between">
                        <span>${item.quantity} x ${item.name}</span>
                        <button data-index="${index}" class="remove-item-btn text-red-500 font-bold">X</button>
                    </div>
                `;
            });
        }
        elements.itemList.innerHTML = html;

        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                const itemToRemove = surveyData.items[index];
                surveyData.items.splice(index, 1);
                
                // Check if any other item with the same name exists
                const isOtherPresent = surveyData.items.some(i => i.fullName === itemToRemove.fullName);
                if (!isOtherPresent) {
                     const button = document.querySelector(`.item-button[data-item="${itemToRemove.fullName}"]`);
                     if (button) button.classList.remove('added');
                }
                updateItemList();
            });
        });
    }
    
    function saveCustomerInfo() {
        surveyData.customer.name = document.getElementById('customerName').value;
        surveyData.customer.phone = document.getElementById('customerPhone').value;
        surveyData.customer.email = document.getElementById('customerEmail').value;
        surveyData.customer.pickup = document.getElementById('pickupAddress').value;
        surveyData.customer.destination = document.getElementById('destinationAddress').value;
        surveyData.customer.moveType = document.getElementById('moveType').value;
    }
    
    function resetSurveyData() {
        surveyData.items = [];
        // un-highlight all buttons
        document.querySelectorAll('.item-button.added').forEach(btn => btn.classList.remove('added'));
        updateItemList();
    }


    // --- PHOTO HANDLING ---
    function handlePhotoSelect(event) {
        const files = event.target.files;
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                surveyData.photos.push(e.target.result);
                renderPhotoPreviews();
            };
            reader.readAsDataURL(file);
        }
    }

    function renderPhotoPreviews() {
        let html = '';
        surveyData.photos.forEach((dataUrl, index) => {
            html += `
                <div class="relative">
                    <img src="${dataUrl}" alt="Survey photo ${index + 1}">
                    <button data-index="${index}" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">&times;</button>
                </div>
            `;
        });
        elements.photoPreviewContainer.innerHTML = html;
        elements.photoPreviewContainer.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                surveyData.photos.splice(index, 1);
                renderPhotoPreviews();
            });
        });
    }

    // --- CALCULATION & REVIEW ---
    function calculateCosts() {
        const totalCbm = surveyData.items.reduce((acc, item) => acc + (item.cbm * item.quantity), 0);
        const cbmCost = totalCbm * config.pricing.cbmRate;
        const materialsCost = surveyData.packing.length * 5; // Example cost
        const laborCost = surveyData.services.length * 50; // Example cost
        
        const subtotal = cbmCost + materialsCost + laborCost;
        const insurance = subtotal * config.pricing.insuranceRate;
        const markup = subtotal * config.pricing.markupRate;
        const subtotalWithExtras = subtotal + insurance + markup;
        const vat = subtotalWithExtras * config.pricing.vatRate;
        const grandTotal = subtotalWithExtras + vat;

        surveyData.costs = {
            totalCbm: totalCbm.toFixed(3),
            cbmCost: cbmCost.toFixed(2),
            materials: materialsCost.toFixed(2),
            labor: laborCost.toFixed(2),
            subtotal: subtotal.toFixed(2),
            insurance: insurance.toFixed(2),
            markup: markup.toFixed(2),
            vat: vat.toFixed(2),
            grandTotal: grandTotal.toFixed(2)
        };
    }

    function displayReview() {
        const { customer, items, costs } = surveyData;
        let itemsHtml = items.map(i => `<p>${i.quantity} x ${i.name}</p>`).join('');
        
        elements.reviewDetails.innerHTML = `
            <div><strong>Name:</strong> ${customer.name}</div>
            <div><strong>Phone:</strong> ${customer.phone}</div>
            <div><strong>Total CBM:</strong> ${costs.totalCbm}</div>
            <hr>
            <h3 class="text-lg font-bold">Items:</h3>
            ${itemsHtml}
            <hr>
            <h3 class="text-lg font-bold">Pricing:</h3>
            <p>Subtotal: ${costs.subtotal} ${config.currency}</p>
            <p>Grand Total: ${costs.grandTotal} ${config.currency}</p>
        `;
    }


    // --- LOCAL STORAGE & JSON ---
    function saveSurvey() {
        if (signaturePad.toDataURL() === document.createElement('canvas').toDataURL()) {
             // A very basic check for empty canvas. A better check would compare pixel data.
            alert("Please provide a customer signature.");
            return;
        }
        surveyData.signature = signaturePad.toDataURL();

        const quoteId = generateQuoteId();
        surveyData.quoteId = quoteId;
        surveyData.date = new Date().toLocaleDateString('en-CA');
        
        try {
            localStorage.setItem(`survey_${quoteId}`, JSON.stringify(surveyData));
            alert(`Survey saved with Quote ID: ${quoteId}`);
            // Reset for next survey
            location.reload();
        } catch (e) {
            alert('Error saving survey. Local storage might be full.');
            console.error(e);
        }
    }

    function openLoadSurvey() {
        const surveys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('survey_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    surveys.push(data);
                } catch (e) {
                    console.error(`Could not parse survey ${key}`, e);
                }
            }
        }

        let html = '';
        if (surveys.length > 0) {
            surveys.sort((a, b) => new Date(b.date) - new Date(a.date));
            surveys.forEach(s => {
                html += `
                    <div class="flex items-center justify-between p-2 border-b">
                        <div>
                            <p class="font-bold">${s.customer.name} - ${s.quoteId}</p>
                            <p class="text-sm text-gray-600">${s.date}</p>
                        </div>
                        <div>
                            <button data-id="${s.quoteId}" class="view-survey-btn app-button text-sm">View</button>
                            <button data-id="${s.quoteId}" class="delete-survey-btn app-button-secondary text-sm bg-red-500 text-white">Del</button>
                        </div>
                    </div>
                `;
            });
        } else {
            html = '<p>No saved surveys found.</p>';
        }

        elements.savedSurveysList.innerHTML = html;
        elements.loadSurveyModal.style.display = 'flex';
        
        document.querySelectorAll('.view-survey-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                showPreviewModal(e.target.dataset.id);
                elements.loadSurveyModal.style.display = 'none';
            });
        });
        
        document.querySelectorAll('.delete-survey-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Are you sure you want to delete this survey?')) {
                    localStorage.removeItem(`survey_${e.target.dataset.id}`);
                    openLoadSurvey(); // Refresh list
                }
            });
        });
    }

    function openEditor() {
        elements.jsonEditor.value = JSON.stringify(config, null, 2);
        elements.editorModal.style.display = 'flex';
    }

    function saveJsonAndReload() {
        try {
            const newConfig = JSON.parse(elements.jsonEditor.value);
            // This is a simple example. In a real app, you'd save this to a server or localStorage.
            // For now, we just reload and the default config will be used again. A real implementation would be more complex.
            alert("Configuration updated. The page will now reload.");
            // To persist config, you would do: localStorage.setItem('surveyConfig', JSON.stringify(newConfig));
            // And on load: const savedConfig = localStorage.getItem('surveyConfig'); if(savedConfig) config = JSON.parse(savedConfig);
            location.reload();
        } catch (e) {
            alert("Invalid JSON format!");
        }
    }


    // --- PDF & PREVIEW ---
    function generatePdf(isOfficeCopy) {
        const content = generateReceiptHtml(surveyData, isOfficeCopy);
        const opt = {
            margin: 0,
            filename: `${surveyData.quoteId}_${isOfficeCopy ? 'Office' : 'Customer'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(content).set(opt).save();
    }
    
    function showPreviewModal(quoteId) {
        const data = JSON.parse(localStorage.getItem(`survey_${quoteId}`));
        const content = generateReceiptHtml(data, true); // Show office copy by default in preview
        
        let previewHtml = `
            <header class="fixed top-0 left-0 right-0 bg-white p-2 flex justify-between items-center border-b z-10">
                 <button id="closePreviewBtn" class="app-button">Back</button>
                 <div>
                    <button id="printCustomerCopyBtn" class="app-button-secondary text-sm">Print Customer</button>
                    <button id="printOfficeCopyBtn" class="app-button text-sm">Print Office</button>
                 </div>
            </header>
            <div class="pt-16">
              ${content}
            </div>
        `;
        
        elements.previewContent.innerHTML = previewHtml;
        elements.previewModal.classList.remove('hidden');

        document.getElementById('closePreviewBtn').addEventListener('click', () => {
            elements.previewModal.classList.add('hidden');
        });
        document.getElementById('printCustomerCopyBtn').addEventListener('click', () => {
             const customerContent = generateReceiptHtml(data, false);
             printContent(customerContent, data.quoteId, "Customer");
        });
        document.getElementById('printOfficeCopyBtn').addEventListener('click', () => {
             const officeContent = generateReceiptHtml(data, true);
             printContent(officeContent, data.quoteId, "Office");
        });
    }

    function printContent(content, quoteId, type) {
        const opt = {
            margin: 0,
            filename: `${quoteId}_${type}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(content).set(opt).save();
    }

    function generateReceiptHtml(data, isOfficeCopy) {
        const { company, currency } = config;
        const { customer, items, costs, quoteId, date, signature, photos, packing, services } = data;

        const itemsHtml = items.map(item => `
            <tr>
                <td>${item.name}<br><small class="text-gray-500">${item.fullName.split('(')[1] ? '(' + item.fullName.split('(')[1] : ''}</small></td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${item.cbm.toFixed(3)}</td>
                <td class="text-right">${(item.cbm * item.quantity).toFixed(3)}</td>
            </tr>
        `).join('');

        const pricingHtml = isOfficeCopy ? `
            <table class="totals-table">
                <tr><td class="label">CBM Cost (N/A):</td><td class="value">${costs.cbmCost}</td></tr>
                <tr><td class="label">Materials:</td><td class="value">${costs.materials}</td></tr>
                <tr><td class="label">Labor:</td><td class="value">${costs.labor}</td></tr>
                <tr><td class="label">Surcharges:</td><td class="value">0.00</td></tr>
                <tr style="border-top: 1px solid #333;"><td class="label" style="font-weight: bold;">Subtotal:</td><td class="value" style="font-weight: bold;">${costs.subtotal}</td></tr>
                <tr><td class="label">Insurance (1.5%):</td><td class="value">${costs.insurance}</td></tr>
                <tr><td class="label">Markup (10%):</td><td class="value">${costs.markup}</td></tr>
                <tr><td class="label">VAT (5%):</td><td class="value">${costs.vat}</td></tr>
                <tr><td class="label grand-total">Grand Total:</td><td class="value grand-total">${costs.grandTotal} ${currency}</td></tr>
            </table>
        ` : `<div class="grand-total-customer">Quote: ${costs.grandTotal} ${currency}</div>`;
        
        const grandTotalColor = isOfficeCopy ? 'inherit' : '#000'; // Black for customer copy

        const photosHtml = photos && photos.length > 0
            ? photos.map(p => `<img src="${p}" alt="photo">`).join('')
            : '<p class="text-gray-600">No photos captured.</p>';

        return `
            <div class="receipt-container">
                <style>
                    .grand-total-customer {
                        text-align: right;
                        font-size: 1.5em;
                        font-weight: bold;
                        margin: 20px 0;
                        color: #000;
                    }
                    .totals-table td {
                        color: #000 !important;
                    }
                </style>
                <div class="receipt-header">
                    <img src="https://i.ibb.co/3s0vK0h/qgocargo-logo.png" alt="Logo" style="width: 150px;">
                    <div class="company-info-main">
                        <h2 style="font-size: 1.5em; font-weight: bold;">QUOTATION ${isOfficeCopy ? '(Office Copy)' : ''}</h2>
                        <p><strong>Quote #:</strong> ${quoteId}</p>
                        <p><strong>Date:</strong> ${date}</p>
                    </div>
                </div>

                <div class="receipt-details">
                    <div>
                        <h3 style="font-weight: bold; margin-bottom: 5px;">Bill To:</h3>
                        <p>${customer.name || ''}</p>
                        <p>${customer.phone || ''}</p>
                        <p>${customer.email || ''}</p>
                    </div>
                    <div>
                        <h3 style="font-weight: bold; margin-bottom: 5px;">Company Info:</h3>
                        <p>${company.name}</p>
                        <p>${company.address}</p>
                        <p>Tel: ${company.phone} | Email: ${company.email}</p>
                    </div>
                </div>
                 <div class="receipt-details">
                    <div>
                        <p><strong>Pickup:</strong> ${customer.pickup || ''}</p>
                        <p><strong>Destination:</strong> ${customer.destination || ''}</p>
                        <p><strong>Move Type:</strong> ${customer.moveType || ''}</p>
                    </div>
                </div>

                <h3 style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Itemized List</h3>
                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>Item Description</th>
                            <th class="text-right">Qty</th>
                            <th class="text-right">CBM/Unit</th>
                            <th class="text-right">Total CBM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div style="text-align: right; font-weight: bold; font-size: 1.2em; margin-bottom: 20px;">
                    Total Volume: ${costs.totalCbm} CBM
                </div>

                ${pricingHtml ? `<h3 style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; color: ${grandTotalColor};">Pricing Summary</h3>` : ''}
                ${pricingHtml}
                
                <h3 style="font-weight: bold; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Photos</h3>
                <div class="receipt-photos">${photosHtml}</div>

                <div class="receipt-footer">
                    <div>
                        <h3 style="font-weight: bold; margin-bottom: 10px;">Terms & Conditions</h3>
                        <p style="font-size: 0.8em;">1. This quote is valid for 30 days.</p>
                        <p style="font-size: 0.8em;">2. All goods are handled with care.</p>
                    </div>
                    <div>
                        <h3 style="font-weight: bold; margin-bottom: 10px;">Customer Signature</h3>
                        ${signature ? `<img src="${signature}" alt="signature" style="width: 200px; height: auto;">` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // --- HELPERS ---
    function generateQuoteId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    // PWA Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }


    // Start the app
    initAuth();
});
