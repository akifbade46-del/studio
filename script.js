
const D = document;
const G = (id) => D.getElementById(id);

const state = {
    currentStep: 1,
    totalSteps: 6,
    survey: {},
    settings: {},
    firebase: { app: null, db: null, storage: null },
};

const defaultSettings = {
    company: { name: "Q'go Cargo", address: "123 Cargo Lane, Kuwait City, Kuwait", phone: "+965 1234 5678", email: "contact@qgocargo.com", logo: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNFMzA1MTciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTdWNmE0IDQgMCAwIDAtOCAwIi8+PHBhdGggZD0iTTEzIDZWMTRIMyIvPjxwYXRoIGQ9Ik0zIDE0SDEiLz48cGF0aCBkPSJNNyAxNEg2Ii8+PHBhdGggZD0iTTIxIDE3SDMiLz48Y2lyY2xlIGN4PSI4IiBjeT0iMTciIHI9IjIiLz48Y2lyY2xlIGN4PSIxOCIgY3k9IjE3IiByPSIyIi8+PC9zdmc+" },
    branding: { primary: '#E30B17', dark: '#111827', accent: '#0EA5E9' },
    firebaseConfig: {
      apiKey: "AIzaSyAdXAZ_-I6Fg3Sn9bY8wPFpQ-NlrKNy6LU",
      authDomain: "survey-bf41d.firebaseapp.com",
      projectId: "survey-bf41d",
      storageBucket: "survey-bf41d.firebasestorage.app",
      messagingSenderId: "869329094353",
      appId: "1:869329094353:web:2692f2ad3db106a95827f0",
      measurementId: "G-GEFSXECYMQ"
    },
    customerFields: [
        { id: 'name', label: 'Customer Name', type: 'text', required: true, enabled: true },
        { id: 'phone', label: 'Phone', type: 'tel', required: true, enabled: true },
        { id: 'email', label: 'Email', type: 'email', required: false, enabled: true },
        { id: 'pickupAddress', label: 'Pickup Address', type: 'text', required: true, enabled: true },
        { id: 'destinationAddress', label: 'Destination Address', type: 'text', required: true, enabled: true },
        { id: 'surveyDate', label: 'Survey Date', type: 'datetime-local', required: true, enabled: true },
        { id: 'moveType', label: 'Move Type', type: 'select', options: ['Local', 'GCC', 'International'], required: true, enabled: true },
    ],
    itemPresets: [
        { name: 'Carton S', l: 45, w: 45, h: 45 },
        { name: 'Carton M', l: 60, w: 60, h: 60 },
        { name: 'Sofa 3-seater', l: 200, w: 90, h: 80},
    ],
    containers: [
        { type: '20ft', capacity: 33.2, efficiency: 0.85 },
        { type: '40ft', capacity: 67.7, efficiency: 0.85 },
        { type: '40HC', capacity: 76.0, efficiency: 0.85 },
    ],
    rates: {
        currency: 'KWD',
        cbmRates: { Local: 15, GCC: 25, International: 40 },
        minCharge: 100,
        materials: 5,
        labor: 50,
        surcharges: 0,
        insurancePercent: 1.5,
        vatPercent: 5,
        markupPercent: 10,
    },
    templates: {
        pdfTerms: '1. This quote is valid for 30 days.\n2. All goods are handled with care.',
        whatsapp: 'Dear {{customerName}},\n\nPlease find your quote summary. Total is {{grandTotal}} {{currency}}.\n\nThank you,\n{{companyName}}'
    }
};

function init() {
    state.settings = JSON.parse(localStorage.getItem('surveyAppSettings')) || defaultSettings;
    const savedSurvey = localStorage.getItem('currentSurvey');
    state.survey = savedSurvey ? JSON.parse(savedSurvey) : createNewSurvey();
    
    initFirebase();
    applyBranding();
    updateUI();
    setupEventListeners();
    renderCustomerForm();
    renderItemPresets();
    renderItemsTable();
    updateFooter();
    renderPhotos();
}

function initFirebase() {
    if (state.settings.firebaseConfig && !state.firebase.app) {
        try {
            state.firebase.app = firebase.initializeApp(state.settings.firebaseConfig);
            state.firebase.db = firebase.firestore();
            state.firebase.storage = firebase.storage();
            console.log("Firebase initialized successfully.");
        } catch (e) {
            console.error("Could not initialize Firebase. Check your config.", e);
            alert("Could not initialize Firebase. Please check your configuration in the Editor.");
        }
    }
}

function createNewSurvey() {
    return {
        id: `survey-${new Date().toISOString()}-${Math.random().toString(36).substr(2, 9)}`,
        meta: { createdAt: new Date().toISOString() },
        customer: { surveyDate: new Date().toISOString().slice(0, 16) },
        items: [],
        totals: { cbm: 0 },
        media: { photos: [], signature: null }
    };
}

function startNewSurvey() {
    if (confirm('Are you sure you want to start a new survey? Any unsaved data will be lost.')) {
        localStorage.removeItem('currentSurvey');
        state.survey = createNewSurvey();
        state.currentStep = 1;
        init(); // Re-initialize the app state and UI
    }
}


function updateUI() {
    D.querySelectorAll('.step').forEach((step, i) => {
        step.classList.toggle('active', i + 1 === state.currentStep);
    });
    G('prev-btn').disabled = state.currentStep === 1;
    G('next-btn').disabled = state.currentStep === state.totalSteps;
    G('next-btn').innerText = state.currentStep === state.totalSteps ? 'Finish' : 'Next';

    const indicatorContainer = G('step-indicator');
    indicatorContainer.innerHTML = '';
    for(let i=1; i <= state.totalSteps; i++) {
        const dot = D.createElement('div');
        dot.className = `w-3 h-3 rounded-full ${i === state.currentStep ? 'bg-primary' : 'bg-gray-300'}`;
        indicatorContainer.appendChild(dot);
    }
}

function applyBranding() {
    const { primary, dark, accent } = state.settings.branding;
    const root = D.documentElement;
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--dark', dark);
    root.style.setProperty('--accent', accent);
    G('header-title').innerText = state.settings.company.name;
    G('header-logo').src = state.settings.company.logo;
}

function renderCustomerForm() {
    const form = G('customer-form');
    form.innerHTML = '';
    state.settings.customerFields.forEach(field => {
        if (!field.enabled) return;
        const div = D.createElement('div');
        let inputHtml = '';
        if (field.type === 'select') {
            inputHtml = `<select id="customer-${field.id}" name="${field.id}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" ${field.required ? 'required' : ''}>
                ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>`;
        } else {
            inputHtml = `<input type="${field.type}" id="customer-${field.id}" name="${field.id}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" ${field.required ? 'required' : ''}>`;
        }
        div.innerHTML = `<label for="customer-${field.id}" class="block text-sm font-medium">${field.label}${field.required ? ' <span class="text-red-500">*</span>' : ''}</label>${inputHtml}`;
        form.appendChild(div);
        const input = G(`customer-${field.id}`);
        if (state.survey.customer[field.id]) {
            input.value = state.survey.customer[field.id];
        }
        input.addEventListener('input', (e) => {
            state.survey.customer[e.target.name] = e.target.value;
            saveDraft();
        });
    });
}

function renderItemPresets() {
    const container = G('item-presets');
    container.innerHTML = '';
    state.settings.itemPresets.forEach(preset => {
        const btn = D.createElement('button');
        btn.className = 'bg-gray-200 text-sm p-2 rounded-md hover:bg-gray-300';
        btn.innerHTML = `<i class="lucide-box mr-1"></i> ${preset.name}`;
        btn.onclick = () => {
            addItem({ name: preset.name, qty: 1, l: preset.l, w: preset.w, h: preset.h, unit: 'cm' });
        };
        container.appendChild(btn);
    });
}

function calculateCBM(l, w, h, unit) {
    if (unit === 'in') {
        l *= 2.54; w *= 2.54; h *= 2.54;
    }
    return (l * w * h) / 1000000;
}

function addItem(itemData) {
    const cbmPerUnit = calculateCBM(itemData.l, itemData.w, itemData.h, itemData.unit);
    state.survey.items.push({
        ...itemData,
        id: `item-${Date.now()}`,
        cbmPerUnit,
        totalCBM: cbmPerUnit * itemData.qty,
    });
    renderItemsTable();
    saveDraft();
}

function renderItemsTable() {
    const tbody = G('items-table').querySelector('tbody');
    tbody.innerHTML = '';
    let totalCBM = 0;
    state.survey.items.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="py-2 px-4">${item.name}</td>
            <td class="py-2 px-4"><input type="number" value="${item.qty}" min="1" class="w-16 border-gray-300 rounded" data-item-id="${item.id}"></td>
            <td class="py-2 px-4">${item.cbmPerUnit.toFixed(3)}</td>
            <td class="py-2 px-4">${(item.cbmPerUnit * item.qty).toFixed(3)}</td>
            <td class="py-2 px-4"><button data-delete-id="${item.id}" class="text-red-500 hover:text-red-700"><i class="lucide-trash-2"></i></button></td>
        `;
        totalCBM += item.cbmPerUnit * item.qty;
    });
    state.survey.totals.cbm = totalCBM;
    updateFooter();
}

function updateFooter() {
    G('footer-total-cbm').textContent = (state.survey.totals.cbm || 0).toFixed(3);
    G('footer-grand-total').textContent = `${(state.survey.pricing?.grandTotal || 0).toFixed(2)} ${state.settings.rates.currency}`;
}

function calculateContainerPlan() {
    const containerDiv = G('container-options');
    containerDiv.innerHTML = '';
    const totalCbm = state.survey.totals.cbm;
    G('container-total-cbm').textContent = totalCbm.toFixed(3);
    
    let bestOption = null;

    state.settings.containers.forEach(cont => {
        const effectiveCapacity = cont.capacity * cont.efficiency;
        const utilization = (totalCbm / effectiveCapacity) * 100;
        const containersNeeded = Math.ceil(totalCbm / effectiveCapacity);
        
        if (containersNeeded === 1 && (!bestOption || cont.capacity < bestOption.capacity)) {
            bestOption = cont.type;
        }

        const card = D.createElement('div');
        card.className = 'border rounded-lg p-4 cursor-pointer hover:border-primary';
        card.dataset.containerType = cont.type;
        card.innerHTML = `
            <h3 class="font-bold flex items-center gap-2"><i class="lucide-truck"></i> ${cont.type}</h3>
            <p class="text-sm text-gray-600">Capacity: ${cont.capacity.toFixed(2)} CBM</p>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${Math.min(utilization, 100)}%"></div>
            </div>
            <p class="text-sm mt-1">Utilization: ${utilization.toFixed(1)}%</p>
            ${containersNeeded > 1 ? `<p class="text-sm text-red-500">Requires: ${containersNeeded} containers</p>`: ''}
        `;
        containerDiv.appendChild(card);
    });
    
    if(bestOption) {
        state.survey.containerPlan = { recommended: bestOption };
    }
    if(state.survey.containerPlan?.selected) {
         D.querySelector(`[data-container-type="${state.survey.containerPlan.selected}"]`)?.classList.add('border-primary', 'ring-2', 'ring-primary');
    } else if (bestOption) {
        D.querySelector(`[data-container-type="${bestOption}"]`)?.classList.add('border-accent');
    }
}

function calculatePricing() {
    const breakdownDiv = G('pricing-breakdown');
    const { rates } = state.settings;
    const { totals, customer } = state.survey;
    const moveType = customer.moveType || 'Local';
    
    const cbmCost = Math.max(totals.cbm * (rates.cbmRates[moveType] || 0), rates.minCharge);
    const subtotal = cbmCost + rates.materials + rates.labor + rates.surcharges;
    const insurance = subtotal * (rates.insurancePercent / 100);
    const markup = subtotal * (rates.markupPercent / 100);
    const totalBeforeVat = subtotal + insurance + markup;
    const vat = totalBeforeVat * (rates.vatPercent / 100);
    const grandTotal = totalBeforeVat + vat;
    
    state.survey.pricing = { cbmCost, subtotal, insurance, markup, vat, grandTotal, currency: rates.currency };

    breakdownDiv.innerHTML = `
        <div class="flex justify-between py-2 border-b"><span>CBM Cost (${moveType}):</span> <span>${cbmCost.toFixed(2)}</span></div>
        <div class="flex justify-between py-2 border-b"><span>Materials:</span> <span>${rates.materials.toFixed(2)}</span></div>
        <div class="flex justify-between py-2 border-b"><span>Labor:</span> <span>${rates.labor.toFixed(2)}</span></div>
        <div class="flex justify-between py-2 border-b"><span>Surcharges:</span> <span>${rates.surcharges.toFixed(2)}</span></div>
        <div class="flex justify-between py-2 border-b font-bold"><span>Subtotal:</span> <span>${subtotal.toFixed(2)}</span></div>
        <div class="flex justify-between py-2 border-b"><span>Insurance (${rates.insurancePercent}%):</span> <span>${insurance.toFixed(2)}</span></div>
         <div class="flex justify-between py-2 border-b"><span>Markup (${rates.markupPercent}%):</span> <span>${markup.toFixed(2)}</span></div>
        <div class="flex justify-between py-2 border-b"><span>VAT (${rates.vatPercent}%):</span> <span>${vat.toFixed(2)}</span></div>
        <div class="flex justify-between pt-4 font-bold text-xl text-primary"><span>Grand Total:</span> <span>${grandTotal.toFixed(2)} ${rates.currency}</span></div>
    `;
    updateFooter();
}

function setupReview() {
    const reviewDiv = G('review-summary');
    const { customer, totals, pricing, containerPlan, media } = state.survey;
    
    let photoHtml = '<p>No photos captured.</p>';
    if (media.photos && media.photos.length > 0) {
        photoHtml = media.photos.map(p => `<img src="${p.dataUrl}" class="w-16 h-16 object-cover rounded">`).join('');
    }
    
    let signatureHtml = '<p>No signature captured.</p>';
    if(media.signature) {
        signatureHtml = `<img src="${media.signature}" class="border bg-gray-100 rounded mix-blend-darken">`;
    }

    reviewDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="border p-4 rounded-lg"><h4 class="font-bold mb-2">Customer</h4><p>${customer.name || ''}</p><p>${customer.phone || ''}</p></div>
            <div class="border p-4 rounded-lg"><h4 class="font-bold mb-2">Move Details</h4><p>From: ${customer.pickupAddress || ''}</p><p>To: ${customer.destinationAddress || ''}</p><p>Type: ${customer.moveType || ''}</p></div>
        </div>
         <div class="border p-4 rounded-lg mt-4"><h4 class="font-bold mb-2">Summary</h4><p>Total CBM: ${totals.cbm.toFixed(3)}</p><p>Container: ${containerPlan?.selected || containerPlan?.recommended || 'N/A'}</p></div>
        <div class="border p-4 rounded-lg mt-4"><h4 class="font-bold mb-2">Pricing</h4><p class="text-primary text-lg">Grand Total: ${pricing?.grandTotal.toFixed(2) || 'N/A'} ${pricing?.currency || ''}</p></div>
        <div class="border p-4 rounded-lg mt-4"><h4 class="font-bold mb-2">Photos</h4><div class="flex gap-2 flex-wrap">${photoHtml}</div></div>
        <div class="border p-4 rounded-lg mt-4"><h4 class="font-bold mb-2">Signature</h4><div>${signatureHtml}</div></div>
    `;
}

function saveDraft() {
    localStorage.setItem('currentSurvey', JSON.stringify(state.survey));
}

function setupEventListeners() {
    // New Survey
    G('new-survey-btn').addEventListener('click', startNewSurvey);

    // Navigation
    G('next-btn').addEventListener('click', () => {
        if (state.currentStep < state.totalSteps) {
            if(state.currentStep === 2) calculateContainerPlan();
            if(state.currentStep === 3) calculatePricing();
            if(state.currentStep === 5) setupReview();
            state.currentStep++;
            updateUI();
        }
    });
    G('prev-btn').addEventListener('click', () => {
        if (state.currentStep > 1) {
            state.currentStep--;
            updateUI();
        }
    });
    
    // Item Form
    G('add-item-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addItem({
            name: G('item-name').value,
            qty: parseInt(G('item-qty').value),
            l: parseFloat(G('item-l').value),
            w: parseFloat(G('item-w').value),
            h: parseFloat(G('item-h').value),
            unit: G('item-unit').value
        });
        e.target.reset();
        G('item-name').focus();
    });

    // Items Table Delegation
    G('items-table').addEventListener('change', (e) => {
        if(e.target.matches('input[data-item-id]')) {
            const itemId = e.target.dataset.itemId;
            const newQty = parseInt(e.target.value);
            const item = state.survey.items.find(i => i.id === itemId);
            if(item) {
                item.qty = newQty;
                renderItemsTable();
                saveDraft();
            }
        }
    });
     G('items-table').addEventListener('click', (e) => {
        if(e.target.closest('button[data-delete-id]')) {
            const itemId = e.target.closest('button[data-delete-id]').dataset.deleteId;
            state.survey.items = state.survey.items.filter(i => i.id !== itemId);
            renderItemsTable();
            saveDraft();
        }
    });

    // Container Selection
    G('container-options').addEventListener('click', e => {
        const card = e.target.closest('[data-container-type]');
        if(card) {
            D.querySelectorAll('[data-container-type]').forEach(c => c.classList.remove('border-primary', 'ring-2', 'ring-primary'));
            card.classList.add('border-primary', 'ring-2', 'ring-primary');
            if(!state.survey.containerPlan) state.survey.containerPlan = {};
            state.survey.containerPlan.selected = card.dataset.containerType;
            saveDraft();
        }
    });
    
    // Photo upload
    const photoInput = G('photo-upload');
    photoInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = D.createElement('canvas');
                    const MAX_DIM = 800;
                    let { width, height } = img;
                    if (width > height) {
                        if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
                    } else {
                        if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    state.survey.media.photos.push({id: `photo-${Date.now()}`, dataUrl});
                    renderPhotos();
                    saveDraft();
                }
            };
            reader.readAsDataURL(file);
        });
    });

    
     G('photos-preview').addEventListener('click', e => {
        const btn = e.target.closest('[data-photo-id]');
        if(btn) {
            state.survey.media.photos = state.survey.media.photos.filter(p => p.id !== btn.dataset.photoId);
            renderPhotos();
            saveDraft();
        }
    });

    // Signature Pad
    const canvas = G('signature-pad');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX || evt.touches[0].clientX) - rect.left,
            y: (evt.clientY || evt.touches[0].clientY) - rect.top
        };
    }
    function startDrawing(e) { drawing = true; draw(e); }
    function stopDrawing() { 
        drawing = false; 
        ctx.beginPath(); 
        state.survey.media.signature = canvas.toDataURL();
        saveDraft();
    }
    function draw(e) {
        e.preventDefault();
        if (!drawing) return;
        const pos = getMousePos(canvas, e);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111827';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchmove', draw);
    G('clear-signature').addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        state.survey.media.signature = null;
        saveDraft();
    });

    // Editor Mode
    G('editor-mode-btn').addEventListener('click', () => G('passcode-modal').style.display = 'flex');
    G('passcode-cancel').addEventListener('click', () => G('passcode-modal').style.display = 'none');
    G('passcode-submit').addEventListener('click', () => {
        if (G('passcode-input').value === '1234') {
            G('passcode-modal').style.display = 'none';
            G('passcode-input').value = '';
            G('editor-modal').style.display = 'flex';
            renderEditor('editor-company');
        } else {
            alert('Incorrect passcode');
        }
    });
    G('close-editor-btn').addEventListener('click', () => G('editor-modal').style.display = 'none');
    G('editor-tabs').addEventListener('click', e => {
        if(e.target.matches('.editor-tab-btn')) {
            renderEditor(e.target.dataset.tab);
        }
    });

    G('save-survey-btn').addEventListener('click', saveSurveyToFirestore);
}

