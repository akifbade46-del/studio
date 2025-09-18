'use client';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    Auth
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    serverTimestamp, 
    getDocs, 
    writeBatch, 
    addDoc,
    Firestore
} from 'firebase/firestore';
import QRCode from 'qrcodejs';
import Chart from 'chart.js/auto';

// --- Type Definitions ---
interface CurrentUser {
    uid: string;
    email: string | null;
    displayName: string;
    role: 'admin' | 'checker' | 'driver' | 'warehouse_supervisor' | 'user';
    status: 'active' | 'inactive' | 'blocked';
}

interface JobFile {
    id?: string;
    d?: string;
    po?: string;
    jfn?: string;
    cl?: string[];
    pt?: string[];
    in?: string;
    bd?: string;
    sm?: string;
    sh?: string;
    co?: string;
    mawb?: string;
    hawb?: string;
    ts?: string;
    or?: string;
    pc?: string;
    gw?: string;
    de?: string;
    vw?: string;
    dsc?: string;
    ca?: string;
    tn?: string;
    vn?: string;
    fv?: string;
    cn?: string;
    ch?: Charge[];
    re?: string;
    pb?: string;
    totalCost?: number;
    totalSelling?: number;
    totalProfit?: number;
    createdBy?: string;
    createdAt?: any;
    lastUpdatedBy?: string;
    updatedAt?: any;
    status?: 'pending' | 'checked' | 'approved' | 'rejected';
    checkedBy?: string | null;
    checkedAt?: any;
    approvedBy?: string | null;
    approvedAt?: any;
    rejectionReason?: string | null;
    rejectedBy?: string | null;
    rejectedAt?: any;
    deletedAt?: any;
    deletedBy?: string;
}

interface Charge {
    l: string;
    c: string;
    s: string;
    n: string;
}

interface Client {
    id: string;
    name: string;
    address?: string;
    contactPerson?: string;
    phone?: string;
    type?: 'Shipper' | 'Consignee' | 'Both';
}

interface User {
    id: string;
    displayName: string;
    email: string;
    role: string;
    status: string;
}

declare global {
    interface Window {
        openAnalyticsDashboard: () => void;
        closeAnalyticsDashboard: () => void;
        printAnalytics: () => void;
        openClientManager: () => void;
        openFileManager: () => void;
        saveJobFile: () => void;
        clearForm: () => void;
        printPage: () => void;
        openRecycleBin: () => void;
        closeModal: (id: string) => void;
        openChargeManager: () => void;
        suggestCharges: () => void;
        addChargeRow: (data?: any) => void;
        printPreview: () => void;
        saveUserChanges: () => void;
        backupAllData: () => void;
        handleRestoreFile: (event: any) => void;
        confirmDelete: (docId: string, type?: string) => void;
        previewJobFileById: (docId: string) => void;
        loadJobFileById: (docId: string) => void;
        downloadAnalyticsCsv: () => void;
        showStatusJobs: (status: string) => void;
        uncheckJobFile: (docId: string) => void;
        checkJobFile: (docId: string, fromModal?: boolean) => void;
        approveJobFile: (docId: string, fromModal?: boolean) => void;
        promptForRejection: (docId: string) => void;
        restoreJobFile: (docId: string) => void;
        confirmPermanentDelete: (docId: string) => void;
        saveChargeDescription: () => void;
        deleteChargeDescription: (description: string) => void;
        showUserJobs: (userName: string) => void;
        showMonthlyJobs: (month: string, dateType: string) => void;
        showSalesmanJobs: (salesmanName: string) => void;
    }
}


