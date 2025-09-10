// =================================================================================
//  CORE APP LOGIC (script.js)
// =================================================================================
// This script manages the entire application logic for LocalPOD.
// It handles authentication, UI rendering, and data management using localStorage.
// This approach allows the app to function without a server-side backend.
// =================================================================================

const D = document;
const G = (id) => D.getElementById(id);

/**
 * A simple UI manager to handle screen transitions and modal displays.
 */
const UI = {
    showScreen: (screenId) => {
        D.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        G(screenId).classList.add('active');
    },
    showAuthForm: (formId) => {
        D.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        G(formId).classList.add('active');
    },
    render: (elementId, html) => {
        G(elementId).innerHTML = html;
    },
    showError: (elementId, message) => {
        const el = G(elementId);
        el.textContent = message;
        setTimeout(() => { el.textContent = ''; }, 3000);
    },
    showModal: (content) => {
        G('modal-body').innerHTML = content;
        G('modal').classList.add('active');
    },
    hideModal: () => {
        G('modal').classList.remove('active');
    }
};

/**
 * A localStorage-based database module to simulate a real backend.
 * All data is stored as JSON strings in the browser's localStorage.
 */
const DB = {
    _get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    _set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),

    getUsers: () => DB._get('users'),
    saveUser: (user) => {
        const users = DB.getUsers();
        users.push(user);
        DB._set('users', users);
    },
    findUser: (email) => DB.getUsers().find(user => user.email === email),

    getPods: () => DB._get('pods'),
    savePod: (pod) => {
        const pods = DB.getPods();
        pods.push(pod);
        DB._set('pods', pods);
    }
};

/**
 * Manages user authentication, session, and roles.
 */
const Auth = {
    currentUser: null,

    init() {
        const userJson = sessionStorage.getItem('currentUser');
        if (userJson) {
            this.currentUser = JSON.parse(userJson);
            return true;
        }
        return false;
    },

    login(email, password) {
        const user = DB.findUser(email);
        // In a real app, 'password' would be checked against a hashed password.
        if (user && user.password === password) { 
            this.currentUser = { email: user.email, name: user.name, role: user.role };
            sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            return true;
        }
        return false;
    },

    register(name, email, password) {
        if (DB.findUser(email)) {
            return { success: false, message: 'User with this email already exists.' };
        }
        const users = DB.getUsers();
        // The first user to register becomes an admin. All subsequent users are drivers.
        const role = users.length === 0 ? 'admin' : 'driver'; 
        
        const newUser = {
            id: `user_${Date.now()}`,
            name,
            email,
            password, // IMPORTANT: In a real app, this MUST be securely hashed on the server.
            role,
            approved: role === 'admin' // Admin is auto-approved
        };
        DB.saveUser(newUser);
        return { success: true, message: 'Registration successful! Please log in.' };
    },

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('currentUser');
        App.init(); // Re-initialize the app to show the login screen
    }
};

/**
 * The main application controller.
 * Initializes the app, sets up event listeners, and routes users to the correct dashboard.
 */
const App = {
    init() {
        if (Auth.init()) {
            this.loadDashboard();
        } else {
            UI.showScreen('auth-screen');
            UI.showAuthForm('login-form');
        }
        this.setupEventListeners();
    },

    loadDashboard() {
        const user = Auth.currentUser;
        if (!user) return;

        G('user-greeting').textContent = `Hello, ${user.name}`;
        UI.showScreen('main-app');
        
        if (user.role === 'admin') {
            this.renderAdminDashboard();
        } else if (user.role === 'driver') {
            this.renderDriverDashboard();
        }
    },
    
    renderAdminDashboard() {
        const drivers = DB.getUsers().filter(u => u.role ==='driver').length;
        const adminHtml = `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Total PODs</h3>
                    <p class="stat">0</p>
                </div>
                <div class="dashboard-card">
                    <h3>Pending Deliveries</h3>
                    <p class="stat">0</p>
                </div>
                 <div class="dashboard-card">
                    <h3>Drivers</h3>
                    <p class="stat">${drivers}</p>
                </div>
                <div class="dashboard-card full-width">
                   <h3>Create New POD</h3>
                   <p>Feature coming soon...</p>
                </div>
            </div>
        `;
        UI.render('app-content', adminHtml);
    },

    renderDriverDashboard() {
        const driverHtml = `
            <div class="dashboard-grid">
                 <div class="dashboard-card">
                    <h3>Assigned PODs</h3>
                    <p class="stat">0</p>
                </div>
                <div class="dashboard-card">
                    <h3>Completed Today</h3>
                    <p class="stat">0</p>
                </div>
                 <div class="dashboard-card">
                    <h3>My Rating</h3>
                    <p class="stat">N/A</p>
                </div>
                 <div class="dashboard-card full-width">
                   <h3>My Assigned Jobs</h3>
                   <p>No jobs assigned yet.</p>
                </div>
            </div>
        `;
        UI.render('app-content', driverHtml);
    },
    
    setupEventListeners() {
        // --- Auth Form Event Listeners ---
        G('show-register').addEventListener('click', () => UI.showAuthForm('register-form'));
        G('show-login').addEventListener('click', () => UI.showAuthForm('login-form'));

        G('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = G('login-email').value;
            const password = G('login-password').value;
            if (Auth.login(email, password)) {
                this.loadDashboard();
            } else {
                UI.showError('login-error', 'Invalid email or password.');
            }
        });
        
        G('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = G('register-name').value;
            const email = G('register-email').value;
            const password = G('register-password').value;
            const result = Auth.register(name, email, password);
            if(result.success) {
                alert(result.message); // Simple alert for now
                UI.showAuthForm('login-form');
                G('register-form').reset();
            } else {
                UI.showError('register-error', result.message);
            }
        });
        
        // --- Main App Event Listeners ---
        G('logout-btn').addEventListener('click', () => Auth.logout());
        
        // --- Modal Event Listeners ---
        G('modal-close-btn').addEventListener('click', UI.hideModal);
        G('modal').addEventListener('click', (e) => {
            // Close modal if clicking on the background overlay
            if (e.target.id === 'modal') UI.hideModal();
        });
    }
};

// Initialize the application when the DOM is fully loaded.
D.addEventListener('DOMContentLoaded', () => App.init());
