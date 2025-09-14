import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFirestore, initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { currentUser } from './state.js';


const firebaseConfig = {
    apiKey: "AIzaSyAAulR2nJQm-4QtNyEqKTnnDPw-iKW92Mc",
    authDomain: "my-job-file-system.firebaseapp.com",
    projectId: "my-job-file-system",
    storageBucket: "my-job-file-system.appspot.com",
    messagingSenderId: "145307873304",
    appId: "1:145307873304:web:d661ea6ec118801b4a136d",
    measurementId: "G-8EHX5K7YHL"
};

const app = initializeApp(firebaseConfig, 'jobfile-utils-secondary');
const db = getFirestore(app);


export function getFormData() {
    const getVal = id => document.getElementById(id).value || '';
    const getChecked = query => Array.from(document.querySelectorAll(query)).filter(el => el.checked).map(el => el.dataset.clearance || el.dataset.product);

    const charges = [];
    document.querySelectorAll('#charges-table-body tr:not(#total-row)').forEach(row => {
        const description = row.querySelector('.description-input').value.trim();
        const cost = row.querySelector('.cost-input').value;
        const selling = row.querySelector('.selling-input').value;

        if (description && (cost || selling)) {
            charges.push({
                l: description,
                c: cost || '0',
                s: selling || '0',
                n: row.querySelector('.notes-input').value || ''
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
}

export function logUserActivity(jobFileNo) {
    if (!currentUser) return;

    const logEntry = {
        user: currentUser.displayName,
        file: jobFileNo,
        timestamp: new Date().toISOString()
    };

    let logs = [];
    try {
        const storedLogs = localStorage.getItem('userActivityLog');
        if (storedLogs) {
            logs = JSON.parse(storedLogs);
        }
    } catch (e) {
        console.error("Error parsing user activity log from localStorage", e);
        logs = [];
    }

    logs.unshift(logEntry);
    if (logs.length > 200) logs.splice(200);
    localStorage.setItem('userActivityLog', JSON.stringify(logs));
}

export async function getJobFileById(docId) {
    const docRef = doc(db, 'jobfiles', docId.replace(/\//g, '_'));
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
}