function renderPhotos() {
    const preview = G('photos-preview');
    preview.innerHTML = '';
    state.survey.media.photos.forEach(photo => {
        const div = D.createElement('div');
        div.className = 'relative group';
        div.innerHTML = `
            <img src="${photo.dataUrl}" class="w-full h-24 object-cover rounded-md">
            <button data-photo-id="${photo.id}" class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><i class="lucide-trash-2 w-4 h-4"></i></button>
        `;
        preview.appendChild(div);
    });
}

async function saveSurveyToFirestore() {
    const btn = G('save-survey-btn');
    const statusDiv = G('save-status');

    if (!state.firebase.db) {
        alert('Firebase is not configured. Please add your Firebase config in Editor Mode.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="lucide-loader-2 animate-spin mr-2"></i>Saving...`;
    statusDiv.textContent = 'Saving survey to Firebase...';

    try {
        const surveyToSave = JSON.parse(JSON.stringify(state.survey)); // Deep copy
        surveyToSave.meta.savedAt = new Date().toISOString();
        
        await state.firebase.db.collection('surveys').doc(surveyToSave.id).set(surveyToSave);

        statusDiv.textContent = `Survey saved successfully to Firebase with ID: ${surveyToSave.id}`;
        alert(`Survey saved successfully with ID: ${surveyToSave.id}`);

        // Start a new survey after successful save
        startNewSurvey();

    } catch (error) {
        console.error('Error saving survey to Firebase:', error);
        statusDiv.textContent = `Error: ${error.message}`;
        alert(`Failed to save survey. ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="lucide-save mr-2"></i>Save Survey`;
    }
}

function renderEditor(tabId) {
    D.querySelectorAll('.editor-tab-btn').forEach(btn => btn.classList.remove('bg-gray-200'));
    D.querySelector(`.editor-tab-btn[data-tab="${tabId}"]`).classList.add('bg-gray-200');

    const content = G('editor-content');
    content.innerHTML = ''; // Clear previous content
    
    const createInput = (label, settingPath, value, type = 'text') => `<div><label class="block text-sm font-medium mb-1">${label}</label><input type="${type}" step="any" class="w-full border-gray-300 rounded" data-setting="${settingPath}" value="${value}"></div>`;
    const createTextarea = (label, settingPath, value) => `<div><label class="block text-sm font-medium mb-1">${label}</label><textarea class="w-full border-gray-300 rounded" rows="3" data-setting="${settingPath}">${value}</textarea></div>`;

    switch (tabId) {
        case 'editor-company':
            content.innerHTML = `
                <h3 class="text-xl font-bold mb-4">Company Info</h3>
                <div class="space-y-4">
                    ${createInput('Company Name', 'company.name', state.settings.company.name)}
                    ${createInput('Address', 'company.address', state.settings.company.address)}
                    ${createInput('Phone', 'company.phone', state.settings.company.phone)}
                    ${createInput('Email', 'company.email', state.settings.company.email)}
                    ${createTextarea('Logo URL (or Data URL)', 'company.logo', state.settings.company.logo)}
                </div>`;
            break;
        case 'editor-rates':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Rates & Pricing</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${createInput('Currency', 'rates.currency', state.settings.rates.currency)}
                    ${createInput('Min Charge', 'rates.minCharge', state.settings.rates.minCharge, 'number')}
                    ${createInput('CBM Rate (Local)', 'rates.cbmRates.Local', state.settings.rates.cbmRates.Local, 'number')}
                    ${createInput('CBM Rate (GCC)', 'rates.cbmRates.GCC', state.settings.rates.cbmRates.GCC, 'number')}
                    ${createInput('CBM Rate (Int\'l)', 'rates.cbmRates.International', state.settings.rates.cbmRates.International, 'number')}
                    ${createInput('Materials Cost', 'rates.materials', state.settings.rates.materials, 'number')}
                    ${createInput('Labor Cost', 'rates.labor', state.settings.rates.labor, 'number')}
                    ${createInput('Surcharges', 'rates.surcharges', state.settings.rates.surcharges, 'number')}
                    ${createInput('Insurance %', 'rates.insurancePercent', state.settings.rates.insurancePercent, 'number')}
                    ${createInput('VAT %', 'rates.vatPercent', state.settings.rates.vatPercent, 'number')}
                    ${createInput('Markup %', 'rates.markupPercent', state.settings.rates.markupPercent, 'number')}
                </div>`;
            break;
        case 'editor-presets':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Item Presets</h3><div id="presets-editor-list" class="space-y-2"></div><button id="add-preset-btn" class="mt-4 bg-gray-200 p-2 rounded">Add Preset</button>`;
            const presetsList = G('presets-editor-list');
            state.settings.itemPresets.forEach((p, i) => {
                presetsList.innerHTML += `<div class="grid grid-cols-5 gap-2 items-center border p-2 rounded">
                    <input class="col-span-2 border-gray-300 rounded" data-setting="itemPresets.${i}.name" value="${p.name}">
                    <input type="number" class="border-gray-300 rounded" data-setting="itemPresets.${i}.l" value="${p.l}" placeholder="L">
                    <input type="number" class="border-gray-300 rounded" data-setting="itemPresets.${i}.w" value="${p.w}" placeholder="W">
                    <input type="number" class="border-gray-300 rounded" data-setting="itemPresets.${i}.h" value="${p.h}" placeholder="H">
                    <button class="text-red-500 hover:text-red-700" data-delete-preset="${i}"><i class="lucide-trash-2"></i></button>
                </div>`;
            });
            G('add-preset-btn').onclick = () => {
                state.settings.itemPresets.push({ name: 'New Item', l: 10, w: 10, h: 10 });
                renderEditor(tabId);
            };
            presetsList.addEventListener('click', e => {
               if (e.target.closest('[data-delete-preset]')) {
                   const index = e.target.closest('[data-delete-preset]').dataset.deletePreset;
                   state.settings.itemPresets.splice(index, 1);
                   renderEditor(tabId); // Re-render to reflect deletion
               }
            });
            break;
        case 'editor-fields':
             content.innerHTML = `<h3 class="text-xl font-bold mb-4">Customer Form Fields</h3><p class="text-sm mb-4 text-gray-600">Drag to reorder. Uncheck to disable.</p><div id="fields-editor-list" class="space-y-2"></div>`;
             const fieldsList = G('fields-editor-list');
             state.settings.customerFields.forEach((f, i) => {
                 fieldsList.innerHTML += `<div class="flex items-center gap-2 border p-2 rounded bg-white">
                     <i class="lucide-grip-vertical cursor-move"></i>
                     <input type="checkbox" class="h-4 w-4 rounded border-gray-300" data-setting="customerFields.${i}.enabled" ${f.enabled ? 'checked' : ''}>
                     <input class="flex-grow border-gray-300 rounded" data-setting="customerFields.${i}.label" value="${f.label}">
                 </div>`;
             });
             break;
         case 'editor-containers':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Containers</h3><div id="containers-editor-list" class="space-y-2"></div>`;
            const contsList = G('containers-editor-list');
            state.settings.containers.forEach((c, i) => {
                contsList.innerHTML += `<div class="grid grid-cols-3 gap-2 items-center border p-2 rounded">
                    <input class="border-gray-300 rounded" data-setting="containers.${i}.type" value="${c.type}">
                    <input type="number" class="border-gray-300 rounded" data-setting="containers.${i}.capacity" value="${c.capacity}" placeholder="Capacity (CBM)">
                    <input type="number" class="border-gray-300 rounded" data-setting="containers.${i}.efficiency" value="${c.efficiency}" placeholder="Efficiency">
                </div>`;
            });
            break;
        case 'editor-templates':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Templates</h3>
                <div class="space-y-4">
                    ${createTextarea('PDF Terms & Conditions', 'templates.pdfTerms', state.settings.templates.pdfTerms)}
                    ${createTextarea('WhatsApp Message', 'templates.whatsapp', state.settings.templates.whatsapp)}
                    <p class="text-xs text-gray-500">Use placeholders like {{customerName}}, {{grandTotal}}, {{currency}}, {{companyName}}.</p>
                </div>`;
            break;
        case 'editor-firebase':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Firebase Configuration</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block mb-1 font-medium">Firebase Config (JSON)</label>
                        <div class="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 mb-4">
                          <h4 class="font-bold">How to get the config:</h4>
                          <ol class="list-decimal list-inside">
                              <li>Go to your Firebase project: <a href="https://console.firebase.google.com" target="_blank" class="underline">console.firebase.google.com</a></li>
                              <li>Click the <strong>Project Overview</strong> settings gear <i class="lucide-settings text-xs"></i> icon, then select <strong>Project settings</strong>.</li>
                              <li>In the "Your apps" card, select the web app.</li>
                              <li>Select <strong>Config</strong>, then copy the JSON object.</li>
                          </ol>
                        </div>
                        <textarea id="firebase-config-input" class="w-full border-gray-300 rounded h-48 font-mono text-sm">${JSON.stringify(state.settings.firebaseConfig, null, 2) || ''}</textarea>
                        <p class="text-xs text-gray-500 mt-1">This is saved in your browser. You only need to set it once.</p>
                    </div>
                    <button id="save-firebase-config" class="bg-primary text-white p-2 rounded">Save & Re-initialize Firebase</button>
                     <h4 class="font-bold pt-4">Manage App Settings</h4>
                    <div class="flex gap-2">
                        <button id="export-settings" class="bg-blue-500 text-white p-2 rounded">Export JSON</button>
                        <button onclick="G('import-settings-input').click()" class="bg-gray-200 p-2 rounded">Import JSON</button>
                        <input type="file" id="import-settings-input" class="hidden" accept=".json">
                    </div>
                </div>`;
            G('save-firebase-config').addEventListener('click', () => {
                 try {
                    const configStr = G('firebase-config-input').value;
                    if (!configStr) {
                        state.settings.firebaseConfig = null;
                    } else {
                        state.settings.firebaseConfig = JSON.parse(configStr);
                    }
                    saveAndApplySettings();
                    // Force re-initialization
                    state.firebase.app = null; 
                    initFirebase();
                    alert("Firebase configuration saved. The app will now use the new settings.");
                 } catch(e) {
                     console.error(e);
                     alert("Invalid Firebase config. Please paste the config JSON object directly.");
                 }
            });
            G('export-settings').addEventListener('click', () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.settings, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "qgo-cargo-settings.json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            });
            G('import-settings-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            state.settings = JSON.parse(ev.target.result);
                            saveAndApplySettings();
                            // Re-render all parts of the app that depend on settings
                            init();
                            renderEditor(tabId); // re-render editor view
                            alert('Settings imported successfully!');
                        } catch (err) {
                            alert('Invalid JSON file.');
                        }
                    };
                    reader.readAsText(file);
                }
            });
            break;
         default:
            content.innerHTML = `<p>This editor section is under construction.</p>`;
    }
    
    // Generic event listener for all setting inputs
    content.querySelectorAll('input[data-setting], textarea[data-setting]').forEach(input => {
        input.addEventListener('change', (e) => {
            const keys = e.target.dataset.setting.split('.');
            let settingObj = state.settings;
            keys.slice(0, -1).forEach(key => {
                settingObj = settingObj[key] = settingObj[key] || {};
            });
            
            let value;
            if(e.target.type === 'number') {
                value = parseFloat(e.target.value);
            } else if (e.target.type === 'checkbox') {
                value = e.target.checked;
            } else {
                value = e.target.value;
            }
            settingObj[keys.pop()] = value;
            
            saveAndApplySettings();
            
            // Re-render relevant parts of the main app UI
            if(keys.includes('itemPresets')) renderItemPresets();
            if(keys.includes('customerFields')) renderCustomerForm();

        });
    });
}

function saveAndApplySettings() {
    localStorage.setItem('surveyAppSettings', JSON.stringify(state.settings));
    applyBranding();
    // Re-render things that depend on settings
    renderCustomerForm();
    renderItemPresets();
}

document.addEventListener('DOMContentLoaded', init);

    