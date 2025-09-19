// Module for App Initialization
        document.addEventListener('DOMContentLoaded', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const jobIdFromUrl = urlParams.get('jobId');

            const storedDescriptions = localStorage.getItem('chargeDescriptions');
            if (storedDescriptions) {
                chargeDescriptions = JSON.parse(storedDescriptions);
            } else {
                chargeDescriptions = [
                    'Ex-works Charges:', 'Land/Air / Sea Freight:', 'Fuell Security / War Surcharge:', 'Formalities:', 'Delivery Order Fee:', 'Transportation Charges:', 'Inspection / Computer Print Charges:', 'Handling Charges:', 'Labor / Forklift Charges:', 'Documentation Charges:', 'Clearance Charges:', 'Customs Duty:', 'Terminal Handling Charges:', 'Legalization Charges:', 'Demurrage Charges:', 'Loading / Offloading Charges:', 'Destination Clearance Charges:', 'Packing Charges:', 'Port Charges:', 'Other Charges:', 'PAI Approval :', 'Insurance Fee :', 'EPA Charges :'
                ];
                localStorage.setItem('chargeDescriptions', JSON.stringify(chargeDescriptions));
            }

            if (jobIdFromUrl) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-container').style.display = 'none';
                showLoader();
                initializeFirebaseAndShowPublicView(jobIdFromUrl);
            } else {
                initializeFirebase();
            }
            // Load any saved GitHub configuration from localStorage on page load. This
            // ensures that runtime variables like GITHUB_OWNER and GITHUB_REPO are
            // initialized even if the admin panel hasn’t been opened yet. If no config
            // has been saved, defaults defined near the top of this file will be used.
            try {
                if (typeof loadGithubConfig === 'function') {
                    loadGithubConfig();
                }
            } catch (err) {
                console.warn('Failed to load GitHub configuration on startup:', err);
            }
            
            let isLogin = true;

            document.getElementById('auth-link').addEventListener('click', (e) => {
                e.preventDefault();
                isLogin = !isLogin;
                toggleAuthView(isLogin);
            });

            document.getElementById('auth-btn').addEventListener('click', () => {
                const email = document.getElementById('email-address').value;
                const password = document.getElementById('password').value;
                if (isLogin) {
                    handleLogin(email, password);
                } else {
                    const displayName = document.getElementById('full-name').value;
                     if (!email || !password || !displayName) {
                         showNotification("Please fill all fields to sign up.", true);
                         return;
                    }
                    handleSignUp(email, password, displayName);
                }
            });
            
            document.getElementById('logout-btn').addEventListener('click', handleLogout);
            document.getElementById('approve-btn').addEventListener('click', () => approveJobFile());
            document.getElementById('reject-btn').addEventListener('click', () => promptForRejection(null));
            document.getElementById('confirm-reject-btn').addEventListener('click', rejectJobFile);
            document.getElementById('check-btn').addEventListener('click', () => checkJobFile());
            document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
            document.getElementById('forgot-password-link').addEventListener('click', (e) => {
                e.preventDefault();
                openModal('forgot-password-modal');
            });
            document.getElementById('send-reset-link-btn').addEventListener('click', handleForgotPassword);

            document.getElementById('activity-log-btn').addEventListener('click', openUserActivityLog);

            document.getElementById('search-bar').addEventListener('input', applyFiltersAndDisplay);
            document.getElementById('filter-status').addEventListener('change', applyFiltersAndDisplay);
            document.getElementById('filter-date-from').addEventListener('change', applyFiltersAndDisplay);
            document.getElementById('filter-date-to').addEventListener('change', applyFiltersAndDisplay);
            document.getElementById('clear-filters-btn').addEventListener('click', () => {
                document.getElementById('search-bar').value = '';
                document.getElementById('filter-status').value = '';
                document.getElementById('filter-date-from').value = '';
                document.getElementById('filter-date-to').value = '';
                applyFiltersAndDisplay();
            });

            document.getElementById('client-form').addEventListener('submit', saveClient);
            document.getElementById('clear-client-form-btn').addEventListener('click', clearClientForm);
            document.getElementById('client-search-bar').addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredClients = clientsCache.filter(client => client.name.toLowerCase().includes(searchTerm));
                displayClients(filteredClients);
            });

            setupAutocomplete('shipper-name', 'shipper-suggestions', 'Shipper');
            setupAutocomplete('consignee-name', 'consignee-suggestions', 'Consignee');


            window.addEventListener('afterprint', () => {
                document.getElementById('main-container').style.display = 'block';
                document.getElementById('print-output').style.display = 'none';
            });
            
            window.openAnalyticsDashboard = openAnalyticsDashboard;
            window.closeAnalyticsDashboard = closeAnalyticsDashboard;
            window.openFileManager = () => openModal('file-manager-modal');
            window.openClientManager = openClientManager;
            window.saveJobFile = saveJobFile;
            window.clearForm = clearForm;
            window.printPage = printPage;
            window.closeModal = closeModal;
            window.saveUserChanges = saveUserChanges;
            window.sortAnalyticsTable = sortAnalyticsTable;
            window.downloadAnalyticsCsv = downloadAnalyticsCsv;
            window.previewJobFileById = previewJobFileById;
            window.loadJobFileById = loadJobFileById;
            window.confirmDelete = confirmDelete;
            window.editClient = editClient;
            window.printAnalytics = printAnalytics;
            window.printPreview = printPreview;
            window.generateRemarks = generateRemarks;
            window.suggestCharges = suggestCharges;
            window.backupAllData = backupAllData;
            window.handleRestoreFile = handleRestoreFile;
            window.showUserJobs = showUserJobs;
            window.showMonthlyJobs = showMonthlyJobs;
            window.showSalesmanJobs = showSalesmanJobs;
            window.showStatusJobs = showStatusJobs;
            window.checkJobFile = checkJobFile;
            window.approveJobFile = approveJobFile;
            window.uncheckJobFile = uncheckJobFile;
            window.openRecycleBin = openRecycleBin;
            window.restoreJobFile = restoreJobFile;
            window.confirmPermanentDelete = confirmPermanentDelete;
            window.filterAnalyticsByTimeframe = filterAnalyticsByTimeframe;
            window.promptForRejection = promptForRejection;
            window.displayAnalytics = displayAnalytics;
            window.openChargeManager = openChargeManager;
            window.saveChargeDescription = saveChargeDescription;
            window.deleteChargeDescription = deleteChargeDescription;
            window.addChargeRow = addChargeRow;

            // Expose GitHub configuration functions to the global scope for the admin panel
            window.saveGithubConfig = saveGithubConfig;
            window.loadGithubConfig = loadGithubConfig;

            populateTable();
            calculate();
            document.getElementById('date').valueAsDate = new Date();
        });