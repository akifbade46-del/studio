
const D = document;
const G = (id) => D.getElementById(id);

const state = {
    currentStep: 1,
    totalSteps: 6,
    survey: {},
    settings: {},
    firebase: { app: null, db: null, storage: null },
    surveysCache: [], // To cache loaded surveys
};

const defaultSettings = {
    company: { name: "Q'go Cargo", address: "123 Cargo Lane, Kuwait City, Kuwait", phone: "+965 1234 5678", email: "contact@qgocargo.com", logo: "https://qgocargo.com/logo.png" },
    customerFields: [
        { id: 'name', label: 'Customer Name', type: 'text', required: true, enabled: true },
        { id: 'phone', label: 'Phone', type: 'tel', required: true, enabled: true },
        { id: 'email', label: 'Email', type: 'email', required: false, enabled: true },
        { id: 'pickupAddress', label: 'Pickup Address', type: 'text', required: true, enabled: true },
        { id: 'destinationAddress', label: 'Destination Address', type: 'text', required: true, enabled: true },
        { id: 'surveyDate', label: 'Survey Date', type: 'datetime-local', required: true, enabled: true },
    ],
    itemPresets: [
        // Boxes
        { name: 'Carton S', l: 45, w: 45, h: 45, category: 'Boxes' },
        { name: 'Carton M', l: 60, w: 60, h: 60, category: 'Boxes' },
        { name: 'Carton L', l: 75, w: 75, h: 75, category: 'Boxes' },
        { name: 'Wardrobe Box', l: 50, w: 50, h: 120, category: 'Boxes' },

        // Kitchen
        { name: 'Refrigerator', l: 80, w: 80, h: 180, category: 'Kitchen' },
        { name: 'Washing Machine', l: 60, w: 60, h: 85, category: 'Kitchen' },
        { name: 'Dishwasher', l: 60, w: 60, h: 85, category: 'Kitchen' },
        { name: 'Microwave', l: 50, w: 40, h: 30, category: 'Kitchen' },

        // Furniture
        { name: 'Sofa 3-seater', l: 200, w: 90, h: 80, category: 'Furniture'},
        { name: 'Armchair', l: 90, w: 90, h: 80, category: 'Furniture' },
        { name: 'Coffee Table', l: 120, w: 60, h: 45, category: 'Furniture' },
    ],
    containers: [
        { type: '20ft', capacity: 33.2, efficiency: 0.85 },
        { type: '40ft', capacity: 67.7, efficiency: 0.85 },
        { type: '40HC', capacity: 76.0, efficiency: 0.85 },
    ],
    rates: {
        currency: 'KWD',
        cbmRates: { 'Local': 15, 'GCC': 25, 'International Sea': 40, 'International Air': 80 },
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

const hardcodedFirebaseConfig = {
      apiKey: "AIzaSyAdXAZ_-I6Fg3Sn9bY8wPFpQ-NlrKNy6LU",
      authDomain: "survey-bf41d.firebaseapp.com",
      projectId: "survey-bf41d",
      storageBucket: "survey-bf41d.appspot.com",
      messagingSenderId: "869329094353",
      appId: "1:869329094353:web:2692f2ad3db106a95827f0",
      measurementId: "G-GEFSXECYMQ"
};

function init() {
    state.settings = JSON.parse(localStorage.getItem('surveyAppSettings')) || defaultSettings;
    
    // Set logos from settings
    G('header-logo').src = state.settings.company.logo;
    D.querySelector('#login-screen img').src = state.settings.company.logo;

    initFirebase();
    
    const savedSurvey = localStorage.getItem('currentSurvey');
    if (savedSurvey) {
        state.survey = JSON.parse(savedSurvey);
    } else {
        state.survey = createNewSurvey();
    }
    
    updateUI();
    setupEventListeners();
    renderCustomerForm();
    renderItemPresets();
    renderItemsTable();
    updateFooter();
    renderPhotos();
    registerServiceWorker();
}

function initFirebase() {
    if (hardcodedFirebaseConfig && !firebase.apps.length) {
        try {
            state.firebase.app = firebase.initializeApp(hardcodedFirebaseConfig);
            state.firebase.db = firebase.firestore();
            state.firebase.storage = firebase.storage();
            console.log("Firebase initialized successfully.");
        } catch (e) {
            console.error("Could not initialize Firebase. Check your config.", e);
            alert("Could not initialize Firebase. Please check your configuration in the Editor.");
        }
    }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
}

function createNewSurvey() {
    return {
        id: `survey-${new Date().toISOString()}-${Math.random().toString(36).substr(2, 9)}`,
        meta: { createdAt: new Date().toISOString() },
        customer: { surveyDate: new Date().toISOString().slice(0, 16), moveType: 'Local' }, // Default moveType
        items: [],
        totals: { cbm: 0 },
        media: { photos: [], signature: null }
    };
}

function startNewSurvey() {
    if (Object.keys(state.survey.customer).length > 2 || state.survey.items.length > 0) { // Check if it's not a fresh survey
        if (!confirm('Are you sure you want to start a new survey? Any unsaved data will be lost.')) {
            return;
        }
    }
    localStorage.removeItem('currentSurvey');
    state.survey = createNewSurvey();
    state.currentStep = 1;
    
    updateUI();
    renderCustomerForm();
    renderItemPresets();
    renderItemsTable();
    updateFooter();
    renderPhotos();
    
    const canvas = G('signature-pad');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    G('save-status').textContent = 'New survey started.';
    // Reset save button in case it was left in a 'Saved' state
    const saveBtn = G('save-survey-btn');
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="lucide-save mr-2"></i>Save Survey`;
    saveBtn.classList.remove('bg-green-500');
    saveBtn.classList.add('bg-orange-accent');
}

function loadSurvey(surveyData) {
    if (confirm('Loading this survey will overwrite any current unsaved data. Continue?')) {
        state.survey = surveyData;
        state.currentStep = 1;
        saveDraft(); 
        
        updateUI();
        renderCustomerForm();
        renderItemPresets();
        renderItemsTable();
        updateFooter();
        renderPhotos();
        calculateContainerPlan();
        calculatePricing();
        G('load-survey-modal').style.display = 'none';
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
        dot.className = `w-3 h-3 rounded-full ${i === state.currentStep ? 'bg-blue-600' : 'bg-gray-300'}`;
        indicatorContainer.appendChild(dot);
    }
}

function renderCustomerForm() {
    const form = G('customer-form');
    form.innerHTML = '';
    state.settings.customerFields.forEach(field => {
        if (!field.enabled) return;
        const div = D.createElement('div');
        let inputHtml = '';
        if (field.type === 'select') {
            inputHtml = `<select id="customer-${field.id}" name="${field.id}" class="mt-1 block w-full" ${field.required ? 'required' : ''}>
                ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>`;
        } else {
            inputHtml = `<input type="${field.type}" id="customer-${field.id}" name="${field.id}" class="mt-1 block w-full" ${field.required ? 'required' : ''}>`;
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
    renderMoveTypeSelector();
}

function renderMoveTypeSelector() {
    const container = G('move-type-visual-selector');
    container.innerHTML = '';
    const moveTypes = [
        { id: 'Local', label: 'Local/GCC', icon: 'truck' },
        { id: 'International Sea', label: 'Sea Freight', icon: 'ship' },
        { id: 'International Air', label: 'Air Freight', icon: 'plane' },
    ];

    moveTypes.forEach(type => {
        const btn = D.createElement('button');
        btn.type = 'button';
        btn.className = 'flex items-center justify-center p-4 rounded-md move-type-btn';
        btn.dataset.moveType = type.id;
        btn.innerHTML = `<i class="lucide-${type.icon}"></i><span>${type.label}</span>`;
        
        if (state.survey.customer.moveType === type.id) {
            btn.classList.add('selected');
        }

        btn.addEventListener('click', () => {
            state.survey.customer.moveType = type.id;
            // Remove 'selected' from all buttons and add to the clicked one
            container.querySelectorAll('.move-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            saveDraft();
        });

        container.appendChild(btn);
    });
}


function renderItemPresets() {
    const container = G('item-presets');
    container.innerHTML = '';
    
    const groupedPresets = state.settings.itemPresets.reduce((acc, preset) => {
        const category = preset.category || 'General';
        if (!acc[category]) acc[category] = [];
        acc[category].push(preset);
        return acc;
    }, {});

    for (const category in groupedPresets) {
        const categoryWrapper = D.createElement('div');
        categoryWrapper.className = 'w-full mb-4';
        
        const categoryTitle = D.createElement('h3');
        categoryTitle.className = 'font-semibold mb-2 text-base';
        categoryTitle.textContent = category;
        categoryWrapper.appendChild(categoryTitle);

        const buttonContainer = D.createElement('div');
        buttonContainer.className = 'flex flex-wrap gap-2';

        groupedPresets[category].forEach(preset => {
            const btn = D.createElement('button');
            btn.className = 'text-sm p-2 rounded-md flex-grow md:flex-grow-0 bg-gray-200 border-transparent';
            btn.innerHTML = `<i class="lucide-box mr-1"></i> ${preset.name}`;
            btn.onclick = () => {
                addItem({ name: preset.name, qty: 1, l: preset.l, w: preset.w, h: preset.h, unit: 'cm' });
            };
            buttonContainer.appendChild(btn);
        });

        categoryWrapper.appendChild(buttonContainer);
        container.appendChild(categoryWrapper);
    }
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
            <td class="py-2 px-4"><input type="number" value="${item.qty}" min="1" class="w-16" data-item-id="${item.id}"></td>
            <td class="py-2 px-4">${item.cbmPerUnit.toFixed(3)}</td>
            <td class="py-2 px-4">${(item.cbmPerUnit * item.qty).toFixed(3)}</td>
            <td class="py-2 px-4"><button data-delete-id="${item.id}" class="text-red-500 hover:text-red-700 p-1"><i class="lucide-trash-2"></i></button></td>
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
        const utilization = totalCbm > 0 ? (totalCbm / effectiveCapacity) * 100 : 0;
        const containersNeeded = totalCbm > 0 ? Math.ceil(totalCbm / effectiveCapacity) : 0;
        
        if (containersNeeded === 1 && (!bestOption || cont.capacity < bestOption.capacity)) {
            bestOption = cont.type;
        }

        const card = D.createElement('div');
        card.className = 'border rounded-lg p-4 cursor-pointer hover:border-blue-500';
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
         D.querySelector(`[data-container-type="${state.survey.containerPlan.selected}"]`)?.classList.add('border-blue-500', 'ring-2', 'ring-blue-500');
    } else if (bestOption) {
        D.querySelector(`[data-container-type="${bestOption}"]`)?.classList.add('border-gray-300');
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
        <div class="flex justify-between pt-4 font-bold text-xl text-blue-600"><span>Grand Total:</span> <span>${grandTotal.toFixed(2)} ${rates.currency}</span></div>
    `;
    updateFooter();
}

function generateReceiptHtml(survey, type = 'customer') {
    const { company } = state.settings;
    const { id, customer, items, totals, pricing, media } = survey;

    const itemsHtml = items.map(item => `
        <tr>
            <td class="py-2 px-3 border-b">
                ${item.name}
                <span class="text-xs text-gray-500 block">(${item.l}x${item.w}x${item.h} ${item.unit || 'cm'})</span>
            </td>
            <td class="py-2 px-3 border-b text-center">${item.qty}</td>
            <td class="py-2 px-3 border-b text-right">${item.cbmPerUnit.toFixed(3)}</td>
            <td class="py-2 px-3 border-b text-right">${(item.cbmPerUnit * item.qty).toFixed(3)}</td>
        </tr>
    `).join('');

    const pricingRows = (pricing && type === 'office') ? [
        { label: `CBM Cost (${customer.moveType || 'N/A'})`, value: pricing.cbmCost },
        { label: 'Materials', value: state.settings.rates.materials },
        { label: 'Labor', value: state.settings.rates.labor },
        { label: 'Surcharges', value: state.settings.rates.surcharges },
        { label: 'Subtotal', value: pricing.subtotal, isBold: true, isTopBorder: true },
        { label: `Insurance (${state.settings.rates.insurancePercent}%)`, value: pricing.insurance },
        { label: `Markup (${state.settings.rates.markupPercent}%)`, value: pricing.markup },
        { label: `VAT (${state.settings.rates.vatPercent}%)`, value: pricing.vat },
        { label: 'Grand Total', value: pricing.grandTotal, isBold: true, isTopBorder: true, isLarge: true }
    ] : [];

    const pricingHtml = (pricing && type === 'office') ? `
        <h5 class="text-sm font-bold text-gray-700 mb-2 mt-6">Pricing Summary</h5>
        <div class="text-sm space-y-1">
            ${pricingRows.map(row => `
                <div class="flex justify-between py-1 ${row.isTopBorder ? 'border-t mt-1 pt-1' : ''} ${row.isBold ? 'font-bold' : ''} ${row.isLarge ? 'text-lg' : ''}">
                    <span>${row.label}:</span>
                    <span class="${row.isLarge ? 'text-blue-600' : ''}">${row.value.toFixed(2)} ${row.isLarge ? pricing.currency : ''}</span>
                </div>
            `).join('')}
        </div>
    ` : `
        <div class="mt-6 text-right">
            <div class="inline-block p-3 rounded-lg bg-gray-100">
                <h5 class="font-bold text-gray-600">Total Volume</h5>
                <p class="text-2xl font-bold">${totals.cbm.toFixed(3)} CBM</p>
            </div>
        </div>
    `;

    let photoHtml = '<p class="text-sm text-gray-500">No photos captured.</p>';
    if (media.photos && media.photos.length > 0) {
        photoHtml = `<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">${media.photos.map(p => `<img src="${p.dataUrl}" class="w-full h-20 object-cover rounded border cursor-pointer zoomable-photo" alt="Survey photo">`).join('')}</div>`;
    }

    let signatureHtml = '<p class="text-sm text-gray-500">No signature captured.</p>';
    if (media.signature) {
        signatureHtml = `<img src="${media.signature}" class="border bg-gray-100 rounded mix-blend-darken w-full h-full object-contain">`;
    }

    return `
        <div class="text-gray-800 text-sm">
            <!-- Header -->
            <div class="flex justify-between items-start pb-4 border-b">
                <img src="${company.logo}" alt="Company Logo" class="h-12">
                <div class="text-right">
                    <h4 class="text-lg font-bold">${type === 'office' ? 'QUOTATION (Office Copy)' : 'QUOTATION'}</h4>
                    <p><b>Quote #:</b> ${id.substring(id.length - 9)}</p>
                    <p><b>Date:</b> ${new Date(customer.surveyDate).toLocaleDateString()}</p>
                </div>
            </div>

            <!-- Customer & Company Info -->
            <div class="grid grid-cols-2 gap-4 py-4 border-b">
                <div>
                    <h5 class="font-bold text-gray-500 text-xs mb-1">BILL TO</h5>
                    <p class="font-bold">${customer.name || ''}</p>
                    <p>${customer.phone || ''}</p>
                    <p>${customer.email || ''}</p>
                </div>
                <div class="text-right">
                    <h5 class="font-bold text-gray-500 text-xs mb-1">COMPANY INFO</h5>
                    <p>${company.address.replace(/\n/g, ', ')}</p>
                    <p>Tel: ${company.phone} | Email: ${company.email}</p>
                </div>
            </div>
            
            <!-- Move Details -->
             <div class="grid grid-cols-2 gap-4 py-3 border-b">
                <div>
                    <p><b class="font-semibold text-gray-600">Pickup:</b> ${customer.pickupAddress || ''}</p>
                    <p><b class="font-semibold text-gray-600">Destination:</b> ${customer.destinationAddress || ''}</p>
                </div>
                <div class="text-right">
                    <p><b class="font-semibold text-gray-600">Move Type:</b> ${customer.moveType || ''}</p>
                </div>
             </div>

            <!-- Items Table -->
            <h5 class="text-sm font-bold text-gray-700 mt-6 mb-2">Itemized List</h5>
            <div class="overflow-x-auto border rounded-lg">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="py-2 px-3 text-left font-semibold">Item Description</th>
                            <th class="py-2 px-3 text-center font-semibold">Qty</th>
                            <th class="py-2 px-3 text-right font-semibold">CBM/Unit</th>
                            <th class="py-2 px-3 text-right font-semibold">Total CBM</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr class="font-bold bg-gray-50">
                            <td colspan="3" class="py-2 px-3 text-right">Total Volume:</td>
                            <td class="py-2 px-3 text-right">${totals.cbm.toFixed(3)} CBM</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <!-- Pricing or Customer CBM -->
            ${pricingHtml}
            
            <!-- Photos -->
            <div class="mt-8">
                <h5 class="text-sm font-bold text-gray-700 mb-2">Photos</h5>
                ${photoHtml}
            </div>

            <!-- Footer Section -->
            <div style="page-break-inside: avoid; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;" class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h5 class="text-sm font-bold text-gray-700 mb-2">Terms & Conditions</h5>
                    <p class="text-xs text-gray-600 whitespace-pre-wrap">${state.settings.templates.pdfTerms}</p>
                </div>
                <div>
                    <h5 class="text-sm font-bold text-gray-700 mb-2">Customer Signature</h5>
                    <div class="border rounded-md h-32 flex items-center justify-center bg-gray-50">${signatureHtml}</div>
                </div>
            </div>
        </div>
    `;
}


function setupReview() {
    const reviewDiv = G('review-summary');
    reviewDiv.innerHTML = generateReceiptHtml(state.survey, 'office');
}


function saveDraft() {
    localStorage.setItem('currentSurvey', JSON.stringify(state.survey));
}

function printReport(content) {
    const printWindow = window.open('', '', 'height=800,width=1000');
    printWindow.document.write('<html><head><title>Print Survey</title>');
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"><\/script>');
    printWindow.document.write('<style> body { font-family: sans-serif; } </style>');
    printWindow.document.write('</head><body class="text-sm">');
    printWindow.document.write('<div class="p-8">');
    printWindow.document.write(content);
    printWindow.document.write('</div>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => { 
        try {
            printWindow.print(); 
        } catch(e) {
            console.error("Print failed", e);
            printWindow.close();
        }
    }, 500);
}


function setupEventListeners() {
    // App Login
    G('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const password = G('login-password').value;
        if (password === 'qgoadmin') {
            G('login-screen').style.display = 'none';
        } else {
            alert('Incorrect Password. Please try again.');
        }
    });

    // New Survey
    G('new-survey-btn').addEventListener('click', startNewSurvey);

    // Navigation
    G('next-btn').addEventListener('click', () => {
        if (state.currentStep < state.totalSteps) {
            state.currentStep++;
            if (state.currentStep === 3) calculateContainerPlan();
            if (state.currentStep === 4) calculatePricing();
            if (state.currentStep === 6) setupReview();
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
            if(item && newQty > 0) {
                item.qty = newQty;
                renderItemsTable();
                saveDraft();
            }
        }
    });
     G('items-table').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('button[data-delete-id]');
        if(deleteBtn) {
            const itemId = deleteBtn.dataset.deleteId;
            state.survey.items = state.survey.items.filter(i => i.id !== itemId);
            renderItemsTable();
            saveDraft();
        }
    });

    // Container Selection
    G('container-options').addEventListener('click', e => {
        const card = e.target.closest('[data-container-type]');
        if(card) {
            D.querySelectorAll('[data-container-type]').forEach(c => c.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500'));
            card.classList.add('border-blue-500', 'ring-2', 'ring-blue-500');
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
        photoInput.value = ''; // Reset input to allow re-uploading the same file
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
    function getPos(canvasEl, event) {
        const rect = canvasEl.getBoundingClientRect();
        const evt = event.touches ? event.touches[0] : event;
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
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
        const pos = getPos(canvas, e);
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
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchmove', draw, { passive: false });
    
    G('clear-signature').addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        state.survey.media.signature = null;
        saveDraft();
    });

    // Editor Mode & Modals
    G('editor-mode-btn').addEventListener('click', () => G('passcode-modal').style.display = 'flex');
    G('close-passcode-btn').addEventListener('click', () => G('passcode-modal').style.display = 'none');
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

    // Step 6 Actions
    G('save-survey-btn').addEventListener('click', saveSurveyToFirestore);
    G('generate-customer-pdf-btn').addEventListener('click', () => {
        const customerReceipt = generateReceiptHtml(state.survey, 'customer');
        printReport(customerReceipt);
    });
    G('generate-office-pdf-btn').addEventListener('click', () => {
        const officeReceipt = generateReceiptHtml(state.survey, 'office');
        printReport(officeReceipt);
    });
    G('share-whatsapp-btn').addEventListener('click', shareToWhatsApp);


    // Load Survey
    G('load-survey-btn').addEventListener('click', showLoadSurveyModal);
    G('close-load-survey-btn').addEventListener('click', () => G('load-survey-modal').style.display = 'none');
    G('survey-search-input').addEventListener('input', (e) => {
        renderSurveyList(e.target.value);
    });


    // Preview Modal
    G('preview-close-btn').addEventListener('click', () => G('preview-modal').style.display = 'none');
    G('preview-print-customer-btn').addEventListener('click', () => {
        const surveyId = G('preview-modal').dataset.surveyId;
        const surveyData = state.surveysCache.find(s => s.id === surveyId);
        if (surveyData) {
            printReport(generateReceiptHtml(surveyData, 'customer'));
        }
    });
    G('preview-print-office-btn').addEventListener('click', () => {
         const surveyId = G('preview-modal').dataset.surveyId;
        const surveyData = state.surveysCache.find(s => s.id === surveyId);
        if (surveyData) {
            printReport(generateReceiptHtml(surveyData, 'office'));
        }
    });


    // Image Zoom Modal
    const zoomModal = G('image-zoom-modal');
    G('zoom-close-btn').addEventListener('click', () => zoomModal.style.display = 'none');
    zoomModal.addEventListener('click', () => zoomModal.style.display = 'none'); // Also close on clicking background
    D.body.addEventListener('click', e => {
        if(e.target.matches('.zoomable-photo')) {
            G('zoomed-image').src = e.target.src;
            zoomModal.style.display = 'flex';
        }
    });

}

function shareToWhatsApp() {
    const { customer, pricing } = state.survey;
    const { company } = state.settings;
    let template = state.settings.templates.whatsapp;

    if (!customer.phone) {
        alert("Please enter a customer phone number first.");
        return;
    }

    const replacements = {
        '{{customerName}}': customer.name || '',
        '{{grandTotal}}': (pricing?.grandTotal || 0).toFixed(2),
        '{{currency}}': pricing?.currency || '',
        '{{companyName}}': company.name || ''
    };
    
    for (const key in replacements) {
        template = template.replace(new RegExp(key, 'g'), replacements[key]);
    }
    
    const whatsappUrl = `https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(template)}`;
    window.open(whatsappUrl, '_blank');
}


function renderPhotos() {
    const preview = G('photos-preview');
    preview.innerHTML = '';
    state.survey.media.photos.forEach(photo => {
        const div = D.createElement('div');
        div.className = 'relative group';
        div.innerHTML = `
            <img src="${photo.dataUrl}" class="w-full h-24 object-cover rounded-md border cursor-pointer zoomable-photo">
            <button data-photo-id="${photo.id}" class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><i class="lucide-trash-2 w-4 h-4"></i></button>
        `;
        preview.appendChild(div);
    });
}

async function saveSurveyToFirestore() {
    const btn = G('save-survey-btn');
    const statusDiv = G('save-status');

    if (!state.firebase.db) {
        alert('Firebase is not configured. Please check your settings in the editor.');
        return;
    }
    if (!state.survey.customer.name) {
        alert('Please enter a customer name before saving.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="lucide-loader-2 animate-spin mr-2"></i>Saving...`;
    statusDiv.textContent = 'Saving survey to Firebase...';

    try {
        const surveyToSave = JSON.parse(JSON.stringify(state.survey));
        surveyToSave.meta.savedAt = new Date().toISOString();
        
        await state.firebase.db.collection('surveys').doc(surveyToSave.id).set(surveyToSave);

        // Success state
        G('success-sound').play();
        statusDiv.textContent = `Survey for ${surveyToSave.customer.name} saved successfully! ID: ${surveyToSave.id.substring(surveyToSave.id.length-6)}`;
        btn.innerHTML = `<i class="lucide-check mr-2"></i>Saved!`;
        btn.classList.remove('bg-orange-accent');
        btn.classList.add('bg-green-500');

        // Wait for 2 seconds then start a new survey
        setTimeout(() => {
            startNewSurvey();
        }, 2000);

    } catch (error) {
        console.error('Error saving survey to Firebase:', error);
        statusDiv.textContent = `Error: ${error.message}. Please check Firestore rules.`;
        alert(`Failed to save survey. Check the console and your Firestore rules. ${error.message}`);
        btn.disabled = false;
        btn.innerHTML = `<i class="lucide-save mr-2"></i>Save Survey`;
    }
}

function renderSurveyList(searchTerm = '') {
    const listDiv = G('load-survey-list');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filteredSurveys = state.surveysCache.filter(survey => {
        const customerName = (survey.customer?.name || '').toLowerCase();
        const surveyId = survey.id.toLowerCase();
        return customerName.includes(lowerCaseSearchTerm) || surveyId.includes(lowerCaseSearchTerm);
    });

    if (filteredSurveys.length === 0) {
        listDiv.innerHTML = '<p>No matching surveys found.</p>';
        return;
    }

    listDiv.innerHTML = '';
    filteredSurveys.forEach(survey => {
        const surveyDiv = D.createElement('div');
        surveyDiv.className = 'flex justify-between items-center p-2 border-b hover:bg-gray-100';
        surveyDiv.innerHTML = `
            <div>
                <p class="font-bold">${survey.customer?.name || 'No Name'}</p>
                <p class="text-sm text-gray-600">ID: ${survey.id.substring(survey.id.length - 9)}</p>
                <p class="text-sm text-gray-500">Date: ${new Date(survey.meta.createdAt).toLocaleString()}</p>
            </div>
            <div class="flex gap-2">
                <button class="preview-btn text-sm bg-gray-200 p-2 rounded" data-survey-id="${survey.id}">Preview</button>
                <button class="load-btn text-sm bg-blue-600 text-white p-2 rounded" data-survey-id="${survey.id}">Load</button>
            </div>
        `;
        listDiv.appendChild(surveyDiv);
    });
    
    // Re-attach event listeners for the newly created buttons
    listDiv.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const surveyId = e.target.dataset.surveyId;
            const surveyToPreview = state.surveysCache.find(s => s.id === surveyId);
            if (surveyToPreview) {
                showPreviewModal(surveyToPreview);
            }
        });
    });

    listDiv.querySelectorAll('.load-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const surveyId = e.target.dataset.surveyId;
            const surveyToLoad = state.surveysCache.find(s => s.id === surveyId);
            if (surveyToLoad) {
                loadSurvey(surveyToLoad);
            }
        });
    });
}


