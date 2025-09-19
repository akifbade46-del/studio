// Module for Admin Panel & Backup/Restore Logic
        async function openAdminPanel() {
            if (currentUser.role !== 'admin') {
                showNotification("Access denied.", true);
                return;
            }
            showLoader();
            const usersCollectionRef = collection(db, 'users');
            const userQuerySnapshot = await getDocs(usersCollectionRef);
            const userListDiv = document.getElementById('user-list');
            let userListHtml = '';

            userQuerySnapshot.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                const isDisabled = userId === currentUser.uid;
                userListHtml += `
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center p-2 border-b">
                        <input type="text" data-uid="${userId}" class="display-name-input input-field col-span-1" value="${userData.displayName}" ${isDisabled ? 'disabled' : ''}>
                        <select data-uid="${userId}" class="role-select input-field col-span-1" ${isDisabled ? 'disabled' : ''}>
                            <option value="user" ${userData.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="checker" ${userData.role === 'checker' ? 'selected' : ''}>Checker</option>
                            <option value="driver" ${userData.role === 'driver' ? 'selected' : ''}>Driver</option>
                            <option value="warehouse_supervisor" ${userData.role === 'warehouse_supervisor' ? 'selected' : ''}>Warehouse Supervisor</option>
                            <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <select data-uid="${userId}" class="status-select input-field col-span-1" ${isDisabled ? 'disabled' : ''}>
                            <option value="active" ${userData.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${userData.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                            <option value="blocked" ${userData.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                        </select>
                    </div>
                `;
            });
            userListDiv.innerHTML = userListHtml;
            // Load stored GitHub configuration into the Admin Panel form
            loadGithubConfig();
            hideLoader();
            openModal('admin-panel-modal');
        }

        async function saveUserChanges() {
            showLoader();
            const batch = writeBatch(db);
            const userRows = document.querySelectorAll('#user-list > div');
            
            userRows.forEach(row => {
                const nameInput = row.querySelector('.display-name-input');
                if (nameInput.disabled) return;

                const roleSelect = row.querySelector('.role-select');
                const statusSelect = row.querySelector('.status-select');
                const uid = nameInput.dataset.uid;
                
                const userDocRef = doc(db, 'users', uid);
                batch.update(userDocRef, { 
                    displayName: nameInput.value,
                    role: roleSelect.value,
                    status: statusSelect.value
                });
            });

            try {
                await batch.commit();
                hideLoader();
                showNotification("User details updated successfully!");
                closeModal('admin-panel-modal');
            } catch (error) {
                hideLoader();
                console.error("Error updating roles: ", error);
                showNotification("Failed to update user details.", true);
            }
        }

        async function backupAllData() {
            if (currentUser.role !== 'admin') {
                showNotification("Access denied. Only admins can perform backups.", true);
                return;
            }
            showLoader();
            try {
                const jobFilesQuery = query(collection(db, 'jobfiles'));
                const usersQuery = query(collection(db, 'users'));

                const jobFilesSnapshot = await getDocs(jobFilesQuery);
                const usersSnapshot = await getDocs(usersQuery);

                const jobfilesData = jobFilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const backupData = {
                    version: "1.0",
                    createdAt: new Date().toISOString(),
                    data: {
                        jobfiles: jobfilesData,
                        users: usersData
                    }
                };

                const jsonString = JSON.stringify(backupData, (key, value) => {
                    if (value && typeof value.toDate === 'function') {
                        return value.toDate().toISOString();
                    }
                    return value;
                }, 2);

                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const date = new Date().toISOString().slice(0, 10);
                link.download = `qgo-cargo-backup-${date}.json`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);

                showNotification("Backup created and download started successfully.");

            } catch (error) {
                console.error("Backup failed:", error);
                showNotification("An error occurred during backup.", true);
            } finally {
                hideLoader();
            }
        }

        async function handleRestoreFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            if (currentUser.role !== 'admin') {
                showNotification("Access denied. Only admins can restore data.", true);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                try {
                    const backupData = JSON.parse(content);

                    if (!backupData.data || !backupData.data.jobfiles || !backupData.data.users) {
                        showNotification("Invalid backup file format.", true);
                        return;
                    }

                    const jobFileCount = backupData.data.jobfiles.length;
                    const userCount = backupData.data.users.length;

                    const modal = document.getElementById('confirm-modal');
                    modal.querySelector('#confirm-title').textContent = 'Confirm Data Restore';
                    modal.querySelector('#confirm-message').innerHTML = `
                        <p>You are about to restore <b>${jobFileCount} job files</b> and <b>${userCount} users</b> from the selected file.</p>
                        <p class="mt-2">This will <b class="underline">overwrite any existing data</b> with the content from the backup file. Documents not in the backup file will not be affected.</p>
                        <p class="mt-2 text-red-600 font-bold">This action cannot be undone. Are you sure you want to proceed?</p>
                    `;
                    modal.querySelector('#confirm-ok').className = 'bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded';
                    openModal('confirm-modal');

                    const okButton = modal.querySelector('#confirm-ok');
                    const cancelButton = modal.querySelector('#confirm-cancel');

                    const onOk = async () => {
                        closeConfirm();
                        showLoader();
                        try {
                            // Restore users into Firestore using a batch
                            const restoreBatch = writeBatch(db);
                            backupData.data.users.forEach(user => {
                                const docRef = doc(db, 'users', user.id);
                                const { id, ...dataToRestore } = user;
                                restoreBatch.set(docRef, dataToRestore);
                            });
                            await restoreBatch.commit();

                            // Restore job files to GitHub
                            if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_BRANCH || !GITHUB_TOKEN) {
                                showNotification('GitHub configuration is incomplete. Please configure GitHub before restoring job files.', true);
                            } else {
                                for (const jobFile of backupData.data.jobfiles) {
                                    const { id, ...dataToRestore } = jobFile;
                                    // Convert Firestore Timestamp objects to ISO strings
                                    Object.keys(dataToRestore).forEach(key => {
                                        const val = dataToRestore[key];
                                        if (val && typeof val === 'object' && val.seconds !== undefined) {
                                            dataToRestore[key] = new Date(val.seconds * 1000).toISOString();
                                        }
                                    });
                                    try {
                                        await saveJobFileToGitHub(dataToRestore, id);
                                    } catch (err) {
                                        console.error('Failed to save job file to GitHub:', id, err);
                                    }
                                }
                                // Refresh the job file list from GitHub
                                if (typeof loadJobFiles === 'function') {
                                    await loadJobFiles();
                                }
                                showNotification('Data restored successfully!');
                            }
                        } catch (error) {
                            console.error('Restore failed:', error);
                            showNotification('An error occurred during restore. Data may be partially restored.', true);
                        } finally {
                            hideLoader();
                        }
                    };

                    const closeConfirm = () => {
                        closeModal('confirm-modal');
                        okButton.removeEventListener('click', onOk);
                    };

                    okButton.addEventListener('click', onOk, { once: true });
                    cancelButton.addEventListener('click', closeConfirm, { once: true });

                } catch (error) {
                    console.error("Error reading restore file:", error);
                    showNotification("Failed to read or parse the backup file. Please ensure it's a valid JSON backup.", true);
                } finally {
                    event.target.value = '';
                }
            };

            reader.readAsText(file);
        }