export default function Home() {
    const [isLoginView, setIsLoginView] = useState(true);
    const [appInitialized, setAppInitialized] = useState(false);

    // Refs for Firebase instances to prevent re-initialization
    const firebaseApp = useRef<FirebaseApp | null>(null);
    const authInstance = useRef<Auth | null>(null);
    const dbInstance = useRef<Firestore | null>(null);

    // Refs for state that doesn't need to trigger re-renders
    const currentUser = useRef<CurrentUser | null>(null);
    const jobFilesCache = useRef<JobFile[]>([]);
    const clientsCache = useRef<Client[]>([]);
    let chargeDescriptions = useRef<string[]>([]);
    const analyticsDataCache = useRef<any>(null);
    const currentFilteredJobs = useRef<JobFile[]>([]);
    const fileIdToReject = useRef<string | null>(null);
    const profitChartInstance = useRef<Chart | null>(null);

    const firebaseConfig = {
        apiKey: "AIzaSyAAulR2nJQm-4QtNyEqKTnnDPw-iKW92Mc",
        authDomain: "my-job-file-system.firebaseapp.com",
        projectId: "my-job-file-system",
        storageBucket: "my-job-file-system.appspot.com",
        messagingSenderId: "145307873304",
        appId: "1:145307873304:web:d661ea6ec118801b4a136d",
        measurementId: "G-8EHX5K7YHL"
    };

    // --- UTILITY FUNCTIONS ---
    const getEl = (id: string) => document.getElementById(id);
    const querySel = (selector: string) => document.querySelector(selector);
    const querySelAll = (selector: string) => document.querySelectorAll(selector);

    const showLoader = () => getEl('loader-overlay')?.classList.add('visible');
    const hideLoader = () => getEl('loader-overlay')?.classList.remove('visible');

    const showNotification = (message: string, isError = false) => {
        const notification = getEl('notification');
        if (!notification) return;
        notification.textContent = message;
        notification.style.backgroundColor = isError ? '#c53030' : '#2d3748';
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    };
    
    const openModal = (id: string, keepParent = false) => {
        const modal = getEl(id);
        if (!modal) return;
        if (!keepParent) {
            closeAllModals();
        }
        if (keepParent) {
            const highestZ = Array.from(querySelAll('.overlay.visible'))
                .reduce((max, el) => Math.max(max, parseInt(window.getComputedStyle(el).zIndex || '1000', 10)), 1000);
            modal.style.zIndex = `${highestZ + 1}`;
        }
        modal.classList.add('visible');
    };

    const closeModal = (id: string) => {
        const modal = getEl(id);
        if (modal) modal.classList.remove('visible');
    };

    const closeAllModals = () => {
        querySelAll('.overlay').forEach(modal => {
            modal.classList.remove('visible');
            (modal as HTMLElement).style.zIndex = '';
        });
    };

    const getHighestZIndex = () => {
        let highest = 1000;
        querySelAll('.overlay.visible').forEach(modal => {
            const z = parseInt(window.getComputedStyle(modal).zIndex, 10);
            if (z > highest) {
                highest = z;
            }
        });
        return highest;
    };
    
    // --- MAIN APP LOGIC ---
    useEffect(() => {
        if (appInitialized) return;

        // Initialize Firebase
        if (!firebaseApp.current) {
            try {
                firebaseApp.current = initializeApp(firebaseConfig);
                authInstance.current = getAuth(firebaseApp.current);
                dbInstance.current = getFirestore(firebaseApp.current);
            } catch (error) {
                console.error("Firebase initialization failed:", error);
                showNotification("Could not connect to the database.", true);
                return;
            }
        }
        
        const auth = authInstance.current;
        const db = dbInstance.current;

        const setupGlobalFunctions = () => {
          window.openAnalyticsDashboard = openAnalyticsDashboard;
          window.closeAnalyticsDashboard = closeAnalyticsDashboard;
          window.printAnalytics = printAnalytics;
          window.openClientManager = openClientManager;
          window.openFileManager = openFileManager;
          window.saveJobFile = saveJobFile;
          window.clearForm = clearForm;
          window.printPage = printPage;
          window.openRecycleBin = openRecycleBin;
          window.closeModal = closeModal;
          window.openChargeManager = openChargeManager;
          window.suggestCharges = suggestCharges;
          window.addChargeRow = addChargeRow;
          window.printPreview = printPreview;
          window.saveUserChanges = saveUserChanges;
          window.backupAllData = backupAllData;
          window.handleRestoreFile = handleRestoreFile;
          window.confirmDelete = confirmDelete;
          window.previewJobFileById = previewJobFileById;
          window.loadJobFileById = loadJobFileById;
          window.downloadAnalyticsCsv = downloadAnalyticsCsv;
          window.showStatusJobs = showStatusJobs;
          window.uncheckJobFile = uncheckJobFile;
          window.checkJobFile = checkJobFile;
          window.approveJobFile = approveJobFile;
          window.promptForRejection = promptForRejection;
          window.restoreJobFile = restoreJobFile;
          window.confirmPermanentDelete = confirmPermanentDelete;
          window.saveChargeDescription = saveChargeDescription;
          window.deleteChargeDescription = deleteChargeDescription;
          window.showUserJobs = showUserJobs;
          window.showMonthlyJobs = showMonthlyJobs;
          window.showSalesmanJobs = showSalesmanJobs;
      };

      setupGlobalFunctions();
        
        const getVal = (id: string) => (getEl(id) as HTMLInputElement)?.value || '';

        const calculate = () => {
            let totalCost = 0, totalSelling = 0, totalProfit = 0;
            querySelAll('#charges-table-body tr:not(#total-row)').forEach(row => {
                const cost = parseFloat((row.querySelector('.cost-input') as HTMLInputElement).value) || 0;
                const selling = parseFloat((row.querySelector('.selling-input') as HTMLInputElement).value) || 0;
                const profit = selling - cost;
                (row.querySelector('.profit-output') as HTMLElement).textContent = profit.toFixed(3);
                totalCost += cost; totalSelling += selling; totalProfit += profit;
            });
            const totalCostEl = getEl('total-cost');
            const totalSellingEl = getEl('total-selling');
            const totalProfitEl = getEl('total-profit');
            if (totalCostEl) totalCostEl.textContent = totalCost.toFixed(3);
            if (totalSellingEl) totalSellingEl.textContent = totalSelling.toFixed(3);
            if (totalProfitEl) totalProfitEl.textContent = totalProfit.toFixed(3);
        };
        
        const setupChargeAutocomplete = (inputElement: HTMLInputElement) => {
            const suggestionsPanel = inputElement.nextElementSibling as HTMLElement;
            if(!suggestionsPanel) return;

            let activeSuggestionIndex = -1;

            const updateSelection = () => {
                const suggestions = suggestionsPanel.querySelectorAll('.autocomplete-suggestion');
                suggestions.forEach((suggestion, index) => {
                    suggestion.classList.toggle('selected', index === activeSuggestionIndex);
                    if (index === activeSuggestionIndex) suggestion.scrollIntoView({ block: 'nearest' });
                });
            };

            const showSuggestions = () => {
                 const value = inputElement.value.toLowerCase();
                if (!value) {
                    suggestionsPanel.classList.add('hidden');
                    return;
                }
                const filtered = chargeDescriptions.current.filter(d => d.toLowerCase().includes(value));
                if (filtered.length > 0) {
                    suggestionsPanel.innerHTML = filtered.map(d => `<div class="autocomplete-suggestion">${d}</div>`).join('');
                    suggestionsPanel.classList.remove('hidden');
                } else {
                    suggestionsPanel.classList.add('hidden');
                }
                activeSuggestionIndex = -1;
            };

            inputElement.addEventListener('input', showSuggestions);

            inputElement.addEventListener('keydown', (e) => {
                const suggestions = suggestionsPanel.querySelectorAll('.autocomplete-suggestion');
                if (suggestionsPanel.classList.contains('hidden') || suggestions.length === 0) return;

                if (e.key === 'ArrowDown') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length; updateSelection(); } 
                else if (e.key === 'ArrowUp') { e.preventDefault(); activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length; updateSelection(); } 
                else if (e.key === 'Enter') { e.preventDefault(); if (activeSuggestionIndex > -1) (suggestions[activeSuggestionIndex] as HTMLElement).click(); } 
                else if (e.key === 'Escape') { suggestionsPanel.classList.add('hidden'); }
            });

            suggestionsPanel.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains('autocomplete-suggestion')) {
                    inputElement.value = target.textContent || '';
                    suggestionsPanel.classList.add('hidden');
                }
            });
            
            inputElement.addEventListener('blur', () => {
                setTimeout(() => suggestionsPanel.classList.add('hidden'), 150);
            });
        };

        const addChargeRow = (data: Partial<Charge> = {}) => {
            const tableBody = getEl('charges-table-body');
            if (!tableBody) return;
            const newRow = document.createElement('tr');

            newRow.innerHTML = `
                <td class="table-cell relative">
                    <input type="text" class="description-input input-field" value="${data.l || ''}" autocomplete="off">
                    <div class="autocomplete-suggestions hidden"></div>
                </td>
                <td class="table-cell"><input type="number" step="0.001" class="cost-input input-field" value="${data.c || ''}"></td>
                <td class="table-cell"><input type="number" step="0.001" class="selling-input input-field" value="${data.s || ''}"></td>
                <td class="table-cell profit-output bg-gray-50 text-right">${((parseFloat(data.s || '0')) - (parseFloat(data.c || '0'))).toFixed(3)}</td>
                <td class="table-cell"><input type="text" class="notes-input input-field" value="${data.n || ''}"></td>
                <td class="table-cell text-center"><button class="text-red-500 hover:text-red-700 font-bold text-lg">&times;</button></td>
            `;

            const descriptionInput = newRow.querySelector('.description-input') as HTMLInputElement;
            setupChargeAutocomplete(descriptionInput);
            
            const deleteButton = newRow.querySelector('button');
            deleteButton?.addEventListener('click', () => {
                newRow.remove();
                calculate();
            });

            tableBody.appendChild(newRow);
        };
        
        const populateTable = () => {
            const table = getEl('charges-table');
            if (!table) return;
            table.innerHTML = `
                <thead>
                    <tr class="bg-gray-100">
                        <th class="table-cell font-semibold w-2/5">Description</th>
                        <th class="table-cell font-semibold">Cost</th>
                        <th class="table-cell font-semibold">Selling</th>
                        <th class="table-cell font-semibold">Profit</th>
                        <th class="table-cell font-semibold">Notes</th>
                         <th class="table-cell font-semibold"></th>
                    </tr>
                </thead>
                <tbody id="charges-table-body">
                </tbody>
                <tfoot>
                     <tr id="total-row" class="bg-gray-100 font-bold">
                        <td class="table-cell text-right">TOTAL:</td>
                        <td id="total-cost" class="table-cell text-right">0.000</td>
                        <td id="total-selling" class="table-cell text-right">0.000</td>
                        <td id="total-profit" class="table-cell text-right">0.000</td>
                        <td class="table-cell" colspan="2"></td>
                    </tr>
                </tfoot>
            `;

            const tableBody = getEl('charges-table-body');
            tableBody?.addEventListener('input', e => {
                const target = e.target as HTMLElement;
                if (target.classList.contains('cost-input') || target.classList.contains('selling-input')) {
                    calculate();
                }
            });
             for(let i=0; i<5; i++) addChargeRow();
        };

        const getFormData = (): JobFile => {
            const getChecked = (query: string) => Array.from(document.querySelectorAll(query)).filter(el => (el as HTMLInputElement).checked).map(el => (el as HTMLElement).dataset.clearance || (el as HTMLElement).dataset.product || '');

            const charges: Charge[] = [];
            document.querySelectorAll('#charges-table-body tr:not(#total-row)').forEach(row => {
                const description = (row.querySelector('.description-input') as HTMLInputElement).value.trim();
                const cost = (row.querySelector('.cost-input') as HTMLInputElement).value;
                const selling = (row.querySelector('.selling-input') as HTMLInputElement).value;

                if (description && (cost || selling)) {
                    charges.push({
                        l: description,
                        c: cost || '0',
                        s: selling || '0',
                        n: (row.querySelector('.notes-input') as HTMLInputElement).value || ''
                    });
                }
            });

            return {
                d: getVal('date'), po: getVal('po-number'), jfn: getVal('job-file-no'),
                cl: getChecked('[data-clearance]:checked'), pt: getChecked('[data-product]:checked'),
                in: getVal('invoice-no'), bd: getVal('billing-date'), sm: getVal('salesman'),
                sh: getVal('shipper-name'), co: getVal('consignee-name'),
                mawb: getVal('mawb'), hawb: getVal('hawb'), ts: getVal('teams-of-shipping'), or: getVal('origin'),
                pc: getVal('no-of-pieces'), gw: getVal('gross-weight'), de: getVal('destination'), vw: getVal('volume-weight'),
                dsc: getVal('description'), ca: getVal('carrier'), tn: getVal('truck-no'),
                vn: getVal('vessel-name'), fv: getVal('flight-voyage-no'), cn: getVal('container-no'),
                ch: charges,
                re: getVal('remarks'),
                pb: getVal('prepared-by'),
            };
        };

        const clearForm = () => {
            const form = querySel('#main-container');
            if(!form) return;
            form.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(el => (el as HTMLInputElement).value = '');
            form.querySelectorAll('input[type="checkbox"]').forEach(el => (el as HTMLInputElement).checked = false);
            
            (getEl('date') as HTMLInputElement).valueAsDate = new Date();
            (getEl('job-file-no') as HTMLInputElement).disabled = false;
            populateTable();
            calculate();
            
            if (currentUser.current) {
                (getEl('prepared-by') as HTMLInputElement).value = currentUser.current.displayName;
            }
            
            (getEl('created-by-info') as HTMLElement).textContent = '';
            (getEl('last-updated-by-info') as HTMLElement).textContent = '';

            (getEl('approved-by') as HTMLInputElement).value = '';
            (getEl('checked-by') as HTMLInputElement).value = '';
            (getEl('check-btn') as HTMLButtonElement).disabled = false;
            (getEl('check-btn') as HTMLElement).textContent = 'Check Job File';
            (getEl('approve-btn') as HTMLButtonElement).disabled = false;
            (getEl('reject-btn') as HTMLButtonElement).disabled = false;

            (getEl('checked-stamp') as HTMLElement).style.display = 'none';
            (getEl('approved-stamp') as HTMLElement).style.display = 'none';
            (getEl('rejected-stamp') as HTMLElement).style.display = 'none';
            (getEl('rejection-banner') as HTMLElement).style.display = 'none';

            const isChecker = ['admin', 'checker'].includes(currentUser.current?.role || '');
            const isAdmin = currentUser.current?.role === 'admin';
            (getEl('check-btn') as HTMLElement).style.display = isChecker ? 'block' : 'none';
            (getEl('approval-buttons') as HTMLElement).style.display = isAdmin ? 'flex' : 'none';

            showNotification("Form cleared. Ready for a new job file.");
        };

        const showApp = () => {
            (getEl('login-screen') as HTMLElement).style.display = 'none';
            (getEl('app-container') as HTMLElement).style.display = 'block';
            (getEl('analytics-container') as HTMLElement).style.display = 'none';

            if (currentUser.current) {
                (getEl('user-display-name') as HTMLElement).textContent = currentUser.current.displayName;
                (getEl('user-role') as HTMLElement).textContent = currentUser.current.role;

                querySelAll('.admin-only').forEach(el => (el as HTMLElement).style.display = 'none');
                querySelAll('.checker-only').forEach(el => (el as HTMLElement).style.display = 'none');
                
                if (currentUser.current.role === 'admin') {
                    querySelAll('.admin-only').forEach(el => (el as HTMLElement).style.display = 'block');
                    querySelAll('.checker-only').forEach(el => (el as HTMLElement).style.display = 'block');
                    (getEl('checker-info-banner') as HTMLElement).style.display = 'block';
                } else if (currentUser.current.role === 'checker') {
                    querySelAll('.checker-only').forEach(el => (el as HTMLElement).style.display = 'block');
                    (getEl('checker-info-banner') as HTMLElement).style.display = 'block';
                }
            }
            
            clearForm();
        };

        const showLoginScreen = () => {
            (getEl('login-screen') as HTMLElement).style.display = 'flex';
            (getEl('app-container') as HTMLElement).style.display = 'none';
            (getEl('analytics-container') as HTMLElement).style.display = 'none';
        };

        const populateFormFromData = (data: JobFile) => {
            const setVal = (id: string, value: string | undefined) => { const el = getEl(id) as HTMLInputElement; if (el) el.value = value || ''; };
            const setChecked = (type: string, values: string[] | undefined) => {
                document.querySelectorAll(`[data-${type}]`).forEach(el => {
                    (el as HTMLInputElement).checked = (values || []).includes((el as HTMLElement).dataset[type] || '');
                });
            };

            setVal('date', data.d); setVal('po-number', data.po); setVal('job-file-no', data.jfn);
            setVal('invoice-no', data.in); setVal('billing-date', data.bd);
            setVal('salesman', data.sm); setVal('shipper-name', data.sh); setVal('consignee-name', data.co);
            setVal('mawb', data.mawb); setVal('hawb', data.hawb); setVal('teams-of-shipping', data.ts);
            setVal('origin', data.or); setVal('no-of-pieces', data.pc); setVal('gross-weight', data.gw);
            setVal('destination', data.de); setVal('volume-weight', data.vw); setVal('description', data.dsc);
            setVal('carrier', data.ca); setVal('truck-no', data.tn); setVal('vessel-name', data.vn);
            setVal('flight-voyage-no', data.fv); setVal('container-no', data.cn);
            setVal('remarks', data.re); 
            
            setVal('prepared-by', data.pb || data.createdBy || '');

            const createdInfo = getEl('created-by-info') as HTMLElement;
            const updatedInfo = getEl('last-updated-by-info') as HTMLElement;
            
            createdInfo.textContent = data.createdBy ? `Created by: ${data.createdBy} on ${data.createdAt?.toDate().toLocaleDateString()}` : '';
            updatedInfo.textContent = data.lastUpdatedBy ? `Last updated by: ${data.lastUpdatedBy} on ${data.updatedAt?.toDate().toLocaleString()}` : '';
            
            (getEl('checked-stamp') as HTMLElement).style.display = 'none';
            (getEl('approved-stamp') as HTMLElement).style.display = 'none';
            (getEl('rejected-stamp') as HTMLElement).style.display = 'none';
            (getEl('rejection-banner') as HTMLElement).style.display = 'none';
            (getEl('check-btn') as HTMLElement).style.display = 'none';
            (getEl('approval-buttons') as HTMLElement).style.display = 'none';

            const checkBtn = getEl('check-btn') as HTMLButtonElement;
            if (data.checkedBy) {
                const checkedDate = data.checkedAt?.toDate() ? ` on ${data.checkedAt.toDate().toLocaleDateString()}` : '';
                setVal('checked-by', `${data.checkedBy}${checkedDate}`);
                checkBtn.disabled = true;
                checkBtn.textContent = 'Checked';
                (getEl('checked-stamp') as HTMLElement).style.display = 'block';
            } else {
                setVal('checked-by', 'Pending Check');
                checkBtn.disabled = false;
                checkBtn.textContent = 'Check Job File';
            }

            if (data.status === 'approved') {
                const approvedDate = data.approvedAt?.toDate() ? ` on ${data.approvedAt.toDate().toLocaleDateString()}` : '';
                setVal('approved-by', `${data.approvedBy}${approvedDate}`);
                (getEl('approved-stamp') as HTMLElement).style.display = 'block';
            } else if (data.status === 'rejected') {
                const rejectedDate = data.rejectedAt?.toDate() ? ` on ${data.rejectedAt.toDate().toLocaleDateString()}` : '';
                setVal('approved-by', `Rejected by ${data.rejectedBy}${rejectedDate}`);
                (getEl('rejected-stamp') as HTMLElement).style.display = 'block';
                (getEl('rejection-banner') as HTMLElement).style.display = 'block';
                (getEl('rejection-reason') as HTMLElement).textContent = data.rejectionReason || '';
            } else {
                setVal('approved-by', 'Pending Approval');
            }

            if (currentUser.current?.role === 'admin') {
                if (data.status !== 'approved' && data.status !== 'rejected') {
                    (getEl('approval-buttons') as HTMLElement).style.display = 'flex';
                }
            }
            if (['admin', 'checker'].includes(currentUser.current?.role || '')) {
                if (!data.checkedBy) {
                     (getEl('check-btn') as HTMLElement).style.display = 'block';
                }
            }

            setChecked('clearance', data.cl);
            setChecked('product', data.pt);

            populateTable();
             if (data.ch && data.ch.length > 0) {
                 const tableBody = getEl('charges-table-body');
                 if(tableBody) tableBody.innerHTML = '';
                 data.ch.forEach(charge => addChargeRow(charge));
             } else {
                for(let i=0; i<5; i++) addChargeRow();
            }
            calculate();
        };

        const logUserActivity = (jobFileNo: string | undefined) => {
            if (!currentUser.current || !jobFileNo) return;
            const logEntry = {
                user: currentUser.current.displayName,
                file: jobFileNo,
                timestamp: new Date().toISOString()
            };
            let logs = [];
            try {
                const storedLogs = localStorage.getItem('userActivityLog');
                if (storedLogs) logs = JSON.parse(storedLogs);
            } catch (e) { console.error("Error parsing user activity log", e); logs = []; }

            logs.unshift(logEntry);
            if (logs.length > 200) logs.splice(200);
            localStorage.setItem('userActivityLog', JSON.stringify(logs));
        };
        
        const loadJobFileById = async (docId: string) => {
            showLoader();
            try {
                const docRef = doc(db, 'jobfiles', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const fileData = docSnap.data() as JobFile;
                    populateFormFromData(fileData);
                    
                    logUserActivity(fileData.jfn);
                    
                    (getEl('job-file-no') as HTMLInputElement).disabled = true;
                    closeAllModals();
                    showNotification("Job file loaded successfully.");
                } else {
                    showNotification("Document not found.", true);
                }
                hideLoader();
            } catch (error) {
                hideLoader();
                console.error("Error loading document:", error);
                showNotification("Error loading job file.", true);
            }
        };

        // --- AUTH LOGIC ---
        const handleSignUp = async (email: string, password: string, displayName: string) => {
            showLoader();
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                showNotification("Account created! Please wait for admin approval.", false);
                await signOut(auth);
                toggleAuthView(true);
            } catch (error: any) {
                console.error("Sign up error:", error);
                showNotification(error.message, true);
            }
            hideLoader();
        };

        const handleLogin = async (email: string, password: string) => {
            showLoader();
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error: any) {
                console.error("Login error:", error);
                let message = "Login failed. Please check your email and password.";
                if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
                    message = "Incorrect email or password. Please try again or reset your password.";
                }
                showNotification(message, true);
            }
            hideLoader();
        };

        const handleForgotPassword = async () => {
            const email = (getEl('reset-email') as HTMLInputElement).value.trim();
            if (!email) {
                showNotification("Please enter your email address.", true);
                return;
            }
            showLoader();
            try {
                await sendPasswordResetEmail(auth, email);
                hideLoader();
                closeModal('forgot-password-modal');
                showNotification("Password reset link sent! Check your email inbox.", false);
            } catch (error: any) {
                hideLoader();
                console.error("Password reset error:", error);
                let message = "Could not send reset link. Please try again.";
                if(error.code === 'auth/user-not-found'){
                    message = "No account found with this email address.";
                }
                showNotification(message, true);
            }
        };

        const handleLogout = () => {
            signOut(auth);
        };
        
        const toggleAuthView = (showLogin: boolean) => {
            const nameField = getEl('signup-name-field');
            const emailField = getEl('email-address');
            
            if(getEl('auth-title')) (getEl('auth-title') as HTMLElement).textContent = showLogin ? 'Sign in to your account' : 'Create a new account';
            if(getEl('auth-btn')) (getEl('auth-btn') as HTMLElement).textContent = showLogin ? 'Sign in' : 'Sign up';
            if(getEl('auth-link')) (getEl('auth-link') as HTMLElement).textContent = showLogin ? 'Create a new account' : 'Already have an account? Sign in';
            if(nameField) nameField.style.display = showLogin ? 'none' : 'block';
            emailField?.classList.toggle('rounded-t-md', !showLogin);
            emailField?.classList.toggle('rounded-md', showLogin);
            const approvalMessage = getEl('approval-message');
            if(approvalMessage) approvalMessage.style.display = 'none';
        };

        // --- FIRESTORE LOGIC ---
        const saveJobFile = async () => {
            if (!db) { showNotification("Database not connected.", true); return; }
            
            const jobFileNoInput = getEl('job-file-no') as HTMLInputElement;
            const jobFileNo = jobFileNoInput.value.trim();
            const isUpdating = jobFileNoInput.disabled;

            const invoiceNo = (getEl('invoice-no') as HTMLInputElement).value.trim();
            const mawbNo = (getEl('mawb') as HTMLInputElement).value.trim();

            if (!jobFileNo) { 
                showNotification("Please enter a Job File No.", true); 
                return; 
            }
            
            showLoader();
            const docId = jobFileNo.replace(/\//g, '_');

            const checks = [];
            if (!isUpdating) {
                 checks.push({ field: 'jfn', value: jobFileNo, label: 'Job File No.' });
            }
            if (invoiceNo) checks.push({ field: 'in', value: invoiceNo, label: 'Invoice No.' });
            if (mawbNo) checks.push({ field: 'mawb', value: mawbNo, label: 'MAWB No.' });

            for (const check of checks) {
                try {
                    const q = query(collection(db, 'jobfiles'), where(check.field, '==', check.value));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        if (isUpdating) {
                            for (const foundDoc of querySnapshot.docs) {
                                if (foundDoc.id !== docId) {
                                    hideLoader();
                                    showNotification(`Duplicate ${check.label} "${check.value}" found in job file: ${foundDoc.data().jfn}`, true);
                                    return;
                                }
                            }
                        } else {
                            hideLoader();
                            showNotification(`Duplicate ${check.label} "${check.value}" already exists in job file: ${querySnapshot.docs[0].data().jfn}`, true);
                            return;
                        }
                    }
                } catch (error) { 
                    hideLoader();
                    console.error("Error checking for duplicates:", error);
                    showNotification("Could not verify uniqueness. Please try again.", true);
                    return;
                }
            }

            const data = getFormData();
            data.totalCost = parseFloat(getEl('total-cost')?.textContent || '0');
            data.totalSelling = parseFloat(getEl('total-selling')?.textContent || '0');
            data.totalProfit = parseFloat(getEl('total-profit')?.textContent || '0');
            
            try {
                const docRef = doc(db, 'jobfiles', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const existingData = docSnap.data();
                    data.lastUpdatedBy = currentUser.current?.displayName;
                    data.updatedAt = serverTimestamp();

                    if (existingData.status === 'approved' || existingData.status === 'checked') {
                        data.status = 'pending';
                        data.checkedBy = null;
                        data.checkedAt = null;
                        data.approvedBy = null;
                        data.approvedAt = null;
                        data.rejectionReason = null;
                        data.rejectedBy = null;
                        data.rejectedAt = null;
                        showNotification("File modified. Re-approval is now required.", false);
                    }
                    await setDoc(docRef, data, { merge: true });
                } else {
                    data.createdBy = currentUser.current?.displayName;
                    data.createdAt = serverTimestamp();
                    data.lastUpdatedBy = currentUser.current?.displayName;
                    data.updatedAt = serverTimestamp();
                    data.status = 'pending';
                    await setDoc(docRef, data);
                }
                
                hideLoader();
                showNotification("Job file saved successfully!");
                loadJobFileById(docId);

            } catch (error) {
                hideLoader();
                console.error("Error saving document: ", error);
                showNotification("Error saving job file.", true);
            }
        };

        const loadJobFiles = () => {
            if (!db) return;
            const jobFilesCollection = collection(db, 'jobfiles');
            const q = query(jobFilesCollection);

            onSnapshot(q, (querySnapshot) => {
                jobFilesCache.current = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as JobFile }));
                
                const sortedDocs = [...jobFilesCache.current].sort((a,b) => (b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0) - (a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0));
                
                displayJobFiles(sortedDocs);
                updateStatusSummary('status-summary-main', jobFilesCache.current);

            }, (error) => {
                console.error("Error fetching job files: ", error);
                showNotification("Error loading job files.", true);
            });
        };

        const displayJobFiles = (files: JobFile[]) => {
            const list = getEl('job-files-list');
            if (!list) return;
            if (files.length === 0) {
                 list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files match the current filters.</p>`;
                 return;
            }
            let filesHtml = '';
            files.forEach((docData) => {
                const deleteButton = currentUser.current?.role === 'admin' ? `<button onclick="confirmDelete('${docData.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Delete</button>` : '';
                const lastUpdated = docData.updatedAt?.toDate ? docData.updatedAt.toDate().toLocaleString() : 'N/A';
                
                filesHtml += `
                    <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2">
                        <div class="text-center sm:text-left">
                            <p class="font-bold text-indigo-700">${docData.jfn || 'No ID'}</p>
                            <p class="text-sm text-gray-600">Shipper: ${docData.sh || 'N/A'} | Consignee: ${docData.co || 'N/A'}</p>
                            <p class="text-xs text-gray-400">Last Updated: ${lastUpdated}</p>
                        </div>
                        <div class="space-x-2 flex-shrink-0">
                            <button onclick="previewJobFileById('${docData.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">Preview</button>
                            <button onclick="loadJobFileById('${docData.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-sm">Load</button>
                            ${deleteButton}
                        </div>
                    </div>
                `;
            });
            list.innerHTML = filesHtml;
        };

        const applyFiltersAndDisplay = () => {
            const searchTerm = (getEl('search-bar') as HTMLInputElement).value.toLowerCase();
            const statusFilter = (getEl('filter-status') as HTMLSelectElement).value;
            const fromDate = (getEl('filter-date-from') as HTMLInputElement).value;
            const toDate = (getEl('filter-date-to') as HTMLInputElement).value;

            let filteredFiles = jobFilesCache.current.filter(file => {
                const searchData = [file.jfn, file.sh, file.co].join(' ').toLowerCase();
                if (searchTerm && !searchData.includes(searchTerm)) return false;
                if (statusFilter && file.status !== statusFilter) return false;
                if (fromDate && (file.d || '') < fromDate) return false;
                if (toDate && (file.d || '') > toDate) return false;
                return true;
            });

            displayJobFiles(filteredFiles);
        };

        // --- AUTH STATE CHANGE ---
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                let userDoc = await getDoc(userDocRef);

                if (!userDoc.exists()) {
                    const usersCollectionRef = collection(db, 'users');
                    const userQuerySnapshot = await getDocs(usersCollectionRef);
                    const isFirstUser = userQuerySnapshot.size === 0;

                    const newUser = {
                        email: user.email,
                        displayName: user.displayName || user.email?.split('@')[0],
                        role: isFirstUser ? 'admin' : 'user',
                        status: isFirstUser ? 'active' : 'inactive',
                        createdAt: serverTimestamp()
                    };
                    await setDoc(userDocRef, newUser);
                    userDoc = await getDoc(userDocRef);
                }

                const userData = userDoc.data() as Omit<CurrentUser, 'uid'>;
                
                if (userData.status === 'inactive') {
                    showLoginScreen();
                    const el = getEl('approval-message');
                    if(el) el.style.display = 'block';
                    const blockedEl = getEl('blocked-message');
                    if(blockedEl) blockedEl.style.display = 'none';
                    signOut(auth);
                    return;
                }

                if (userData.status === 'blocked') {
                    showLoginScreen();
                    const el = getEl('approval-message');
                    if(el) el.style.display = 'none';
                    const blockedEl = getEl('blocked-message');
                    if(blockedEl) blockedEl.style.display = 'block';
                    signOut(auth);
                    return;
                }

                currentUser.current = { uid: user.uid, email: user.email, ...userData };
                console.log("User logged in:", currentUser.current);
                showApp();
                loadJobFiles();
                loadClients();
            } else {
                currentUser.current = null;
                console.log("User logged out");
                showLoginScreen();
            }
        });
        
        // --- CLIENT MANAGEMENT ---
        const loadClients = () => {
            if (!db) return;
            const clientsCollection = collection(db, 'clients');
            onSnapshot(query(clientsCollection), (snapshot) => {
                clientsCache.current = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                clientsCache.current.sort((a, b) => a.name.localeCompare(b.name));
                displayClients(clientsCache.current);
            }, (error) => {
                console.error("Error loading clients:", error);
                showNotification("Could not load clients.", true);
            });
        };

        const displayClients = (clients: Client[]) => {
            const list = getEl('client-list');
            if(!list) return;
            if (clients.length === 0) {
                list.innerHTML = `<p class="text-gray-500 text-center p-4">No clients found.</p>`;
                return;
            }
            list.innerHTML = clients.map(client => `
                <div class="client-item border p-3 rounded-lg bg-gray-50 hover:bg-gray-100" data-search-term="${client.name.toLowerCase()}">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold">${client.name}</p>
                            <p class="text-sm text-gray-600">${client.address || ''}</p>
                            <p class="text-xs text-gray-500">${client.contactPerson || ''} - ${client.phone || ''}</p>
                        </div>
                        <div class="flex-shrink-0 space-x-2">
                            <button onclick="editClient('${client.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs">Edit</button>
                            <button onclick="confirmDelete('${client.id}', 'client')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('');
        };

        // --- CHARGE DESCRIPTIONS ---
        const storedDescriptions = localStorage.getItem('chargeDescriptions');
        if (storedDescriptions) {
            try {
                chargeDescriptions.current = JSON.parse(storedDescriptions);
            } catch(e) { chargeDescriptions.current = []; }
        } else {
            chargeDescriptions.current = [
                'Ex-works Charges:', 'Land/Air / Sea Freight:', 'Fuell Security / War Surcharge:', 'Formalities:', 'Delivery Order Fee:', 'Transportation Charges:', 'Inspection / Computer Print Charges:', 'Handling Charges:', 'Labor / Forklift Charges:', 'Documentation Charges:', 'Clearance Charges:', 'Customs Duty:', 'Terminal Handling Charges:', 'Legalization Charges:', 'Demurrage Charges:', 'Loading / Offloading Charges:', 'Destination Clearance Charges:', 'Packing Charges:', 'Port Charges:', 'Other Charges:', 'PAI Approval :', 'Insurance Fee :', 'EPA Charges :'
            ];
            localStorage.setItem('chargeDescriptions', JSON.stringify(chargeDescriptions.current));
        }

        // --- EVENT LISTENERS ---
        getEl('auth-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            setIsLoginView(prev => !prev);
            toggleAuthView(!isLoginView);
        });

        getEl('auth-btn')?.addEventListener('click', () => {
            const email = (getEl('email-address') as HTMLInputElement).value;
            const password = (getEl('password') as HTMLInputElement).value;
            if (isLoginView) {
                handleLogin(email, password);
            } else {
                const displayName = (getEl('full-name') as HTMLInputElement).value;
                 if (!email || !password || !displayName) {
                     showNotification("Please fill all fields to sign up.", true);
                     return;
                }
                handleSignUp(email, password, displayName);
            }
        });
        
        getEl('logout-btn')?.addEventListener('click', handleLogout);
        getEl('admin-panel-btn')?.addEventListener('click', openAdminPanel);
        getEl('activity-log-btn')?.addEventListener('click', openUserActivityLog);
        getEl('forgot-password-link')?.addEventListener('click', (e) => { e.preventDefault(); openModal('forgot-password-modal'); });
        getEl('send-reset-link-btn')?.addEventListener('click', handleForgotPassword);
        getEl('confirm-reject-btn')?.addEventListener('click', rejectJobFile);

        getEl('search-bar')?.addEventListener('input', applyFiltersAndDisplay);
        getEl('filter-status')?.addEventListener('change', applyFiltersAndDisplay);
        getEl('filter-date-from')?.addEventListener('change', applyFiltersAndDisplay);
        getEl('filter-date-to')?.addEventListener('change', applyFiltersAndDisplay);
        getEl('clear-filters-btn')?.addEventListener('click', () => {
            (getEl('search-bar') as HTMLInputElement).value = '';
            (getEl('filter-status') as HTMLSelectElement).value = '';
            (getEl('filter-date-from') as HTMLInputElement).value = '';
            (getEl('filter-date-to') as HTMLInputElement).value = '';
            applyFiltersAndDisplay();
        });

        const clientForm = getEl('client-form');
        if (clientForm) {
          clientForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveClient();
          });
        }
        getEl('clear-client-form-btn')?.addEventListener('click', clearClientForm);
        getEl('client-search-bar')?.addEventListener('input', (e) => {
            const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
            const filteredClients = clientsCache.current.filter(client => client.name.toLowerCase().includes(searchTerm));
            displayClients(filteredClients);
        });

        // Autocomplete setup
        const shipperInput = getEl('shipper-name') as HTMLInputElement;
        const consigneeInput = getEl('consignee-name') as HTMLInputElement;
        if(shipperInput) setupAutocomplete(shipperInput, 'shipper-suggestions', 'Shipper');
        if(consigneeInput) setupAutocomplete(consigneeInput, 'consignee-suggestions', 'Consignee');
        
        setAppInitialized(true);
        return () => {
            unsubscribe(); // Cleanup on unmount
        };

    }, [appInitialized, isLoginView]); // Rerun effect if isLoginView changes

    // --- RENDER ---
    return (
        <>
            {/* Login Screen */}
            <div id="login-screen" className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
              {/* ... Rest of login screen JSX ... */}
               <div className="max-w-md w-full space-y-8">
            <div>
                <Image className="mx-auto h-24 w-auto" src="https://qgocargo.com/logo.png" alt="Q'go Cargo Logo" width={96} height={96} />
                <h2 id="auth-title" className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
            </div>
            <div className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md">
                <div id="approval-message" className="hidden p-4 text-center text-yellow-800 bg-yellow-100 rounded-lg">
                    Your account is awaiting admin approval.
                </div>
                 <div id="blocked-message" className="hidden p-4 text-center text-red-800 bg-red-100 rounded-lg">
                    Your account has been blocked by an administrator.
                </div>
                <div className="rounded-md shadow-sm -space-y-px">
                    <div id="signup-name-field" style={{display: 'none'}}>
                        <label htmlFor="full-name" className="sr-only">Full Name</label>
                        <input id="full-name" name="name" type="text" autoComplete="name" required className="input-field rounded-t-md" placeholder="Full Name" />
                    </div>
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email address</label>
                        <input id="email-address" name="email" type="email" autoComplete="email" required className="input-field" placeholder="Email address" />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input id="password" name="password" type="password" autoComplete="current-password" required className="input-field rounded-b-md" placeholder="Password" />
                    </div>
                </div>
                <div>
                    <button id="auth-btn" className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Sign in
                    </button>
                </div>
                <p className="mt-2 text-center text-sm text-gray-600">
                    <a href="#" id="auth-link" className="font-medium text-indigo-600 hover:text-indigo-500">
                        Create a new account
                    </a>
                </p>
                <div className="text-center mt-2 text-sm">
                    <a href="#" id="forgot-password-link" className="font-medium text-indigo-600 hover:text-indigo-500">
                        Forgot your password?
                    </a>
                </div>
            </div>
        </div>
            </div>

            {/* Main Application Container */}
            <div id="app-container" className="hidden">
                <div id="main-container" className="container">
                    {/* Header Section */}
                    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                      {/* ... Header JSX ... */}
                       <div className="flex items-center">
                          <Image id="logo-container" className="h-16 w-auto mr-4" src="https://qgocargo.com/logo.png" alt="Q'go Cargo Logo" width={64} height={64} />
                          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 border-l-4 border-gray-300 pl-4">JOB FILE</h1>
                      </div>
                      <div className="text-right w-full sm:w-auto">
                          <div className="flex items-center mb-2">
                              <label htmlFor="date" className="mr-2 font-semibold text-gray-700">Date:</label>
                              <input type="date" id="date" className="input-field w-full sm:w-40" />
                          </div>
                          <div className="flex items-center">
                              <label htmlFor="po-number" className="mr-2 font-semibold text-gray-700">P.O. #:</label>
                              <input type="text" id="po-number" className="input-field w-full sm:w-40" />
                          </div>
                      </div>
                    </header>
                    
                    {/* User Info and Logout */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 bg-gray-50 p-2 rounded-md gap-2">
                        <div className="text-sm text-center sm:text-left">
                            Logged in as: <span id="user-display-name" className="font-bold"></span> (<span id="user-role" className="capitalize"></span>)
                        </div>
                         <div className="flex-grow text-center">
                             <button onClick={() => window.openAnalyticsDashboard()} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-5 rounded-md text-base">Analytics</button>
                         </div>
                        <div>
                            <button id="activity-log-btn" className="admin-only bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded text-sm mr-2">Activity Log</button>
                            <button id="admin-panel-btn" className="admin-only bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded text-sm mr-2">Admin Panel</button>
                            <button id="logout-btn" className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Logout</button>
                        </div>
                    </div>
                    
                    {/* ... Rest of the app container JSX ... */}
                    <div id="status-summary-main" className="mb-4"></div>

                    <div id="checker-info-banner" className="checker-only hidden p-3 mb-4 text-center text-blue-800 bg-blue-100 rounded-lg">
                        <strong>Note:</strong> Files must be checked before they can be approved or rejected by an admin.
                    </div>

                    <div id="rejection-banner" className="hidden p-3 mb-4 text-center text-red-800 bg-red-100 rounded-lg">
                        <strong>This job file was rejected.</strong> Reason: <span id="rejection-reason"></span>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        <div className="lg:col-span-2">
                            <label htmlFor="job-file-no" className="block mb-1 font-semibold text-gray-700">Job File No.:</label>
                            <input type="text" id="job-file-no" className="input-field" placeholder="Enter a unique ID here..." />
                        </div>
                        <div className="flex items-end space-x-8 pb-1">
                            <div>
                                <span className="font-semibold text-gray-700">Clearance</span>
                                <div className="mt-2 space-y-1">
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-clearance="Export" /> Export</label>
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-clearance="Import" /> Import</label>
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-clearance="Clearance" /> Clearance</label>
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-clearance="Local Move" /> Local Move</label>
                                </div>
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Product Type</span>
                                <div className="mt-2 space-y-1">
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-product="Air Freight" /> Air Freight</label>
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-product="Sea Freight" /> Sea Freight</label>
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-product="Land Freight" /> Land Freight</label>
                                    <label className="flex items-center"><input type="checkbox" className="mr-2" data-product="Others" /> Others</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div><label htmlFor="invoice-no" className="block mb-1 font-semibold text-gray-700">Invoice No.:</label><input type="text" id="invoice-no" className="input-field" /></div>
                        <div><label htmlFor="billing-date" className="block mb-1 font-semibold text-gray-700">Billing Date:</label><input type="date" id="billing-date" className="input-field" /></div>
                        <div><label htmlFor="salesman" className="block mb-1 font-semibold text-gray-700">Salesman:</label><input type="text" id="salesman" className="input-field" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="relative">
                            <label htmlFor="shipper-name" className="block mb-1 font-semibold text-gray-700">Shipper&apos;s Name:</label>
                            <input type="text" id="shipper-name" className="input-field" autoComplete="off" />
                            <div id="shipper-suggestions" className="autocomplete-suggestions hidden"></div>
                        </div>
                        <div className="relative">
                            <label htmlFor="consignee-name" className="block mb-1 font-semibold text-gray-700">Consignee&apos;s Name:</label>
                            <input type="text" id="consignee-name" className="input-field" autoComplete="off" />
                            <div id="consignee-suggestions" className="autocomplete-suggestions hidden"></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <div><label htmlFor="mawb" className="block mb-1 font-semibold text-gray-700">MAWB / OBL / TCN No.:</label><input type="text" id="mawb" className="input-field" /></div>
                        <div><label htmlFor="hawb" className="block mb-1 font-semibold text-gray-700">HAWB / HBL:</label><input type="text" id="hawb" className="input-field" /></div>
                        <div><label htmlFor="teams-of-shipping" className="block mb-1 font-semibold text-gray-700">Teams of Shipping:</label><input type="text" id="teams-of-shipping" className="input-field" /></div>
                        <div><label htmlFor="origin" className="block mb-1 font-semibold text-gray-700">Origin:</label><input type="text" id="origin" className="input-field" /></div>
                        <div><label htmlFor="no-of-pieces" className="block mb-1 font-semibold text-gray-700">No. of Pieces:</label><input type="text" id="no-of-pieces" className="input-field" /></div>
                        <div><label htmlFor="gross-weight" className="block mb-1 font-semibold text-gray-700">Gross Weight:</label><input type="text" id="gross-weight" className="input-field" /></div>
                        <div><label htmlFor="destination" className="block mb-1 font-semibold text-gray-700">Destination:</label><input type="text" id="destination" className="input-field" /></div>
                        <div><label htmlFor="volume-weight" className="block mb-1 font-semibold text-gray-700">Volume Weight:</label><input type="text" id="volume-weight" className="input-field" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="sm:col-span-2">
                            <label htmlFor="description" className="block mb-1 font-semibold text-gray-700">Description:</label>
                            <input type="text" id="description" className="input-field" />
                        </div>
                        <div><label htmlFor="carrier" className="block mb-1 font-semibold text-gray-700">Carrier / Shipping Line / Trucking Co:</label><input type="text" id="carrier" className="input-field" /></div>
                        <div><label htmlFor="truck-no" className="block mb-1 font-semibold text-gray-700">Truck No. / Driver&apos;s Name:</label><input type="text" id="truck-no" className="input-field" /></div>
                        <div><label htmlFor="vessel-name" className="block mb-1 font-semibold text-gray-700">Vessel&apos;s Name:</label><input type="text" id="vessel-name" className="input-field" /></div>
                        <div><label htmlFor="flight-voyage-no" className="block mb-1 font-semibold text-gray-700">Flight / Voyage No.:</label><input type="text" id="flight-voyage-no" className="input-field" /></div>
                        <div><label htmlFor="container-no" className="block mb-1 font-semibold text-gray-700">Container No.:</label><input type="text" id="container-no" className="input-field" /></div>
                    </div>

                    {/* Charges Table */}
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-semibold text-gray-800">Charges</h2>
                        <div>
                            <button onClick={() => window.openChargeManager()} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-lg text-sm transition-transform transform hover:scale-105 mr-2">Manage Descriptions</button>
                            <button onClick={() => window.suggestCharges()} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded-lg text-sm transition-transform transform hover:scale-105">Suggest Charges ✨</button>
                        </div>
                    </div>
                    <div className="mb-6 overflow-x-auto border border-gray-200 rounded-lg">
                        <table id="charges-table" className="w-full border-collapse">
                        </table>
                    </div>
                    <div className="text-right mb-6">
                        <button onClick={() => window.addChargeRow()} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Add Charge</button>
                    </div>

                    {/* Remarks Section */}
                    <div className="mb-8">
                        <label htmlFor="remarks" className="block font-semibold text-gray-700 mb-2">REMARKS:</label>
                        <textarea id="remarks" rows={4} className="input-field w-full"></textarea>
                    </div>

                    {/* Creator/Editor Info */}
                    <div id="file-info" className="text-xs text-gray-500 mb-4 border-t pt-4">
                        <span id="created-by-info"></span>
                        <span id="last-updated-by-info" className="ml-4"></span>
                    </div>

                    {/* Footer Section */}
                    <footer className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t items-end">
                        <div><label className="block mb-2 font-semibold text-gray-700">PREPARED BY</label><input type="text" id="prepared-by" className="input-field bg-gray-100" readOnly /></div>
                        <div className="relative">
                            <div id="checked-stamp" className="stamp stamp-checked">Checked</div>
                            <label className="block mb-2 font-semibold text-gray-700">CHECKED BY</label>
                            <input type="text" id="checked-by" className="input-field bg-gray-100" readOnly />
                            <button id="check-btn" onClick={() => window.checkJobFile(null)} className="checker-only mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Check Job File</button>
                        </div>
                        <div className="relative">
                            <div id="approved-stamp" className="stamp stamp-approved">Approved</div>
                            <div id="rejected-stamp" className="stamp stamp-rejected">Rejected</div>
                            <label className="block mb-2 font-semibold text-gray-700">APPROVED BY</label>
                            <input type="text" id="approved-by" className="input-field bg-gray-100" readOnly />
                            <div id="approval-buttons" className="admin-only mt-2 w-full flex gap-2">
                                <button id="approve-btn" onClick={() => window.approveJobFile(null)} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">Approve</button>
                                <button id="reject-btn" onClick={() => window.promptForRejection(null)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">Reject</button>
                            </div>
                        </div>
                    </footer>
                    {/* Action Buttons */}
                    <div className="text-center mt-10 no-print flex flex-wrap justify-center gap-2 sm:gap-4">
                        <button onClick={() => window.openClientManager()} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                            <span>Clients</span>
                        </button>
                        <button onClick={() => window.openFileManager()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.586l.293.293a1 1 0 001.414 0L10.414 12l-1.293 1.293a1 1 0 000 1.414l.293.293V16a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm8 2a1 1 0 000-2H4a1 1 0 00-1 1v10a1 1 0 001 1h4a1 1 0 001-1v-1.586l-.293-.293a1 1 0 01-1.414 0L6.586 12l1.293-1.293a1 1 0 011.414 0l.293-.293V8z" clipRule="evenodd" /><path d="M18 8a2 2 0 00-2-2h-4l-2-2h-4a2 2 0 00-2 2v.5a1 1 0 002 0V6a1 1 0 011-1h2.586l2 2H16a1 1 0 011 1v8a1 1 0 01-1 1h-2.5a1 1 0 100 2H16a2 2 0 002-2V8z" /></svg>
                            <span>File Manager</span>
                        </button>
                        <button onClick={() => window.saveJobFile()} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586L7.707 10.293zM3 4a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1h-2a1 1 0 00-1 1v4a1 1 0 001 1h2a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 001-1V9a1 1 0 00-1-1H4a1 1 0 01-1-1V4z" /></svg>
                            <span>Save to DB</span>
                        </button>
                        <button onClick={() => window.clearForm()} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.898 0V3a1 1 0 112 0v2.101a7.002 7.002 0 01-11.898 0V3a1 1 0 01-1-1zM12 10a2 2 0 11-4 0 2 2 0 014 0zM4 10a2 2 0 00-2 2v2a2 2 0 002 2h12a2 2 0 002-2v-2a2 2 0 00-2-2h-1.101A7.002 7.002 0 0010 12c-2.256 0-4.233-.996-5.5-2.543A7.002 7.002 0 004 10z" clipRule="evenodd" /></svg>
                            <span>New Job</span>
                        </button>
                        <button onClick={() => window.printPage()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
                            <span>Print</span>
                        </button>
                    </div>

                </div>
            </div>

            {/* Hidden containers and Modals */}
            <div id="print-output" className="hidden"></div>
            <div id="public-view-container"></div>
            <div id="analytics-container" className="hidden">
                 {/* ... Analytics JSX ... */}
                 <div className="container">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 no-print">
                        <h3 className="text-2xl font-bold">Analytics Dashboard</h3>
                        <div>
                            <button onClick={() => window.printAnalytics()} title="Print Analytics" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded mr-4">🖨️ Print</button>
                            <button onClick={() => window.closeAnalyticsDashboard()} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded">Back to Job File</button>
                        </div>
                    </div>
                    <div id="analytics-body" className="space-y-6"></div>
                </div>
            </div>
            
            {/* Modals */}
            <div id="loader-overlay" className="overlay"><div className="loader"></div></div>
            <div id="notification"></div>
            
             {/* ... All other modals JSX ... */}
            <div id="file-manager-modal" className="overlay">
                <div className="modal-content max-w-5xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold">File Manager</h3>
                        <div>
                            <button onClick={() => window.openRecycleBin()} className="admin-only bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded text-sm mr-4">Recycle Bin</button>
                            <button onClick={() => window.closeModal('file-manager-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                        <div className="md:col-span-2">
                            <label htmlFor="search-bar" className="text-sm font-medium text-gray-700">Search</label>
                            <input type="text" id="search-bar" className="input-field mt-1" placeholder="Job No, Shipper, etc." />
                        </div>
                        <div>
                            <label htmlFor="filter-status" className="text-sm font-medium text-gray-700">Status</label>
                            <select id="filter-status" className="input-field mt-1">
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="checked">Checked</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-date-from" className="text-sm font-medium text-gray-700">From Date</label>
                            <input type="date" id="filter-date-from" className="input-field mt-1" />
                        </div>
                        <div>
                            <label htmlFor="filter-date-to" className="text-sm font-medium text-gray-700">To Date</label>
                            <input type="date" id="filter-date-to" className="input-field mt-1" />
                        </div>
                        <div className="flex items-end">
                            <button id="clear-filters-btn" className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded text-sm">Clear Filters</button>
                        </div>
                    </div>
                    <div id="job-files-list" className="space-y-2 max-h-[60vh] overflow-y-auto"></div>
                </div>
            </div>
            <div id="confirm-modal" className="overlay">
                <div className="modal-content max-w-sm">
                    <h3 className="text-lg font-bold mb-4" id="confirm-title">Confirm Action</h3>
                    <div id="confirm-message" className="mb-4 text-sm">Are you sure?</div>
                    <div className="text-right mt-6 space-x-2">
                        <button id="confirm-cancel" className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded">Cancel</button>
                        <button id="confirm-ok" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Confirm</button>
                    </div>
                </div>
            </div>
            <div id="preview-modal" className="overlay">
                <div className="modal-content max-w-4xl">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 no-print gap-2">
                        <h3 className="text-2xl font-bold">Job File Preview</h3>
                        <div>
                            <button onClick={() => window.printPreview()} title="Print Preview" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded mr-4">🖨️ Print</button>
                            <button onClick={() => window.closeModal('preview-modal')} className="text-gray-500 hover:text-gray-800 text-3xl align-middle">&times;</button>
                        </div>
                    </div>
                    <div id="preview-body"></div>
                </div>
            </div>
            <div id="admin-panel-modal" className="overlay">
                <div className="modal-content max-w-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold">Admin Panel</h3>
                        <button onClick={() => window.closeModal('admin-panel-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <div className="border rounded-lg p-4">
                        <h4 className="text-lg font-semibold mb-2">User Management</h4>
                        <div id="user-list" className="space-y-2 max-h-[40vh] overflow-y-auto"></div>
                        <div className="text-right mt-4">
                            <button onClick={() => window.saveUserChanges()} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Save User Changes</button>
                        </div>
                    </div>
                    <div className="border rounded-lg p-4 mt-6">
                        <h4 className="text-lg font-semibold mb-3">Data Backup & Restore</h4>
                        <p className="text-sm text-gray-600 mb-4">Backup all job files and user data to a single JSON file. This can be used for offline storage or to restore the database to a previous state.</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={() => window.backupAllData()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                Backup All Data
                            </button>
                            <label htmlFor="restore-file-input" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                Restore From File
                                <input type="file" id="restore-file-input" className="hidden" accept=".json" onChange={(e) => window.handleRestoreFile(e)} />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div id="reject-reason-modal" className="overlay">
                <div className="modal-content max-w-md">
                    <h3 className="text-lg font-bold mb-4">Rejection Reason</h3>
                    <p className="mb-4">Please provide a reason for rejecting this job file.</p>
                    <textarea id="rejection-reason-input" className="input-field w-full" rows={3}></textarea>
                    <div className="text-right mt-6 space-x-2">
                        <button onClick={() => window.closeModal('reject-reason-modal')} className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded">Cancel</button>
                        <button id="confirm-reject-btn" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Confirm Rejection</button>
                    </div>
                </div>
            </div>
            <div id="forgot-password-modal" className="overlay">
                <div className="modal-content max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Reset Password</h3>
                        <button onClick={() => window.closeModal('forgot-password-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <p className="mb-4 text-gray-600">Enter your email address and we will send you a link to reset your password.</p>
                    <div>
                        <label htmlFor="reset-email" className="sr-only">Email address</label>
                        <input id="reset-email" name="email" type="email" autoComplete="email" required className="input-field" placeholder="Email address" />
                    </div>
                    <div className="text-right mt-6">
                        <button id="send-reset-link-btn" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
                            Send Password Reset Link
                        </button>
                    </div>
                </div>
            </div>
            <div id="client-manager-modal" className="overlay">
                <div className="modal-content max-w-4xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold">Client Management</h3>
                        <button onClick={() => window.closeModal('client-manager-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 id="client-form-title" className="text-xl font-semibold mb-4">Add New Client</h4>
                            <form id="client-form" className="space-y-4">
                                <input type="hidden" id="client-id" />
                                <div>
                                    <label htmlFor="client-name" className="block text-sm font-medium text-gray-700">Client Name</label>
                                    <input type="text" id="client-name" className="input-field mt-1" required />
                                </div>
                                <div>
                                    <label htmlFor="client-address" className="block text-sm font-medium text-gray-700">Address</label>
                                    <textarea id="client-address" rows={2} className="input-field mt-1"></textarea>
                                </div>
                                <div>
                                    <label htmlFor="client-contact-person" className="block text-sm font-medium text-gray-700">Contact Person</label>
                                    <input type="text" id="client-contact-person" className="input-field mt-1" />
                                </div>
                                <div>
                                    <label htmlFor="client-phone" className="block text-sm font-medium text-gray-700">Phone</label>
                                    <input type="text" id="client-phone" className="input-field mt-1" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Client Type</label>
                                    <select id="client-type" className="input-field mt-1">
                                        <option value="Shipper">Shipper</option>
                                        <option value="Consignee">Consignee</option>
                                        <option value="Both">Both</option>
                                    </select>
                                </div>
                                <div className="flex gap-4">
                                    <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Save Client</button>
                                    <button type="button" id="clear-client-form-btn" className="w-full bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded">Clear</button>
                                </div>
                            </form>
                        </div>
                        <div>
                            <h4 className="text-xl font-semibold mb-4">Existing Clients</h4>
                            <input type="text" id="client-search-bar" className="input-field mb-4" placeholder="Search clients..." />
                            <div id="client-list" className="space-y-2 max-h-[50vh] overflow-y-auto">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
             <div id="charge-manager-modal" className="overlay">
                <div className="modal-content max-w-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold">Manage Charge Descriptions</h3>
                        <button onClick={() => window.closeModal('charge-manager-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-lg font-semibold mb-2">Add New Description</h4>
                            <div className="flex gap-2">
                                <input type="text" id="new-charge-description" className="input-field" placeholder="E.g., Customs Duty" />
                                <button onClick={() => window.saveChargeDescription()} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Add</button>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold mb-2">Existing Descriptions</h4>
                            <div id="charge-description-list" className="space-y-2 max-h-[50vh] overflow-y-auto">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="activity-log-modal" className="overlay">
                <div className="modal-content max-w-4xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold">User Activity Log</h3>
                        <button onClick={() => window.closeModal('activity-log-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="table-cell font-semibold text-left">User Name</th>
                                    <th className="table-cell font-semibold text-left">Job File No.</th>
                                    <th className="table-cell font-semibold text-left">Time Opened</th>
                                </tr>
                            </thead>
                            <tbody id="activity-log-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div id="user-jobs-modal" className="overlay">
                <div className="modal-content max-w-5xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 id="user-jobs-modal-title" className="text-2xl font-bold">User&apos;s Job Files</h3>
                        <button onClick={() => window.closeModal('user-jobs-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <div id="user-jobs-list" className="space-y-2 max-h-[70vh] overflow-y-auto">
                    </div>
                </div>
            </div>
            <div id="recycle-bin-modal" className="overlay">
                <div className="modal-content max-w-5xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold">Recycle Bin</h3>
                        <button onClick={() => window.closeModal('recycle-bin-modal')} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <div id="recycle-bin-list" className="space-y-2 max-h-[70vh] overflow-y-auto">
                    </div>
                </div>
            </div>
        </>
    );
}
