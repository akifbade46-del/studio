// Module for Client Management Functions
        function openClientManager() { openModal('client-manager-modal'); }

        function loadClients() {
            if (!db) return;
            const clientsCollection = collection(db, 'clients');
            onSnapshot(query(clientsCollection), (snapshot) => {
                clientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                clientsCache.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
                displayClients(clientsCache);
            }, (error) => {
                console.error("Error loading clients:", error);
                showNotification("Could not load clients.", true);
            });
        }

        function displayClients(clients) {
            const list = document.getElementById('client-list');
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
        }

        async function saveClient(event) {
            event.preventDefault();
            const clientId = document.getElementById('client-id').value;
            const clientName = document.getElementById('client-name').value.trim();

            if (!clientName) {
                showNotification("Client name is required.", true);
                return;
            }

            const clientData = {
                name: clientName,
                address: document.getElementById('client-address').value.trim(),
                contactPerson: document.getElementById('client-contact-person').value.trim(),
                phone: document.getElementById('client-phone').value.trim(),
                type: document.getElementById('client-type').value,
                updatedAt: serverTimestamp()
            };

            showLoader();
            try {
                let docRef;
                if (clientId) {
                    // Update existing client
                    docRef = doc(db, 'clients', clientId);
                    await setDoc(docRef, clientData, { merge: true });
                    showNotification("Client updated successfully!");
                } else {
                    // Add new client
                    clientData.createdAt = serverTimestamp();
                    const clientsCollection = collection(db, 'clients');
                    docRef = await addDoc(clientsCollection, clientData);
                    showNotification("Client added successfully!");
                }
                clearClientForm();
            } catch (error) {
                console.error("Error saving client:", error);
                showNotification("Could not save client.", true);
            } finally {
                hideLoader();
            }
        }
        
        function clearClientForm() {
            document.getElementById('client-form').reset();
            document.getElementById('client-id').value = '';
            document.getElementById('client-form-title').textContent = 'Add New Client';
        }

        function editClient(clientId) {
            const client = clientsCache.find(c => c.id === clientId);
            if (client) {
                document.getElementById('client-id').value = client.id;
                document.getElementById('client-name').value = client.name;
                document.getElementById('client-address').value = client.address || '';
                document.getElementById('client-contact-person').value = client.contactPerson || '';
                document.getElementById('client-phone').value = client.phone || '';
                document.getElementById('client-type').value = client.type || 'Shipper';
                document.getElementById('client-form-title').textContent = 'Edit Client';
            }
        };

        async function deleteClient(clientId) {
            showLoader();
            try {
                await deleteDoc(doc(db, 'clients', clientId));
                showNotification("Client deleted successfully.");
            } catch (error) {
                console.error("Error deleting client:", error);
                showNotification("Could not delete client.", true);
            } finally {
                hideLoader();
            }
        }

        function setupAutocomplete(inputId, suggestionsId, type) {
            const input = document.getElementById(inputId);
            const suggestionsPanel = document.getElementById(suggestionsId);
            let activeSuggestionIndex = -1;

            const updateSelection = (suggestions) => {
                suggestions.forEach((suggestion, index) => {
                    if (index === activeSuggestionIndex) {
                        suggestion.classList.add('selected');
                        suggestion.scrollIntoView({ block: 'nearest' });
                    } else {
                        suggestion.classList.remove('selected');
                    }
                });
            };

            input.addEventListener('input', () => {
                const value = input.value.toLowerCase();
                if (value.length < 2) {
                    suggestionsPanel.innerHTML = '';
                    suggestionsPanel.classList.add('hidden');
                    return;
                }

                const filteredClients = clientsCache.filter(client => 
                    client.name.toLowerCase().includes(value) && 
                    (client.type === type || client.type === 'Both')
                );

                if (filteredClients.length > 0) {
                    suggestionsPanel.innerHTML = filteredClients.map(client => 
                        `<div class="autocomplete-suggestion" data-name="${client.name}">${client.name}</div>`
                    ).join('');
                    suggestionsPanel.classList.remove('hidden');
                    activeSuggestionIndex = -1;
                } else {
                    suggestionsPanel.innerHTML = '';
                    suggestionsPanel.classList.add('hidden');
                }
            });

            input.addEventListener('keydown', (e) => {
                const suggestions = suggestionsPanel.querySelectorAll('.autocomplete-suggestion');
                if (suggestionsPanel.classList.contains('hidden') || suggestions.length === 0) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    activeSuggestionIndex++;
                    if (activeSuggestionIndex >= suggestions.length) activeSuggestionIndex = 0;
                    updateSelection(suggestions);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    activeSuggestionIndex--;
                    if (activeSuggestionIndex < 0) activeSuggestionIndex = suggestions.length - 1;
                    updateSelection(suggestions);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (activeSuggestionIndex > -1) {
                        suggestions[activeSuggestionIndex].click();
                    }
                } else if (e.key === 'Escape') {
                    suggestionsPanel.classList.add('hidden');
                }
            });

            suggestionsPanel.addEventListener('click', (e) => {
                if (e.target.classList.contains('autocomplete-suggestion')) {
                    input.value = e.target.dataset.name;
                    suggestionsPanel.innerHTML = '';
                    suggestionsPanel.classList.add('hidden');
                    activeSuggestionIndex = -1;
                }
            });

            document.addEventListener('click', (e) => {
                if (e.target.id !== inputId) {
                    suggestionsPanel.classList.add('hidden');
                }
            });
        }


        function refreshOpenModals() {
            if (document.getElementById('user-jobs-modal').classList.contains('visible')) {
                const title = document.getElementById('user-jobs-modal-title').textContent;
                if(title.includes('Created by')) {
                    const userName = title.replace('Job Files Created by ', '');
                    showUserJobs(userName);
                } else if (title.includes('Salesman')) {
                     const salesmanName = title.replace('Job Files for Salesman: ', '');
                     showSalesmanJobs(salesmanName);
                } else if (title.includes('for')) {
                    const month = title.replace('Job Files for ', '');
                    // We need to know the date type to refresh properly
                    const dateType = document.getElementById('analytics-date-type')?.value || 'bd';
                    showMonthlyJobs(month, dateType);
                } else if (title.includes(' - ')) {
                    const status = title.split(' - ')[1].toLowerCase();
                    showStatusJobs(status);
                }
            }
        }
        
        function showSalesmanJobs(salesmanName) {
            const salesmanJobs = currentFilteredJobs.filter(job => (job.sm || 'N/A') === salesmanName);
            displayJobsInModal(salesmanJobs, `Job Files for Salesman: ${salesmanName}`);
        }

        function showUserJobs(userName) {
            const userJobs = currentFilteredJobs.filter(job => job.createdBy === userName);
            displayJobsInModal(userJobs, `Job Files Created by ${userName}`);
        }
        
        function showMonthlyJobs(month, dateType) {
            const monthlyJobs = currentFilteredJobs.filter(job => {
                const dateField = dateType === 'billing' ? job.bd : job.d;
                return dateField && dateField.startsWith(month);
            });
            displayJobsInModal(monthlyJobs, `Job Files for ${month}`);
        }

        function showStatusJobs(status) {
            const statusJobs = jobFilesCache.filter(job => {
                if (status === 'pending') {
                    return job.status === 'pending' || !job.status;
                }
                return job.status === status;
            });
            displayJobsInModal(statusJobs, `Job Files - ${status.charAt(0).toUpperCase() + status.slice(1)}`);
        }

        function displayJobsInModal(jobs, title) {
            const modalTitle = document.getElementById('user-jobs-modal-title');
            const list = document.getElementById('user-jobs-list');

            modalTitle.textContent = title;

            if (jobs.length === 0) {
                list.innerHTML = `<p class="text-gray-500 text-center p-4">No job files found.</p>`;
            } else {
                 let filesHtml = '';
                 jobs.forEach((docData) => {
                     const deleteButton = currentUser.role === 'admin' ? `<button onclick="confirmDelete('${docData.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Delete</button>` : '';
                     
                     let checkOrUncheckButton = '';
                     if (currentUser.role === 'admin' || currentUser.role === 'checker') {
                         if (docData.status === 'checked' || docData.status === 'approved') {
                             checkOrUncheckButton = `<button onclick="uncheckJobFile('${docData.id}')" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded text-xs">Uncheck</button>`;
                         } else if (docData.status === 'pending' || !docData.status) {
                             checkOrUncheckButton = `<button onclick="checkJobFile('${docData.id}')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs">Check</button>`;
                         }
                     }

                     let approveButton = '';
                     let rejectButton = '';
                     if (currentUser.role === 'admin' && docData.status === 'checked') {
                         approveButton = `<button onclick="approveJobFile('${docData.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-2 rounded text-xs">Approve</button>`;
                         rejectButton = `<button onclick="promptForRejection('${docData.id}')" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Reject</button>`;
                     }
                     
                     filesHtml += `
                         <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2">
                             <div class="w-full sm:w-2/5">
                                 <p class="font-bold text-indigo-700">${docData.jfn || 'No ID'}</p>
                                 <p class="text-sm text-gray-600">Shipper: ${docData.sh || 'N/A'}</p>
                                 <p class="text-sm text-gray-600">Consignee: ${docData.co || 'N/A'}</p>
                             </div>
                             <div class="w-full sm:w-1/5 text-xs text-gray-500">
                                 <p>Cost: <span class="font-medium text-red-600">KD ${(docData.totalCost || 0).toFixed(3)}</span></p>
                                 <p>Profit: <span class="font-medium text-green-600">KD ${(docData.totalProfit || 0).toFixed(3)}</span></p>
                             </div>
                             <div class="space-x-2 flex-shrink-0">
                                 <button onclick="previewJobFileById('${docData.id}')" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1 px-2 rounded text-xs">Preview</button>
                                 <button onclick="loadJobFileById('${docData.id}')" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-2 rounded text-xs">Load</button>
                                 ${checkOrUncheckButton}
                                 ${approveButton}
                                 ${rejectButton}
                                 ${deleteButton}
                             </div>
                         </div>
                     `;
                 });
                 list.innerHTML = filesHtml;
            }
            openModal('user-jobs-modal', true);
        }

