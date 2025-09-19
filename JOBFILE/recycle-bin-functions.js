// Module for Recycle Bin Functions
        async function openRecycleBin() {
            showLoader();
            try {
                const deletedFilesRef = collection(db, 'deleted_jobfiles');
                const q = query(deletedFilesRef);
                const querySnapshot = await getDocs(q);
                const deletedFiles = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const list = document.getElementById('recycle-bin-list');
                if (deletedFiles.length === 0) {
                    list.innerHTML = `<p class="text-gray-500 text-center p-4">The recycle bin is empty.</p>`;
                } else {
                    let filesHtml = '';
                    deletedFiles.forEach((docData) => {
                        const deletedAt = docData.deletedAt?.toDate ? docData.deletedAt.toDate().toLocaleString() : 'N/A';
                        filesHtml += `
                            <div class="job-file-item border p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center bg-gray-50 hover:bg-gray-100 gap-2">
                                <div class="text-center sm:text-left">
                                    <p class="font-bold text-indigo-700">${docData.jfn || 'No ID'}</p>
                                    <p class="text-sm text-gray-600">Shipper: ${docData.sh || 'N/A'}</p>
                                    <p class="text-xs text-gray-400">Deleted by ${docData.deletedBy || 'Unknown'} on ${deletedAt}</p>
                                </div>
                                <div class="space-x-2 flex-shrink-0">
                                    <button onclick="restoreJobFile('${docData.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded text-sm">Restore</button>
                                    <button onclick="confirmPermanentDelete('${docData.id}')" class="bg-red-700 hover:bg-red-800 text-white font-bold py-1 px-3 rounded text-sm">Delete Permanently</button>
                                </div>
                            </div>
                        `;
                    });
                    list.innerHTML = filesHtml;
                }
                openModal('recycle-bin-modal', true);
            } catch (error) {
                console.error("Error opening recycle bin:", error);
                showNotification("Could not open recycle bin.", true);
            } finally {
                hideLoader();
            }
        }

        async function restoreJobFile(docId) {
            showLoader();
            try {
                const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
                const docSnap = await getDoc(deletedDocRef);

                if (docSnap.exists()) {
                    const dataToRestore = docSnap.data();
                    delete dataToRestore.deletedAt;
                    delete dataToRestore.deletedBy;

                    const newDocRef = doc(db, 'jobfiles', docId);
                    await setDoc(newDocRef, dataToRestore);
                    await deleteDoc(deletedDocRef);

                    showNotification("Job file restored successfully.");
                    openRecycleBin(); // Refresh the recycle bin view
                } else {
                    throw new Error("Document not found in recycle bin.");
                }
            } catch (error) {
                console.error("Error restoring file:", error);
                showNotification("Error restoring file.", true);
            } finally {
                hideLoader();
            }
        }

        function confirmPermanentDelete(docId) {
            const modal = document.getElementById('confirm-modal');
            modal.querySelector('#confirm-title').textContent = 'Confirm Permanent Deletion';
            modal.querySelector('#confirm-message').innerHTML = `Are you sure you want to permanently delete job file "${docId.replace(/_/g, '/')}"? <b class="text-red-600">This action cannot be undone.</b>`;
            modal.querySelector('#confirm-ok').className = 'bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded';
            openModal('confirm-modal', true);

            const okButton = modal.querySelector('#confirm-ok');
            const cancelButton = modal.querySelector('#confirm-cancel');

            const onOk = () => {
                permanentlyDeleteJobFile(docId);
                closeConfirm();
            };

            const closeConfirm = () => {
                closeModal('confirm-modal');
                okButton.removeEventListener('click', onOk);
            };

            okButton.addEventListener('click', onOk, { once: true });
            cancelButton.addEventListener('click', closeConfirm, { once: true });
        }

        async function permanentlyDeleteJobFile(docId) {
            showLoader();
            try {
                const deletedDocRef = doc(db, 'deleted_jobfiles', docId);
                await deleteDoc(deletedDocRef);
                showNotification("Job file permanently deleted.");
                openRecycleBin(); // Refresh the recycle bin view
            } catch (error) {
                console.error("Error permanently deleting file:", error);
                showNotification("Could not permanently delete file.", true);
            } finally {
                hideLoader();
            }
        }

        function openChargeManager() {
            displayChargeDescriptions();
            openModal('charge-manager-modal');
        }

        function displayChargeDescriptions() {
            const list = document.getElementById('charge-description-list');
            list.innerHTML = chargeDescriptions.map(desc => `
                <div class="flex justify-between items-center p-2 bg-gray-100 rounded">
                    <span>${desc}</span>
                    <button onclick="deleteChargeDescription('${desc}')" class="text-red-500 hover:text-red-700">&times;</button>
                </div>
            `).join('');
        }

        function saveChargeDescription() {
            const input = document.getElementById('new-charge-description');
            const newDesc = input.value.trim();
            if (newDesc && !chargeDescriptions.includes(newDesc)) {
                chargeDescriptions.push(newDesc);
                localStorage.setItem('chargeDescriptions', JSON.stringify(chargeDescriptions));
                displayChargeDescriptions();
                input.value = '';
            }
        }

        function deleteChargeDescription(description) {
            chargeDescriptions = chargeDescriptions.filter(d => d !== description);
            localStorage.setItem('chargeDescriptions', JSON.stringify(chargeDescriptions));
            displayChargeDescriptions();
        }
        
        function setupChargeAutocomplete(inputElement) {
            let suggestionsPanel = inputElement.parentElement.querySelector('.autocomplete-suggestions');
            if (!suggestionsPanel) {
                suggestionsPanel = document.createElement('div');
                suggestionsPanel.className = 'autocomplete-suggestions hidden';
                inputElement.parentElement.appendChild(suggestionsPanel);
            }
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

            const showSuggestions = () => {
                 const value = inputElement.value.toLowerCase();
                if (!value) {
                    suggestionsPanel.classList.add('hidden');
                    return;
                }
                const filtered = chargeDescriptions.filter(d => d.toLowerCase().includes(value));
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
                    inputElement.value = e.target.textContent;
                    suggestionsPanel.classList.add('hidden');
                    activeSuggestionIndex = -1;
                }
            });
            
            inputElement.addEventListener('blur', () => {
                setTimeout(() => suggestionsPanel.classList.add('hidden'), 150);
            });
        }