async function showLoadSurveyModal() {
    const modal = G('load-survey-modal');
    const listDiv = G('load-survey-list');
    listDiv.innerHTML = '<p class="text-center"><i class="lucide-loader-2 animate-spin inline-block"></i> Loading surveys...</p>';
    modal.style.display = 'flex';
    G('survey-search-input').value = '';


    if (!state.firebase.db) {
        listDiv.innerHTML = '<p class="text-red-500">Firebase is not configured.</p>';
        return;
    }

    try {
        const querySnapshot = await state.firebase.db.collection('surveys').orderBy('meta.createdAt', 'desc').limit(100).get();
        state.surveysCache = [];
        
        if (querySnapshot.empty) {
            listDiv.innerHTML = '<p>No saved surveys found.</p>';
            return;
        }

        querySnapshot.forEach(doc => {
            state.surveysCache.push(doc.data());
        });
        
        renderSurveyList(); // Initial render of the full list

    } catch (error) {
        console.error("Error loading surveys:", error);
        listDiv.innerHTML = `<p class="text-red-500">Could not load surveys. Error: ${error.message}</p><p class="text-sm text-gray-600 mt-2">You might need to create a composite index in Firestore for the 'surveys' collection on 'meta.createdAt' (descending).</p>`;
    }
}

function showPreviewModal(surveyData) {
    const modal = G('preview-modal');
    const contentDiv = G('preview-content');
    
    modal.dataset.surveyId = surveyData.id;
    contentDiv.innerHTML = generateReceiptHtml(surveyData, 'office');
    
    modal.style.display = 'flex';
}


