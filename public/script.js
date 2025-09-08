document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }


    const state = {
        currentStep: 1,
        surveyData: {
            customerName: '',
            customerId: '',
            surveyDate: new Date().toISOString().split('T')[0],
            surveyorName: '',
            origin: '',
            destination: '',
            rooms: {},
            totalCBM: 0,
            surveyId: '',
            pricePerCbm: null,
        },
        selectedRoom: '',
        selectedItem: '',
        tempItemDetails: {
            length: '',
            width: '',
            height: '',
            quantity: 1,
            cbm: 0
        },
    };

    let branding = {
        companyName: "Q'go Cargo",
        companyAddress: "123 Cargo Lane, Kuwait City, Kuwait",
        companyPhone: "+965 1234 5678",
        companyEmail: "contact@qgocargo.com",
        logoUrl: "https://qgocargo.com/logo.png",
        themeColor: "#007AFF" // Blue accent
    };

    let db = {
        rooms: [
            "Living Room", "Dining Room", "Master Bedroom", "Bedroom 1", "Bedroom 2", "Kitchen", "Bathroom", "Office", "Garage", "Storage"
        ],
        items: [
            "Sofa", "Armchair", "Coffee Table", "End Table", "TV Stand", "Bookshelf", "Dining Table", "Dining Chair", "Bed", "Dresser", "Nightstand", "Desk", "Office Chair", "Refrigerator", "Washing Machine", "Dryer", "Box"
        ]
    };

    const loadFromLocalStorage = () => {
        const savedDb = localStorage.getItem('qgo-db');
        const savedBranding = localStorage.getItem('qgo-branding');
        if (savedDb) {
            db = JSON.parse(savedDb);
        }
        if (savedBranding) {
            branding = JSON.parse(savedBranding);
            document.documentElement.style.setProperty('--primary-color', branding.themeColor);
        } else {
             document.documentElement.style.setProperty('--primary-color', '#007AFF');
        }
    };

    const saveToLocalStorage = () => {
        localStorage.setItem('qgo-db', JSON.stringify(db));
        localStorage.setItem('qgo-branding', JSON.stringify(branding));
    };

    // UI Elements
    const steps = document.querySelectorAll('.step-card');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const stepIndicator = document.getElementById('step-indicator');
    const appMain = document.getElementById('app-main');

    // Step 1: Customer Info
    const customerNameInput = document.getElementById('customer-name');
    const customerIdInput = document.getElementById('customer-id');
    const surveyDateInput = document.getElementById('survey-date');
    const surveyorNameInput = document.getElementById('surveyor-name');
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');

    // Step 2: Rooms
    const roomList = document.getElementById('room-list');
    const newRoomInput = document.getElementById('new-room-name');
    const addRoomBtn = document.getElementById('add-room-btn');

    // Step 3: Items
    const itemList = document.getElementById('item-list');
    const newItemInput = document.getElementById('new-item-name');
    const addItemBtn = document.getElementById('add-item-btn');
    const roomNameHeader = document.getElementById('room-name-header');

    // Step 4: Item Details
    const itemNameHeader = document.getElementById('item-name-header');
    const itemLengthInput = document.getElementById('item-length');
    const itemWidthInput = document.getElementById('item-width');
    const itemHeightInput = document.getElementById('item-height');
    const itemQuantityInput = document.getElementById('item-quantity');
    const itemCbmDisplay = document.getElementById('item-cbm');
    const addToSurveyBtn = document.getElementById('add-to-survey-btn');

    // Step 5: Summary
    const summaryList = document.getElementById('summary-list');
    const totalCbmDisplay = document.getElementById('total-cbm');
    const surveyIdDisplay = document.getElementById('survey-id-display');

    // Step 6: Review
    const reviewCustomerName = document.getElementById('review-customer-name');
    const reviewSurveyId = document.getElementById('review-survey-id');
    const reviewTotalCbm = document.getElementById('review-total-cbm');
    const pricePerCbmInput = document.getElementById('price-per-cbm');
    const totalPriceDisplay = document.getElementById('total-price');
    const customerPdfBtn = document.getElementById('customer-pdf-btn');
    const officePdfBtn = document.getElementById('office-pdf-btn');

    // Modals
    const editorModal = document.getElementById('editor-modal');
    const loadSurveyModal = document.getElementById('load-survey-modal');
    const previewModal = document.getElementById('preview-modal');
    const editorModeBtn = document.getElementById('editor-mode-btn');
    const loadSurveyBtn = document.getElementById('load-survey-btn');
    const closeButtons = document.querySelectorAll('.close-modal-btn');

    const init = () => {
        loadFromLocalStorage();
        updateStepUI();
        setupEventListeners();
        populateRooms();
        populateItems();
        // Set default values
        surveyDateInput.value = state.surveyData.surveyDate;
    };

    const setupEventListeners = () => {
        prevBtn.addEventListener('click', () => changeStep(-1));
        nextBtn.addEventListener('click', () => changeStep(1));

        addRoomBtn.addEventListener('click', addCustomRoom);
        newRoomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addCustomRoom();
        });

        addItemBtn.addEventListener('click', addCustomItem);
        newItemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addCustomItem();
        });

        [itemLengthInput, itemWidthInput, itemHeightInput].forEach(input => {
            input.addEventListener('input', calculateItemCBM);
        });

        addToSurveyBtn.addEventListener('click', addItemToSurvey);
        
        pricePerCbmInput.addEventListener('input', calculateTotalPrice);
        
        customerPdfBtn.addEventListener('click', () => generateReceipt(false));
        officePdfBtn.addEventListener('click', () => generateReceipt(true));

        // Modals
        editorModeBtn.addEventListener('click', openEditorModal);
        loadSurveyBtn.addEventListener('click', openLoadSurveyModal);
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.getAttribute('data-modal-id');
                document.getElementById(modalId).classList.add('hidden');
            });
        });
        
        document.getElementById('save-editor-changes-btn').addEventListener('click', saveEditorChanges);
        
        document.getElementById('preview-customer-print-btn').addEventListener('click', () => generateReceipt(false, true));
        document.getElementById('preview-office-print-btn').addEventListener('click', () => generateReceipt(true, true));
    };

    const changeStep = (direction) => {
        const nextStep = state.currentStep + direction;

        if (nextStep > 0 && nextStep <= steps.length) {
            // Logic before changing step
            if (direction === 1) { // Moving forward
                if (state.currentStep === 1 && !validateStep1()) return;
                if (state.currentStep === 2 && !validateStep2()) return;
                if (state.currentStep === 3 && !validateStep3()) return;
                
                if (state.currentStep === 4) { // Coming from item details
                     // Don't do anything, just go back to item list
                }
                
                if (state.currentStep === 5) { // Moving to review
                    prepareReviewStep();
                }
            }
             if (direction === -1) { // Moving backward
                 if (state.currentStep === 4) { // from item details to item list
                     state.currentStep = 3;
                     updateStepUI();
                     return;
                 }
             }

            state.currentStep = nextStep;
            updateStepUI();
        }
    };
    
    const goToStep = (stepNumber) => {
        if (stepNumber > 0 && stepNumber <= steps.length) {
            state.currentStep = stepNumber;
            updateStepUI();
        }
    }

    const updateStepUI = () => {
        appMain.style.setProperty('--active-step', state.currentStep -1);
        steps.forEach((step, index) => {
            if (index + 1 === state.currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        stepIndicator.textContent = `Step ${state.currentStep}/6`;
        prevBtn.disabled = state.currentStep === 1;
        nextBtn.disabled = state.currentStep === steps.length;
        
        // Special logic for step 5
        if(state.currentStep === 5){
             nextBtn.disabled = false;
        }
    };
    
    // Step 1 Logic
    const validateStep1 = () => {
        const { customerName, customerId, surveyDate, surveyorName, origin, destination } = state.surveyData;
        
        state.surveyData.customerName = customerNameInput.value;
        state.surveyData.customerId = customerIdInput.value;
        state.surveyData.surveyDate = surveyDateInput.value;
        state.surveyData.surveyorName = surveyorNameInput.value;
        state.surveyData.origin = originInput.value;
        state.surveyData.destination = destinationInput.value;
        
        if (!state.surveyData.customerName || !state.surveyData.surveyDate || !state.surveyData.surveyorName) {
            alert('Please fill in Name, Date, and Surveyor Name.');
            return false;
        }
        
        const surveyId = `${state.surveyData.surveyDate}-${state.surveyData.customerName.replace(/\s+/g, '-')}`;
        state.surveyData.surveyId = surveyId;
        surveyIdDisplay.textContent = surveyId;
        
        saveSurveyToLocalStorage();
        return true;
    };
    
    // Step 2 Logic
    const populateRooms = () => {
        roomList.innerHTML = '';
        db.rooms.forEach(room => {
            const button = document.createElement('button');
            button.className = 'grid-item';
            button.textContent = room;
            button.addEventListener('click', () => selectRoom(room));
            roomList.appendChild(button);
        });
    };

    const addCustomRoom = () => {
        const newRoomName = newRoomInput.value.trim();
        if (newRoomName && !db.rooms.includes(newRoomName)) {
            db.rooms.push(newRoomName);
            saveToLocalStorage();
            populateRooms();
            newRoomInput.value = '';
            selectRoom(newRoomName); // auto-select the new room
        } else if (newRoomName) {
             selectRoom(newRoomName);
        }
    };
    
    const selectRoom = (room) => {
        state.selectedRoom = room;
        roomNameHeader.textContent = `Items in ${room}`;
        if (!state.surveyData.rooms[room]) {
            state.surveyData.rooms[room] = { items: {}, totalCBM: 0 };
        }
        populateItems(); // repopulate to show which items are already added
        changeStep(1); // Move to step 3
    };
    
    const validateStep2 = () => {
        if (!state.selectedRoom) {
            // This case should not happen if UI is correct
            alert('Please select a room.');
            return false;
        }
        return true;
    }

    // Step 3 Logic
    const populateItems = () => {
        itemList.innerHTML = '';
        const itemsInRoom = state.surveyData.rooms[state.selectedRoom]?.items || {};
        
        db.items.forEach(item => {
            const button = document.createElement('button');
            button.className = 'grid-item';
            const itemCount = itemsInRoom[item] ? ` (${itemsInRoom[item].quantity})` : '';
            button.textContent = item + itemCount;
            if(itemCount) {
                button.classList.add('selected');
            }
            button.addEventListener('click', () => selectItem(item));
            itemList.appendChild(button);
        });
    };
    
     const addCustomItem = () => {
        const newItemName = newItemInput.value.trim();
        if (newItemName && !db.items.includes(newItemName)) {
            db.items.push(newItemName);
            saveToLocalStorage();
            populateItems();
            newItemInput.value = '';
            selectItem(newItemName);
        } else if (newItemName) {
            selectItem(newItemName);
        }
    };

    const selectItem = (item) => {
        state.selectedItem = item;
        itemNameHeader.textContent = item;
        
        // Reset or pre-fill item details
        const existingItem = state.surveyData.rooms[state.selectedRoom]?.items[item];
        if (existingItem) {
            itemLengthInput.value = existingItem.length;
            itemWidthInput.value = existingItem.width;
            itemHeightInput.value = existingItem.height;
            itemQuantityInput.value = existingItem.quantity;
            itemCbmDisplay.textContent = existingItem.cbm.toFixed(3);
        } else {
             itemLengthInput.value = '';
             itemWidthInput.value = '';
             itemHeightInput.value = '';
             itemQuantityInput.value = 1;
             itemCbmDisplay.textContent = '0.000';
        }
        
        goToStep(4);
    };
    
    const validateStep3 = () => {
        // No specific validation, but we can check if a room is selected
        if (!state.selectedRoom) {
             alert("Something went wrong, please go back and select a room.");
             return false;
        }
        return true;
    }


    // Step 4 Logic
    const calculateItemCBM = () => {
        const length = parseFloat(itemLengthInput.value) || 0;
        const width = parseFloat(itemWidthInput.value) || 0;
        const height = parseFloat(itemHeightInput.value) || 0;
        const cbm = (length * width * height) / 1000000;
        itemCbmDisplay.textContent = cbm.toFixed(3);
    };

    const addItemToSurvey = () => {
        const length = parseFloat(itemLengthInput.value);
        const width = parseFloat(itemWidthInput.value);
        const height = parseFloat(itemHeightInput.value);
        const quantity = parseInt(itemQuantityInput.value);

        if (isNaN(length) || isNaN(width) || isNaN(height) || isNaN(quantity) || length <= 0 || width <= 0 || height <= 0 || quantity <= 0) {
            alert('Please enter valid, positive dimensions and quantity.');
            return;
        }
        
        const cbmPerItem = (length * width * height) / 1000000;
        const totalCbmForItem = cbmPerItem * quantity;

        const roomData = state.surveyData.rooms[state.selectedRoom];
        
        // If item already exists, update it. Otherwise, add it.
        const existingItem = roomData.items[state.selectedItem];
        if(existingItem) {
            // Subtract old CBM before adding new
            roomData.totalCBM -= existingItem.cbm * existingItem.quantity;
            state.surveyData.totalCBM -= existingItem.cbm * existingItem.quantity;
        }
        
        roomData.items[state.selectedItem] = {
            length,
            width,
            height,
            quantity,
            cbm: cbmPerItem,
        };
        
        roomData.totalCBM += totalCbmForItem;
        state.surveyData.totalCBM += totalCbmForItem;

        updateSummary();
        saveSurveyToLocalStorage();
        
        // Go back to item list
        goToStep(3);
        populateItems(); // To update the count on the button
    };
    
    // Step 5 Logic
    const updateSummary = () => {
        summaryList.innerHTML = '';
        for (const room in state.surveyData.rooms) {
            const roomData = state.surveyData.rooms[room];
            if(Object.keys(roomData.items).length === 0) continue;

            const roomHeader = document.createElement('div');
            roomHeader.className = 'summary-room-header';
            roomHeader.textContent = `${room} (Total CBM: ${roomData.totalCBM.toFixed(3)})`;
            summaryList.appendChild(roomHeader);
            
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'summary-items-container';
            
            for (const item in roomData.items) {
                const itemData = roomData.items[item];
                const itemDiv = document.createElement('div');
                itemDiv.className = 'summary-item';
                
                const itemName = document.createElement('span');
                itemName.textContent = `${item} (x${itemData.quantity})`;
                
                const itemDetails = document.createElement('span');
                itemDetails.textContent = `${(itemData.cbm * itemData.quantity).toFixed(3)} CBM`;
                
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.className = 'edit-item-btn';
                editBtn.onclick = () => {
                    state.selectedRoom = room;
                    selectItem(item);
                };
                
                itemDiv.appendChild(itemName);
                itemDiv.appendChild(itemDetails);
                itemDiv.appendChild(editBtn);
                itemsContainer.appendChild(itemDiv);
            }
            summaryList.appendChild(itemsContainer);
        }
        totalCbmDisplay.textContent = state.surveyData.totalCBM.toFixed(3);
    };

    // Step 6 Logic
    const prepareReviewStep = () => {
        reviewCustomerName.textContent = state.surveyData.customerName;
        reviewSurveyId.textContent = state.surveyData.surveyId;
        reviewTotalCbm.textContent = state.surveyData.totalCBM.toFixed(3);
        pricePerCbmInput.value = state.surveyData.pricePerCbm || '';
        calculateTotalPrice();
    };

    const calculateTotalPrice = () => {
        const pricePerCbm = parseFloat(pricePerCbmInput.value) || 0;
        state.surveyData.pricePerCbm = pricePerCbm;
        const totalPrice = state.surveyData.totalCBM * pricePerCbm;
        totalPriceDisplay.textContent = totalPrice.toFixed(2);
        saveSurveyToLocalStorage();
    };
    
    // Editor Modal Logic
    const openEditorModal = () => {
        populateEditableLists();
        editorModal.classList.remove('hidden');
    };

    const populateEditableLists = () => {
        const editableRoomsList = document.getElementById('editable-rooms-list');
        const editableItemsList = document.getElementById('editable-items-list');

        editableRoomsList.innerHTML = '';
        db.rooms.forEach(room => {
            const div = document.createElement('div');
            div.className = 'editable-item';
            div.innerHTML = `<span>${room}</span><button data-type="room" data-name="${room}" class="delete-btn">&times;</button>`;
            editableRoomsList.appendChild(div);
        });

        editableItemsList.innerHTML = '';
        db.items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'editable-item';
            div.innerHTML = `<span>${item}</span><button data-type="item" data-name="${item}" class="delete-btn">&times;</button>`;
            editableItemsList.appendChild(div);
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                 const type = e.target.dataset.type;
                 const name = e.target.dataset.name;
                 if (type === 'room') {
                     db.rooms = db.rooms.filter(r => r !== name);
                 } else {
                     db.items = db.items.filter(i => i !== name);
                 }
                 populateEditableLists();
            });
        });
    };
    
    const saveEditorChanges = () => {
        const newRoom = document.getElementById('editor-new-room').value.trim();
        if(newRoom && !db.rooms.includes(newRoom)) db.rooms.push(newRoom);
        
        const newItem = document.getElementById('editor-new-item').value.trim();
        if(newItem && !db.items.includes(newItem)) db.items.push(newItem);
        
        saveToLocalStorage();
        populateRooms();
        populateItems();
        editorModal.classList.add('hidden');
        alert("Changes saved!");
    }


    // --- LOAD/SAVE SURVEY ---
    const saveSurveyToLocalStorage = () => {
        if (!state.surveyData.surveyId) return;
        localStorage.setItem(`survey-${state.surveyData.surveyId}`, JSON.stringify(state.surveyData));
    };

    const openLoadSurveyModal = () => {
        const listEl = document.getElementById('saved-surveys-list');
        listEl.innerHTML = '';
        let hasSurveys = false;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('survey-')) {
                hasSurveys = true;
                const surveyData = JSON.parse(localStorage.getItem(key));
                const div = document.createElement('div');
                div.className = 'saved-survey-item';
                div.innerHTML = `
                    <span>${surveyData.surveyId}</span>
                    <span>${surveyData.customerName}</span>
                    <span>${surveyData.totalCBM.toFixed(3)} CBM</span>
                `;
                div.onclick = () => loadSurvey(key);
                
                const previewBtn = document.createElement('button');
                previewBtn.textContent = 'Preview';
                previewBtn.className = 'app-button';
                previewBtn.onclick = (e) => {
                    e.stopPropagation();
                    showPreviewModal(surveyData);
                };
                
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.className = 'app-button delete-survey-btn';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if(confirm(`Are you sure you want to delete survey: ${surveyData.surveyId}?`)) {
                        localStorage.removeItem(key);
                        openLoadSurveyModal(); // Refresh list
                    }
                };

                div.appendChild(previewBtn);
                div.appendChild(deleteBtn);
                listEl.appendChild(div);
            }
        }
        if (!hasSurveys) {
            listEl.innerHTML = '<p>No saved surveys found.</p>';
        }
        loadSurveyModal.classList.remove('hidden');
    };
    
    const showPreviewModal = (surveyData) => {
         // Update state with the loaded data to ensure receipt generation is correct
        state.surveyData = surveyData;
        
        loadSurveyModal.classList.add('hidden'); // Close load modal if open
        previewModal.classList.remove('hidden');
        
        // Buttons need to know which survey they're printing
        document.getElementById('preview-customer-print-btn').onclick = () => generateReceipt(false, true, surveyData);
        document.getElementById('preview-office-print-btn').onclick = () => generateReceipt(true, true, surveyData);
        
        // Initial generation of the receipt view for the modal
        generateReceipt(true, false, surveyData);
    }


    const loadSurvey = (key) => {
        const surveyData = JSON.parse(localStorage.getItem(key));
        state.surveyData = surveyData;
        
        // Repopulate UI with loaded data
        customerNameInput.value = surveyData.customerName;
        customerIdInput.value = surveyData.customerId;
        surveyDateInput.value = surveyData.surveyDate;
        surveyorNameInput.value = surveyData.surveyorName;
        originInput.value = surveyData.origin;
        destinationInput.value = surveyData.destination;
        pricePerCbmInput.value = surveyData.pricePerCbm || '';

        updateSummary();
        prepareReviewStep();

        loadSurveyModal.classList.add('hidden');
        alert(`Survey "${surveyData.surveyId}" loaded.`);
        goToStep(1); // Go to first step to allow user to review
    };
    
    
    // --- RECEIPT/PDF GENERATION ---
    const generateReceipt = (isOfficeCopy, forPrinting = true, surveyData = state.surveyData) => {
        const receiptContentEl = document.getElementById('receipt-content');
        const totalPrice = (surveyData.totalCBM * (surveyData.pricePerCbm || 0)).toFixed(2);
        
        const itemsHtml = Object.keys(surveyData.rooms).map(roomName => {
            const room = surveyData.rooms[roomName];
            if(Object.keys(room.items).length === 0) return '';
            
            const itemsList = Object.keys(room.items).map(itemName => {
                const item = room.items[itemName];
                return `
                    <tr>
                        <td>${itemName}</td>
                        <td>${item.quantity}</td>
                        <td>${item.length}x${item.width}x${item.height}</td>
                        <td>${item.cbm.toFixed(3)}</td>
                        <td>${(item.cbm * item.quantity).toFixed(3)}</td>
                    </tr>
                `;
            }).join('');
            
            return `
                 <tr class="room-summary-row">
                    <td colspan="4"><strong>${roomName}</strong></td>
                    <td><strong>${room.totalCBM.toFixed(3)}</strong></td>
                 </tr>
                 ${itemsList}
            `;
        }).join('');

        const pricingHtml = isOfficeCopy ? `
            <div class="receipt-section">
                <h3>Pricing Details</h3>
                <p><strong>Price per CBM:</strong> ${surveyData.pricePerCbm || 'N/A'}</p>
                <p><strong>Total Estimated Price:</strong> ${totalPrice}</p>
            </div>
        ` : '';

        receiptContentEl.innerHTML = `
            <div class="receipt-header">
                <img src="${branding.logoUrl}" alt="${branding.companyName}" class="receipt-logo h-16">
                <div>
                    <h2>${branding.companyName}</h2>
                    <p>${branding.companyAddress}</p>
                    <p>${branding.companyPhone} | ${branding.companyEmail}</p>
                </div>
                <h2>${isOfficeCopy ? 'Office Copy' : 'Customer Estimate'}</h2>
            </div>
            
            <div class="receipt-section customer-info">
                 <h3>Survey Details</h3>
                 <div class="info-grid">
                    <p><strong>Customer:</strong> ${surveyData.customerName}</p>
                    <p><strong>Survey ID:</strong> ${surveyData.surveyId}</p>
                    <p><strong>Date:</strong> ${surveyData.surveyDate}</p>
                    <p><strong>Surveyor:</strong> ${surveyData.surveyorName}</p>
                    <p><strong>Origin:</strong> ${surveyData.origin}</p>
                    <p><strong>Destination:</strong> ${surveyData.destination}</p>
                 </div>
            </div>

            <div class="receipt-section items-table">
                <h3>Items List</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Dimensions (cm)</th>
                            <th>CBM/item</th>
                            <th>Total CBM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4"><strong>Grand Total CBM</strong></td>
                            <td><strong>${surveyData.totalCBM.toFixed(3)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            ${pricingHtml}

            <div class="receipt-section signature-section">
                <div class="signature-box">
                    <p><strong>Surveyor Signature:</strong></p>
                    <div class="signature-line"></div>
                </div>
                 <div class="signature-box">
                    <p><strong>Customer Signature:</strong></p>
                    <div class="signature-line"></div>
                </div>
            </div>
            
            <div class="receipt-footer">
                <p><strong>Terms & Conditions:</strong> This is an estimate and not a final quote. Prices may vary based on final weight, volume, and services required.</p>
                <p>Thank you for choosing ${branding.companyName}!</p>
            </div>
        `;

        if (forPrinting) {
            const printWindow = window.open('', '', 'height=800,width=800');
            printWindow.document.write('<html><head><title>Print Survey</title>');
            // Link to the same stylesheet
            const styles = Array.from(document.styleSheets)
              .map(s => `<link rel="stylesheet" href="${s.href}">`)
              .join('');
            printWindow.document.write(styles);
            printWindow.document.write('<style>body { margin: 20px; } .receipt {box-shadow: none; border: none;} </style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(receiptContentEl.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            setTimeout(() => { // Timeout to allow assets to load
                printWindow.print();
            }, 500);
        }
    };


    init();
});
