// Module for GitHub Configuration
        // These runtime variables store the GitHub details used for saving job files.
        // They can be modified through the Admin Panel UI.
        let GITHUB_OWNER = '';
        let GITHUB_REPO = '';
        let GITHUB_BRANCH = 'main';
        let GITHUB_DATA_PATH = 'jobfiles';
        let GITHUB_TOKEN = '';

        /**
         * Upload or update a JSON representation of a job file in GitHub.
         *
         * @param {Object} jobData - Plain object containing job file data.
         * @param {string} docId - Identifier used to name the JSON file.
         */
        async function saveJobFileToGitHub(jobData, docId) {
            // Ensure configuration is provided
            if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
                console.warn('GitHub configuration is incomplete; skipping GitHub save.');
                return;
            }
            const contentString = JSON.stringify(jobData, null, 2);
            const contentBase64 = btoa(unescape(encodeURIComponent(contentString)));
            const fullPath = GITHUB_DATA_PATH ? `${GITHUB_DATA_PATH}/${docId}.json` : `${docId}.json`;
            const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${fullPath}`;
            // Check if file exists to get its SHA
            let sha = null;
            try {
                const getRes = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github+json'
                    }
                });
                if (getRes.ok) {
                    const info = await getRes.json();
                    sha = info.sha;
                }
            } catch (err) {
                // Ignore errors on check
            }
            const payload = {
                message: sha ? `Update job file ${docId}` : `Add job file ${docId}`,
                content: contentBase64,
                branch: GITHUB_BRANCH || 'main'
            };
            if (sha) payload.sha = sha;
            const putRes = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!putRes.ok) {
                const errorBody = await putRes.json().catch(() => ({}));
                throw new Error(`GitHub save failed: ${putRes.status} ${putRes.statusText} ${errorBody.message || ''}`);
            }
            return await putRes.json();
        }

        // Load GitHub configuration from localStorage and populate input fields if present
        function loadGithubConfig() {
            try {
                const cfgStr = localStorage.getItem('githubConfig');
                if (!cfgStr) return;
                const cfg = JSON.parse(cfgStr);
                if (cfg.owner) {
                    GITHUB_OWNER = cfg.owner;
                    const input = document.getElementById('github-owner');
                    if (input) input.value = cfg.owner;
                }
                if (cfg.repo) {
                    GITHUB_REPO = cfg.repo;
                    const input = document.getElementById('github-repo');
                    if (input) input.value = cfg.repo;
                }
                if (cfg.branch) {
                    GITHUB_BRANCH = cfg.branch;
                    const input = document.getElementById('github-branch');
                    if (input) input.value = cfg.branch;
                }
                if (cfg.path) {
                    GITHUB_DATA_PATH = cfg.path;
                    const input = document.getElementById('github-path');
                    if (input) input.value = cfg.path;
                }
                if (cfg.token) {
                    GITHUB_TOKEN = cfg.token;
                    const input = document.getElementById('github-token');
                    if (input) input.value = cfg.token;
                }
            } catch (err) {
                console.error('Failed to load GitHub config:', err);
            }
        }

        // Save GitHub configuration from the Admin Panel form into localStorage and update runtime variables.
        function saveGithubConfig() {
            const owner = (document.getElementById('github-owner').value || '').trim();
            const repo = (document.getElementById('github-repo').value || '').trim();
            const branch = (document.getElementById('github-branch').value || '').trim();
            const path = (document.getElementById('github-path').value || '').trim();
            const token = (document.getElementById('github-token').value || '').trim();
            const cfg = { owner, repo, branch, path, token };
            try {
                localStorage.setItem('githubConfig', JSON.stringify(cfg));
                if (owner) GITHUB_OWNER = owner;
                if (repo) GITHUB_REPO = repo;
                if (branch) GITHUB_BRANCH = branch;
                if (path || path === '') GITHUB_DATA_PATH = path;
                if (token) GITHUB_TOKEN = token;
            showNotification('GitHub configuration saved!');
            // Reload job files from the newly configured GitHub repository
            try {
                if (typeof loadJobFiles === 'function') {
                    loadJobFiles();
                }
            } catch (err) {
                console.error('Failed to reload job files after updating GitHub config:', err);
            }
            } catch (err) {
                console.error('Failed to save GitHub configuration:', err);
                showNotification('Failed to save GitHub configuration.', true);
            }
        }
        async function saveJobFile() {
            // Validate required values
            const jobFileNoInput = document.getElementById('job-file-no');
            const jobFileNo = jobFileNoInput.value.trim();
            const isUpdating = jobFileNoInput.disabled;
            const invoiceNo = document.getElementById('invoice-no').value.trim();
            const mawbNo = document.getElementById('mawb').value.trim();

            if (!jobFileNo) {
                showNotification("Please enter a Job File No.", true);
                return;
            }
            if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH || !GITHUB_TOKEN) {
                showNotification('GitHub configuration is incomplete.', true);
                return;
            }
            showLoader();
            const docId = jobFileNo.replace(/\//g, '_');
            // Duplicate checks using jobFilesCache
            const checks = [];
            if (!isUpdating) {
                checks.push({ field: 'jfn', value: jobFileNo, label: 'Job File No.' });
            }
            if (invoiceNo) checks.push({ field: 'in', value: invoiceNo, label: 'Invoice No.' });
            if (mawbNo) checks.push({ field: 'mawb', value: mawbNo, label: 'MAWB No.' });
            for (const check of checks) {
                const duplicate = jobFilesCache.find(file => file[check.field] === check.value);
                if (duplicate) {
                    if (isUpdating && duplicate.id !== docId) {
                        hideLoader();
                        showNotification(`Duplicate ${check.label} "${check.value}" found in job file: ${duplicate.jfn}`, true);
                        return;
                    }
                    if (!isUpdating) {
                        hideLoader();
                        showNotification(`Duplicate ${check.label} "${check.value}" already exists in job file: ${duplicate.jfn}`, true);
                        return;
                    }
                }
            }
            // Build data
            const data = getFormData();
            data.totalCost = parseFloat(document.getElementById('total-cost').textContent) || 0;
            data.totalSelling = parseFloat(document.getElementById('total-selling').textContent) || 0;
            data.totalProfit = parseFloat(document.getElementById('total-profit').textContent) || 0;
            const nowISO = new Date().toISOString();
            data.lastUpdatedBy = currentUser.displayName;
            data.updatedAt = nowISO;
            data.jfn = jobFileNo;
            if (!isUpdating) {
                data.createdBy = currentUser.displayName;
                data.createdAt = nowISO;
                data.status = data.status || 'pending';
            }
            try {
                await saveJobFileToGitHub(data, docId);
                jobFileNoInput.disabled = true;
                showNotification('Job file saved successfully!');
                // Update in-memory cache
                const idx = jobFilesCache.findIndex(file => file.id === docId);
                if (idx >= 0) {
                    jobFilesCache[idx] = { id: docId, ...data };
                } else {
                    jobFilesCache.push({ id: docId, ...data });
                }
                // Reload UI
                displayJobFiles(jobFilesCache);
                updateStatusSummary('status-summary-main', jobFilesCache);
                loadJobFileById(docId);
            } catch (error) {
                console.error('Error saving job file to GitHub:', error);
                showNotification('Error saving job file.', true);
            } finally {
                hideLoader();
            }
        }
        
        async function checkJobFile(docId = null) {
            if (!currentUser || !['admin', 'checker'].includes(currentUser.role)) {
                showNotification("You do not have permission to check files.", true);
                return;
            }

            let fileId = docId;
            if (!fileId) {
                const jobFileNo = document.getElementById('job-file-no').value.trim();
                if (!jobFileNo) {
                    showNotification("Please save or load a job file first.", true);
                    return;
                }
                fileId = jobFileNo.replace(/\//g, '_');
            }
            
            showLoader();
            const checkData = {
                checkedBy: currentUser.displayName,
                checkedAt: serverTimestamp(),
                status: 'checked'
            };
            
            try {
                const docRef = doc(db, 'jobfiles', fileId);
                await setDoc(docRef, checkData, { merge: true });
                
                if (!docId) {
                    const updatedDoc = await getDoc(docRef);
                    populateFormFromData(updatedDoc.data());
                } else {
                    refreshOpenModals();
                }
                
                hideLoader();
                showNotification("Job File Checked!");

            } catch (error) {
                hideLoader();
                console.error("Error checking document: ", error);
                showNotification("Error checking job file.", true);
            }
        }

        async function uncheckJobFile(docId) {
            if (!currentUser || !['admin', 'checker'].includes(currentUser.role)) {
                showNotification("You do not have permission to uncheck files.", true);
                return;
            }
            showLoader();
            const uncheckData = {
                checkedBy: null,
                checkedAt: null,
                status: 'pending'
            };
            try {
                const docRef = doc(db, 'jobfiles', docId);
                await setDoc(docRef, uncheckData, { merge: true });
                hideLoader();
                showNotification("Job File Unchecked!");
                refreshOpenModals();
            } catch (error) {
                hideLoader();
                console.error("Error unchecking document: ", error);
                showNotification("Error unchecking job file.", true);
            }
        }

        async function approveJobFile(docId = null) {
            if (currentUser.role !== 'admin') {
                showNotification("Only admins can approve job files.", true);
                return;
            }
            
            let fileId = docId;
            if (!fileId) {
                const jobFileNo = document.getElementById('job-file-no').value.trim();
                 if (!jobFileNo) {
                    showNotification("Please save or load a job file first.", true);
                    return;
                }
                fileId = jobFileNo.replace(/\//g, '_');
            }

            showLoader();
            const approvalData = {
                approvedBy: currentUser.displayName,
                approvedAt: serverTimestamp(),
                status: 'approved',
                rejectionReason: null,
                rejectedBy: null,
                rejectedAt: null
            };
            
            try {
                const docRef = doc(db, 'jobfiles', fileId);
                await setDoc(docRef, approvalData, { merge: true });

                if (!docId) {
                    const updatedDoc = await getDoc(docRef);
                    populateFormFromData(updatedDoc.data());
                } else {
                    refreshOpenModals();
                }

                hideLoader();
                showNotification("Job File Approved!");

            } catch (error) {
                hideLoader();
                console.error("Error approving document: ", error);
                showNotification("Error approving job file.", true);
            }
        }

        function promptForRejection(docId) {
            fileIdToReject = docId;
            openModal('reject-reason-modal', true);
        }

        async function rejectJobFile() {
            const reason = document.getElementById('rejection-reason-input').value.trim();
            if (!reason) {
                showNotification("Rejection reason is required.", true);
                return;
            }

            const docId = fileIdToReject || document.getElementById('job-file-no').value.replace(/\//g, '_');
            if (!docId) {
                 showNotification("No file selected for rejection.", true);
                 return;
            }

            showLoader();
            const rejectionData = {
                rejectedBy: currentUser.displayName,
                rejectedAt: serverTimestamp(),
                rejectionReason: reason,
                status: 'rejected'
            };

            try {
                const docRef = doc(db, 'jobfiles', docId);
                await setDoc(docRef, rejectionData, { merge: true });
                
                if (fileIdToReject) {
                    refreshOpenModals();
                } else {
                    const updatedDoc = await getDoc(docRef);
                    populateFormFromData(updatedDoc.data());
                }
                
                hideLoader();
                closeModal('reject-reason-modal');
                document.getElementById('rejection-reason-input').value = '';
                fileIdToReject = null;
                showNotification("Job File Rejected!");
            } catch (error) {
                hideLoader();
                console.error("Error rejecting document: ", error);
                showNotification("Error rejecting job file.", true);
            }
        }

        /**
         * Load the list of job files from GitHub instead of Firestore. This function
         * queries the configured GitHub repository and downloads each JSON file
         * within the configured path. The resulting objects are stored in
         * jobFilesCache and passed to the UI for display. If the GitHub
         * configuration is incomplete or a network error occurs, an error
         * notification will be shown.
         */
        async function loadJobFiles() {
            // Ensure GitHub is configured
            if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH || !GITHUB_TOKEN) {
                console.warn('GitHub configuration is incomplete; cannot load job files.');
                jobFilesCache = [];
                displayJobFiles([]);
                return;
            }
            showLoader();
            try {
                const path = GITHUB_DATA_PATH ? `${GITHUB_DATA_PATH}` : '';
                const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
                const res = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github+json'
                    }
                });
                if (!res.ok) {
                    throw new Error(`GitHub API returned ${res.status} ${res.statusText}`);
                }
                const items = await res.json();
                const jobfilesList = [];
                for (const item of items) {
                    if (item.type === 'file' && item.name.endsWith('.json')) {
                        try {
                            const fileRes = await fetch(item.download_url);
                            if (!fileRes.ok) continue;
                            const fileData = await fileRes.json();
                            // Add an id property equal to filename (without extension)
                            const id = item.name.replace(/\.json$/, '');
                            jobfilesList.push({ id, ...fileData });
                        } catch (innerErr) {
                            console.warn('Error parsing job file', item.name, innerErr);
                        }
                    }
                }
                jobFilesCache = jobfilesList;
                // Sort by updatedAt descending if available
                const sortedDocs = [...jobfilesList].sort((a,b) => {
                    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                    return bTime - aTime;
                });
                displayJobFiles(sortedDocs);
                updateStatusSummary('status-summary-main', jobfilesList);
            } catch (error) {
                console.error('Error loading job files from GitHub:', error);
                showNotification('Error loading job files.', true);
            } finally {
                hideLoader();
            }
        }

        function displayJobFiles(files) {
            const list = document.getElementById('job-files-list');
            if (files.length === 0) {
                 list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files match the current filters.</p>`;
                 return;
            }
            let filesHtml = '';
            files.forEach((docData) => {
                const deleteButton = currentUser.role === 'admin' ? `<button onclick="confirmDelete('${docData.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm">Delete</button>` : '';
                // Normalize last updated timestamp for both Firestore Timestamp and ISO string
                let lastUpdated = 'N/A';
                if (docData.updatedAt) {
                    if (typeof docData.updatedAt.toDate === 'function') {
                        try {
                            lastUpdated = docData.updatedAt.toDate().toLocaleString();
                        } catch (e) {}
                    } else {
                        const d = new Date(docData.updatedAt);
                        if (!isNaN(d.getTime())) {
                            lastUpdated = d.toLocaleString();
                        }
                    }
                }
                
                const searchTerm = [docData.jfn, docData.sh, docData.co].join(' ').toLowerCase();

                filesHtml += `
                    <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2" 
                         data-search-term="${searchTerm}">
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
        }

        function logUserActivity(jobFileNo) {
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

            if (logs.length > 200) {
                logs.splice(200);
            }

            localStorage.setItem('userActivityLog', JSON.stringify(logs));
        }
        
        function openUserActivityLog() {
            const logBody = document.getElementById('activity-log-body');
            let logs = [];
            try {
                const storedLogs = localStorage.getItem('userActivityLog');
                if (storedLogs) {
                    logs = JSON.parse(storedLogs);
                }
            } catch (e) {
                console.error("Error parsing user activity log from localStorage", e);
            }

            if (logs.length === 0) {
                logBody.innerHTML = '<tr><td colspan="3" class="table-cell text-center p-4">No user activity recorded yet.</td></tr>';
            } else {
                logBody.innerHTML = logs.map(entry => `
                    <tr class="border-b">
                        <td class="table-cell">${entry.user || 'Unknown'}</td>
                        <td class="table-cell font-medium">${entry.file || 'N/A'}</td>
                        <td class="table-cell text-gray-600">${new Date(entry.timestamp).toLocaleString()}</td>
                    </tr>
                `).join('');
            }

            openModal('activity-log-modal');
        }


        async function loadJobFileById(docId) {
            showLoader();
            try {
                // Build GitHub raw URL to fetch the JSON content
                if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH) {
                    throw new Error('GitHub configuration is incomplete');
                }
                const pathPrefix = GITHUB_DATA_PATH ? `${GITHUB_DATA_PATH}/` : '';
                const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${pathPrefix}${docId}.json`;
                const res = await fetch(rawUrl, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                if (!res.ok) {
                    throw new Error(`GitHub returned ${res.status} ${res.statusText}`);
                }
                const fileData = await res.json();
                populateFormFromData(fileData);
                if (fileData.jfn) {
                    logUserActivity(fileData.jfn);
                }
                document.getElementById('job-file-no').disabled = true;
                closeAllModals();
                showNotification("Job file loaded successfully.");
            } catch (error) {
                console.error('Error loading job file from GitHub:', error);
                showNotification("Error loading job file.", true);
            } finally {
                hideLoader();
            }
        }

        async function previewJobFileById(docId) {
            showLoader();
            try {
                if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH) {
                    throw new Error('GitHub configuration is incomplete');
                }
                const pathPrefix = GITHUB_DATA_PATH ? `${GITHUB_DATA_PATH}/` : '';
                const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${pathPrefix}${docId}.json`;
                const res = await fetch(rawUrl, {
                    headers: { 'Accept': 'application/json' }
                });
                if (!res.ok) {
                    throw new Error(`GitHub returned ${res.status} ${res.statusText}`);
                }
                const data = await res.json();
                const previewBody = document.getElementById('preview-body');
                previewBody.innerHTML = getPrintViewHtml(data, false);
                const qrContainer = previewBody.querySelector('.qrcode-container');
                if (qrContainer && data.jfn) {
                    qrContainer.innerHTML = '';
                    const baseUrl = window.location.href.split('?')[0];
                    const qrText = `${baseUrl}?jobId=${encodeURIComponent(data.jfn)}`;
                    new QRCode(qrContainer, {
                        text: qrText,
                        width: 96,
                        height: 96,
                        correctLevel: QRCode.CorrectLevel.H
                    });
                }
                openModal('preview-modal', true);
            } catch (error) {
                console.error('Error previewing job file from GitHub:', error);
                showNotification('Error previewing job file.', true);
            } finally {
                hideLoader();
            }
        }
        
        async function moveToRecycleBin(docId) {
            showLoader();
            try {
                const docRef = doc(db, 'jobfiles', docId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const dataToMove = docSnap.data();
                    dataToMove.deletedAt = serverTimestamp();
                    dataToMove.deletedBy = currentUser.displayName;
                    
                    const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
                    await setDoc(deletedDocRef, dataToMove);
                    await deleteDoc(docRef);
                    
                    showNotification("Job file moved to recycle bin.");
                } else {
                    throw new Error("Document not found in main collection.");
                }
            } catch (error) {
                console.error("Error moving to recycle bin:", error);
                showNotification("Error deleting job file.", true);
            } finally {
                hideLoader();
            }
        }

        function confirmDelete(docId, type = 'jobfile') {
             if (currentUser.role !== 'admin') {
                 showNotification("Only admins can delete files.", true);
                 return;
            }
            const modal = document.getElementById('confirm-modal');
            let message = '';
            let onOk;

            if (type === 'jobfile') {
                modal.querySelector('#confirm-title').textContent = 'Confirm Job File Deletion';
                message = `Are you sure you want to move job file "${docId.replace(/_/g, '/')}" to the recycle bin?`;
                onOk = () => moveToRecycleBin(docId);
            } else if (type === 'client') {
                modal.querySelector('#confirm-title').textContent = 'Confirm Client Deletion';
                const client = clientsCache.find(c => c.id === clientId);
                message = `Are you sure you want to delete the client "${client?.name || 'this client'}"? This action cannot be undone.`;
                onOk = () => deleteClient(docId);
            }

            modal.querySelector('#confirm-message').innerHTML = message;
            modal.querySelector('#confirm-ok').className = 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded';
            openModal('confirm-modal', true);

            const okButton = modal.querySelector('#confirm-ok');
            const cancelButton = modal.querySelector('#confirm-cancel');

            const handleOkClick = () => {
                onOk();
                closeConfirm();
            };
            const closeConfirm = () => {
                closeModal('confirm-modal');
                okButton.removeEventListener('click', handleOkClick);
            };
            
            okButton.addEventListener('click', handleOkClick, { once: true });
            cancelButton.addEventListener('click', closeConfirm, { once: true });
        }