function renderEditor(tabId) {
    D.querySelectorAll('.editor-tab-btn').forEach(btn => btn.classList.remove('bg-gray-200'));
    D.querySelector(`.editor-tab-btn[data-tab="${tabId}"]`).classList.add('bg-gray-200');

    const content = G('editor-content');
    content.innerHTML = '';
    
    const createInput = (label, settingPath, value, type = 'text') => `<div><label class="block text-sm font-medium mb-1">${label}</label><input type="${type}" step="any" class="w-full" data-setting="${settingPath}" value="${value}"></div>`;
    const createTextarea = (label, settingPath, value) => `<div><label class="block text-sm font-medium mb-1">${label}</label><textarea class="w-full" rows="3" data-setting="${settingPath}">${value}</textarea></div>`;

    switch (tabId) {
        case 'editor-company':
            content.innerHTML = `
                <h3 class="text-xl font-bold mb-4">Company Info</h3>
                <div class="space-y-4">
                    ${createInput('Company Name', 'company.name', state.settings.company.name)}
                    ${createTextarea('Address', 'company.address', state.settings.company.address)}
                    ${createInput('Phone', 'company.phone', state.settings.company.phone)}
                    ${createInput('Email', 'company.email', state.settings.company.email)}
                    ${createTextarea('Logo URL', 'company.logo', state.settings.company.logo)}
                </div>`;
            break;
        case 'editor-rates':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Rates &amp; Pricing</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${createInput('Currency', 'rates.currency', state.settings.rates.currency)}
                    ${createInput('Min Charge', 'rates.minCharge', state.settings.rates.minCharge, 'number')}
                    ${createInput('CBM Rate (Local/GCC)', 'rates.cbmRates.Local', state.settings.rates.cbmRates['Local'], 'number')}
                    ${createInput('CBM Rate (Sea)', 'rates.cbmRates.International Sea', state.settings.rates.cbmRates['International Sea'], 'number')}
                    ${createInput('CBM Rate (Air)', 'rates.cbmRates.International Air', state.settings.rates.cbmRates['International Air'], 'number')}
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
                presetsList.innerHTML += `<div class="grid grid-cols-6 gap-2 items-center border p-2 rounded">
                    <input class="col-span-2" data-setting="itemPresets.${i}.name" value="${p.name}">
                    <input class="col-span-2" data-setting="itemPresets.${i}.category" value="${p.category || ''}" placeholder="Category">
                    <input type="number" data-setting="itemPresets.${i}.l" value="${p.l}" placeholder="L">
                    <input type="number" data-setting="itemPresets.${i}.w" value="${p.w}" placeholder="W">
                    <input type="number" data-setting="itemPresets.${i}.h" value="${p.h}" placeholder="H">
                    <button class="text-red-500 hover:text-red-700" data-delete-preset="${i}"><i class="lucide-trash-2"></i></button>
                </div>`;
            });
            G('add-preset-btn').onclick = () => {
                state.settings.itemPresets.push({ name: 'New Item', category: 'General', l: 10, w: 10, h: 10 });
                renderEditor(tabId);
            };
            presetsList.addEventListener('click', e => {
               if (e.target.closest('[data-delete-preset]')) {
                   const index = e.target.closest('[data-delete-preset]').dataset.deletePreset;
                   state.settings.itemPresets.splice(index, 1);
                   renderEditor(tabId);
               }
            });
            break;
        case 'editor-fields':
             content.innerHTML = `<h3 class="text-xl font-bold mb-4">Customer Form Fields</h3><p class="text-sm mb-4 text-gray-600">Uncheck to disable a field.</p><div id="fields-editor-list" class="space-y-2"></div>`;
             const fieldsList = G('fields-editor-list');
             state.settings.customerFields.forEach((f, i) => {
                 fieldsList.innerHTML += `<div class="flex items-center gap-2 border p-2 rounded bg-white">
                     <input type="checkbox" class="h-4 w-4" data-setting="customerFields.${i}.enabled" ${f.enabled ? 'checked' : ''}>
                     <input class="flex-grow" data-setting="customerFields.${i}.label" value="${f.label}">
                 </div>`;
             });
             break;
         case 'editor-containers':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Containers</h3><div id="containers-editor-list" class="space-y-2"></div><button id="add-container-btn" class="mt-4 bg-gray-200 p-2 rounded">Add Container</button>`;
            const contsList = G('containers-editor-list');
            state.settings.containers.forEach((c, i) => {
                contsList.innerHTML += `<div class="grid grid-cols-4 gap-2 items-center border p-2 rounded">
                    <input data-setting="containers.${i}.type" value="${c.type}">
                    <input type="number" data-setting="containers.${i}.capacity" value="${c.capacity}" placeholder="CBM">
                    <input type="number" step="0.01" data-setting="containers.${i}.efficiency" value="${c.efficiency}" placeholder="Efficiency">
                     <button class="text-red-500 hover:text-red-700" data-delete-container="${i}"><i class="lucide-trash-2"></i></button>
                </div>`;
            });
             G('add-container-btn').onclick = () => {
                state.settings.containers.push({ type: 'New Container', capacity: 10, efficiency: 0.85 });
                renderEditor(tabId);
            };
            contsList.addEventListener('click', e => {
               if (e.target.closest('[data-delete-container]')) {
                   const index = e.target.closest('[data-delete-container]').dataset.deleteContainer;
                   state.settings.containers.splice(index, 1);
                   renderEditor(tabId);
               }
            });
            break;
        case 'editor-templates':
            content.innerHTML = `<h3 class="text-xl font-bold mb-4">Templates</h3>
                <div class="space-y-4">
                    ${createTextarea('PDF Terms &amp; Conditions', 'templates.pdfTerms', state.settings.templates.pdfTerms)}
                    ${createTextarea('WhatsApp Message', 'templates.whatsapp', state.settings.templates.whatsapp)}
                    <p class="text-xs text-gray-500">Use placeholders like {{customerName}}, {{grandTotal}}, {{currency}}, {{companyName}}.</p>
                </div>`;
            break;
        case 'editor-data':
             content.innerHTML = `<h3 class="text-xl font-bold mb-4">App Data Management</h3>
                <div class="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
                  <p class="font-bold">Info</p>
                  <p>Your Firebase configuration is hardcoded and does not need to be changed. For data to load, ensure you have created a composite index in Firestore for the 'surveys' collection on 'meta.createdAt' (descending).</p>
                </div>
                 <h4 class="font-bold pt-4">Manage App Settings</h4>
                 <p class="text-sm text-gray-600 mb-2">Export your app settings (rates, presets, etc.) as a backup, or import them on another device.</p>
                <div class="flex gap-2">
                    <button id="export-settings" class="bg-blue-500 text-white p-2 rounded">Export JSON</button>
                    <button onclick="G('import-settings-input').click()" class="bg-gray-200 p-2 rounded">Import JSON</button>
                    <input type="file" id="import-settings-input" class="hidden" accept=".json">
                </div>`;

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
                            const importedSettings = JSON.parse(ev.target.result);
                            state.settings = importedSettings;
                            saveAndApplySettings();
                            // Re-initialize the entire app to reflect all settings
                            init();
                            renderEditor(tabId); // Re-render editor with new values
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
            content.innerHTML = `<p>Select an editor tab from the left.</p>`;
    }
    
    // Generic event listener for all setting inputs
    content.querySelectorAll('input[data-setting], textarea[data-setting], select[data-setting]').forEach(input => {
        input.addEventListener('input', (e) => { // 'input' for live updates on sliders/text, 'change' is also fine
            const keys = e.target.dataset.setting.split('.');
            let settingObj = state.settings;
            keys.slice(0, -1).forEach(key => {
                if (!settingObj[key]) {
                    // Check if the next key is a number, to create an array if needed
                    const nextKey = keys[keys.indexOf(key) + 1];
                    settingObj[key] = !isNaN(parseInt(nextKey)) ? [] : {};
                }
                settingObj = settingObj[key];
            });
            
            let value;
            if(e.target.type === 'number' || e.target.type === 'range') {
                value = parseFloat(e.target.value);
            } else if (e.target.type === 'checkbox') {
                value = e.target.checked;
            } else {
                value = e.target.value;
            }

            const finalKey = keys.pop();
            settingObj[finalKey] = value;
            
            saveAndApplySettings();
        });
    });
}

function saveAndApplySettings() {
    localStorage.setItem('surveyAppSettings', JSON.stringify(state.settings));
    
    // Some components need a full re-render when settings change
    renderCustomerForm();
    renderItemPresets();
    G('header-logo').src = state.settings.company.logo;
    D.querySelector('#login-screen img').src = state.settings.company.logo;

}

document.addEventListener('DOMContentLoaded', init);

    