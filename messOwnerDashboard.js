document.addEventListener('DOMContentLoaded', function() {
        const dashboardContainer = document.querySelector('.dashboard-container');
        const dayTabsContainer = document.querySelector('.day-tabs');
        const dayContentContainer = document.getElementById('day-content-container');
        const messStatusToggle = document.getElementById('mess-status-toggle');
        const menuToggleButton = document.getElementById('menu-toggle-button');
        const optionsDropdown = document.getElementById('options-dropdown');
        const logoutButton = document.getElementById('logout-button');
        const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        const todayIndex = new Date().getDay();
        let foodSuggestions = []; // This will be populated from Firebase
        let ownerType = 'mess'; // Default to 'mess'
        
        // Always be in edit mode
        dashboardContainer.classList.add('edit-active');

        const urlParams = new URLSearchParams(window.location.search);
        const ownerUid = urlParams.get('uid');
        
        // These paths will be determined after we know the owner type
        let profilePath = null;
        let weekdaysPath = null;

        // Helper to set paths based on owner type
        function setDbPaths(type) {
            ownerType = type; // Store the type globally
            const dbRoot = type === 'canteen' ? 'canteenOwners' : 'messOwners';
            if (ownerUid) {
                profilePath = `${dbRoot}/${ownerUid}/profile`;
                weekdaysPath = `${dbRoot}/${ownerUid}/weekdays`;
            }
        }

        let saveTimeout;
        const debouncedSave = () => {
            if (!dashboardContainer.classList.contains('edit-active')) return;
            clearTimeout(saveTimeout);  
            saveTimeout = setTimeout(saveData, 1500);
        };

        function saveData() {
            // Data to save to the profile node
            const profileData = {
                messStatus: messStatusToggle.checked,
                // Read from the new input fields if they exist
                messName: document.getElementById('welcome-title-mess-name-input').value,
                phone: document.getElementById('welcome-mess-phone-input').value
            };

            const weekdaysData = {};

            document.querySelectorAll('.day-content').forEach(dayContent => {
                const dayIndex = parseInt(dayContent.dataset.dayIndex);
                const dayName = days[dayIndex];
                const dayData = { meals: {} };
                dayContent.querySelectorAll('.meal-content').forEach(mealContent => {
                    const mealName = mealContent.dataset.name.toLowerCase();
                    const mealData = { price: mealContent.dataset.price, items: {} };
                    mealContent.querySelectorAll('.menu-item').forEach(menuItem => {
                        // Prefer an existing stable id, otherwise generate a new one
                        const itemId = menuItem.dataset.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        mealData.items[itemId] = {
                            name: menuItem.dataset.name,
                            price: menuItem.dataset.price
                        };
                    });
                    dayData.meals[mealName] = mealData;
                });
                weekdaysData[dayName] = dayData;
            });
            
            // Create an array of promises for all save operations
            const savePromises = [
                database.ref(profilePath).update(profileData),
                database.ref(weekdaysPath).set(weekdaysData)
            ];

            Promise.all(savePromises)
                .then(() => {
                    console.log('Data saved successfully.');
                })
                .catch((error) => {
                    console.error("Firebase save failed: ", error);
                    alert("Error saving data. Please check your connection and try again.");
                });
        }

        // Helper to get the correct display name for a meal based on owner type
        function getDisplayMealName(mealName) {
            const lowerCaseMealName = mealName.toLowerCase();
            if (ownerType === 'canteen') {
                if (lowerCaseMealName === 'lunch') return 'Morning';
                if (lowerCaseMealName === 'dinner') return 'Evening';
            }
            // Default for 'mess' or any other meal type
            return mealName.charAt(0).toUpperCase() + mealName.slice(1);
        }

        function loadFoodSuggestions() {
            const suggestionsRef = database.ref('food_suggestions');
            suggestionsRef.once('value').then(snapshot => {
                if (snapshot.exists()) {
                    // Convert the Firebase object of suggestions into a simple array of strings
                    foodSuggestions = Object.values(snapshot.val());
                    console.log('Food suggestions loaded from Firebase.');
                }
            }).catch(error => console.error("Failed to load food suggestions:", error));
        }

        function loadData() {
            if (!ownerUid) {
                alert('Error: No user ID found. Please log in again.');
                window.location.href = 'messLogin.html';
                return;
            }
            if (!ownerUid && !window.location.pathname.includes('messOwnerDashboard.html')) {
                // If on a different page or no UID, don't auto-load. This is a safeguard.
                return;
            }

            // First, determine the user type by checking both nodes
            const messOwnerRef = database.ref(`messOwners/${ownerUid}`);
            const canteenOwnerRef = database.ref(`canteenOwners/${ownerUid}`);

            messOwnerRef.once('value').then(snapshot => {
                if (snapshot.exists()) {
                    setDbPaths('mess');
                    loadDataForOwner();
                } else {
                    canteenOwnerRef.once('value').then(snapshot => {
                        if (snapshot.exists()) {
                            setDbPaths('canteen');
                            loadDataForOwner();
                        } else {
                            alert('Error: User data not found. Please log in again.');
                            window.location.href = 'messLogin.html';
                        }
                    });
                }
            });
        }

        function loadDataForOwner() {
            const profilePromise = database.ref(profilePath).once('value');
            const weekdaysPromise = database.ref(weekdaysPath).once('value');

            Promise.all([profilePromise, weekdaysPromise]).then((snapshots) => {
                const profileSnapshot = snapshots[0];
                const weekdaysSnapshot = snapshots[1];

                if (profileSnapshot.exists()) {
                    const profileData = profileSnapshot.val();
                    messStatusToggle.checked = profileData.messStatus !== false;

                    // Populate the welcome card
                    const messName = profileData.messName || 'Unnamed Mess';
                    const phone = profileData.phone || 'No phone provided';

                    document.getElementById('welcome-title-mess-name').textContent = messName;
                    document.getElementById('welcome-title-mess-name-input').value = messName;

                    document.getElementById('welcome-mess-email').innerHTML = `<i class="fas fa-envelope"></i> ${profileData.email || 'No email provided'}`;
                    document.getElementById('welcome-mess-phone').innerHTML = `<i class="fas fa-phone"></i> ${phone}`;
                    document.getElementById('welcome-mess-phone-input').value = phone === 'No phone provided' ? '' : phone;

                    // Run the auto-scheduler logic with the loaded settings
                    runAutoScheduler(profileData.settings);
                }

                if (weekdaysSnapshot.exists()) {
                    const weekdaysData = weekdaysSnapshot.val();
                    Object.keys(weekdaysData).forEach(dayName => {
                            const dayIndex = days.indexOf(dayName);
                            if (dayIndex === -1) return;
                            const dayContent = dayContentContainer.querySelector(`.day-content[data-day-index="${dayIndex}"]`);
                            if (dayContent) {
                                let isFirstMeal = true;
                                const meals = weekdaysData[dayName].meals || {};
                                
                                // Define a canonical order for meals to ensure consistency
                                const mealOrder = ['breakfast', 'lunch', 'dinner'];
                                const sortedMealNames = Object.keys(meals).sort((a, b) => {
                                    const indexA = mealOrder.indexOf(a.toLowerCase());
                                    const indexB = mealOrder.indexOf(b.toLowerCase());
                                    // If a meal isn't in our defined order, push it to the end
                                    if (indexA === -1) return 1;
                                    if (indexB === -1) return -1;
                                    return indexA - indexB;
                                });

                                sortedMealNames.forEach(mealName => {
                                    const meal = meals[mealName];
                                    const capitalizedMealName = getDisplayMealName(mealName);
                                    createMealTab(dayContent, capitalizedMealName, meal.price, isFirstMeal);
                                    isFirstMeal = false;
                                    const mealContent = dayContent.querySelector('.meal-content:last-of-type');
                                    if(mealContent) {
                                       const list = mealContent.querySelector('.menu-items-list');
                                       if (meal.items) {
                                           // meal.items is an object keyed by itemId in the DB
                                           Object.entries(meal.items).forEach(([itemId, item]) => {
                                               addMenuItem(list, item.name, item.price, itemId);
                                           });
                                       }
                                    }
                                });
                            }
                    });
                }
                initializeDefaultState();
            }).catch((error) => {
                console.error("Firebase load failed: ", error);
                alert("Could not connect to the database. Displaying default data.");
                initializeDefaultState();
            });
        }
        
        function initializeDefaultState() {
             days.forEach((day, index) => {
                const dayContent = dayContentContainer.querySelector(`.day-content[data-day-index="${index}"]`);
                if(dayContent && !dayContent.querySelector('.meal-content')) {
                    createMealTab(dayContent, getDisplayMealName('Lunch'), '55', true);
                    createMealTab(dayContent, getDisplayMealName('Dinner'), '55');
                }
            });
        }

        function runAutoScheduler(settings) {
            if (!settings || !settings.autoSchedulerEnabled) {
                return; // Scheduler is not active for this user
            }

            const feedbackBar = document.getElementById('auto-scheduler-feedback');
            feedbackBar.textContent = 'Checking auto-scheduler timings...';
            feedbackBar.style.display = 'block';

            const timings = settings.timings?.[ownerType];
            if (!timings) {
                console.log('Auto-scheduler: No timings found for user type:', ownerType);
                return;
            }

            const now = new Date();
            const currentTime = now.getHours() + now.getMinutes() / 60;

            const timeToDecimal = (timeStr) => {
                if (!timeStr) return null;
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours + (minutes / 60);
            };

            const start1 = timeToDecimal(timings.start1);
            const end1 = timeToDecimal(timings.end1);
            const start2 = timeToDecimal(timings.start2);
            const end2 = timeToDecimal(timings.end2);

            let shouldBeOpen = false;
            if (start1 !== null && end1 !== null && currentTime >= start1 && currentTime < end1) {
                shouldBeOpen = true;
            }
            if (start2 !== null && end2 !== null && currentTime >= start2 && currentTime < end2) {
                shouldBeOpen = true;
            }

            const isCurrentlyOpen = messStatusToggle.checked;

            if (shouldBeOpen !== isCurrentlyOpen) {
                // The status needs to be changed
                messStatusToggle.checked = shouldBeOpen;
                saveMessStatus(); // Save the new status to Firebase

                // Update feedback to show the change
                feedbackBar.textContent = `Auto-scheduler has set your status to "${shouldBeOpen ? 'Open' : 'Closed'}" based on your schedule.`;
            } else {
                // If no change was needed, update the message and hide it after a delay
                feedbackBar.textContent = 'Status is up to date with your schedule.';
                setTimeout(() => {
                    feedbackBar.style.display = 'none';
                }, 3000); // Hide after 3 seconds
            }
        }
        // Add event listener for the new edit button on the welcome card
        const editMessDetailsBtn = document.getElementById('edit-mess-details-btn'); // This is now a dropdown item
        if (editMessDetailsBtn) {
            editMessDetailsBtn.addEventListener('click', () => {
                const welcomeCard = document.querySelector('.welcome-card');
                const isEditing = welcomeCard.classList.toggle('details-editing');
                const icon = editMessDetailsBtn.querySelector('i');
                const text = editMessDetailsBtn.querySelector('span');

                // Toggle visibility of text vs. input fields
                document.querySelectorAll('.welcome-text').forEach(el => {
                    el.style.display = isEditing ? 'none' : '';
                });
                document.querySelectorAll('.welcome-input').forEach(el => {
                    el.style.display = isEditing ? '' : 'none';
                    if (isEditing) {
                        // Focus the first input when entering edit mode
                        document.getElementById('welcome-title-mess-name-input').focus();
                    }
                });

                // Change icon and text to save/check when editing
                icon.className = isEditing ? 'fas fa-save' : 'fas fa-pencil-alt';
                text.textContent = isEditing ? 'Save Details' : 'Edit Details';

                if (!isEditing) saveData(); // Save when clicking the checkmark
                optionsDropdown.classList.remove('active'); // Close dropdown after action
            });
        }

        // --- Live Menu Link ---
        const viewLiveMenuBtn = document.getElementById('view-live-menu-btn');
        if (viewLiveMenuBtn) {
            viewLiveMenuBtn.addEventListener('click', () => {
                if (ownerUid) {
                    window.location.href = `messDetail.html?uid=${ownerUid}&type=${ownerType}`;
                }
            });
        }

        // --- Settings Page Link ---
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (ownerUid) {
                    window.location.href = `messownersettings.html?uid=${ownerUid}&type=${ownerType}`;
                }
            });
        }
        // --- Options Menu Logic ---
        if (menuToggleButton) {
            menuToggleButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the document click listener from firing immediately
                optionsDropdown.classList.toggle('active');
            });
        }
        // Close dropdown if clicking outside
        document.addEventListener('click', (e) => {
            if (optionsDropdown && !optionsDropdown.contains(e.target) && !menuToggleButton.contains(e.target)) {
                optionsDropdown.classList.remove('active');
            }
        });


        // Logout functionality
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                if (window.confirm("Are you sure you want to log out?")) {
                    auth.signOut().then(() => {
                        // Clear remember me data from localStorage
                        localStorage.removeItem('messOwnerEmail');
                        localStorage.removeItem('messOwnerPassword');
                        localStorage.setItem('messOwnerRemember', 'false'); // Explicitly set to false
                        console.log('User signed out successfully.');
                        window.location.href = 'messLogin.html'; // Redirect to login page
                    }).catch((error) => {
                        console.error('Error signing out:', error);
                        alert('Failed to log out. Please try again.');
                    });
                }
            });
        }

        function saveMessStatus() {
            database.ref(`${profilePath}/messStatus`).set(messStatusToggle.checked).catch((error) => {
                console.error("Firebase save failed for messStatus: ", error);
                messStatusToggle.checked = !messStatusToggle.checked;
                alert("Failed to update mess status. Please try again.");
            });
        }

        messStatusToggle.addEventListener('change', saveMessStatus);

        days.forEach((day, index) => {
            const dayTab = document.createElement('div');
            dayTab.className = 'day-tab';
            if(index === todayIndex) dayTab.classList.add('today');
            dayTab.dataset.dayIndex = index;
            dayTab.textContent = day;
            dayTabsContainer.appendChild(dayTab);

            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';
            dayContent.dataset.dayIndex = index;
            dayContent.innerHTML = `<div class="meal-content-container"></div>`;
            dayContentContainer.appendChild(dayContent);
        });

        function createMealTab(dayContent, mealName, mealPrice, isActive = false) {
            const mealContentContainer = dayContent.querySelector('.meal-content-container');
            const mealId = 'meal-' + dayContent.dataset.dayIndex + '-' + Date.now();

            const mealContent = document.createElement('div');
            mealContent.className = 'meal-content';
            mealContent.id = mealId;
            const priceDisplay = mealPrice ? ` (₹${mealPrice})` : '';
            mealContent.innerHTML = `
                <h4>${mealName} Menu${priceDisplay}</h4>
                <div class="menu-items-list"></div>
                <div class="add-item-btn-container edit-mode-item">
                    <button class="add-item-btn-large">+ Add Item</button>
                </div>`;
            mealContent.dataset.mealId = mealId;
            mealContent.dataset.name = mealName;
            mealContent.dataset.price = mealPrice || '';
            mealContentContainer.appendChild(mealContent);
        }

        function updateMenuItemDisplay(itemEl) {
            const itemName = itemEl.dataset.name;
            const itemPrice = itemEl.dataset.price;
            const initial = itemName ? itemName.charAt(0).toUpperCase() : '?';
            const priceHTML = itemPrice ? `<span class="menu-item-price">(₹${itemPrice})</span>` : '';
            itemEl.innerHTML = `
                <div class="menu-item-text">
                    <span class="menu-item-name">${itemName}</span>${priceHTML}
                </div>
                <div class="menu-item-actions edit-mode-item">
                    <button class="edit-item" data-tooltip="Edit Item"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-item" data-tooltip="Delete Item"><i class="fas fa-trash-alt"></i></button>
                </div>`;
        }
        
        function addMenuItem(list, itemName, itemPrice, itemId) {
            const itemEl = document.createElement('div');
            itemEl.className = 'menu-item';
            // assign or preserve stable id so save/load keeps items mapped correctly
            itemEl.dataset.id = itemId || `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            itemEl.dataset.name = itemName;
            itemEl.dataset.price = itemPrice || '';
            updateMenuItemDisplay(itemEl);
            list.appendChild(itemEl); // Simply append to the list
        }

        function switchDayTab(dayIndex) {
            document.querySelectorAll('.day-tab').forEach(tab => tab.classList.toggle('active', parseInt(tab.dataset.dayIndex) === dayIndex));
            document.querySelectorAll('.day-content').forEach(content => content.classList.toggle('active', parseInt(content.dataset.dayIndex) === dayIndex));
        }
        
        function switchMealTab(dayContent, mealId) {
            // Remove all active classes from meal tabs and contents first
            dayContent.querySelectorAll('.meal-tab').forEach(tab => tab.classList.remove('active'));
            dayContent.querySelectorAll('.meal-content').forEach(content => content.classList.remove('active'));
            
            // show a quick loading indicator to signal refresh
            const spinner = document.createElement('div');
            spinner.className = 'quick-spinner';
            spinner.innerHTML = '<div class="spinner-small"></div>';
            const existing = dayContent.querySelector('.quick-spinner');
            if (existing) existing.remove();
            dayContent.appendChild(spinner);

            setTimeout(() => {
                // Now add active class only to the selected meal
                const activeTab = dayContent.querySelector(`.meal-tab[data-meal-id="${mealId}"]`);
                const activeContent = dayContent.querySelector(`#${mealId}`);
                if (activeTab) activeTab.classList.add('active');
                if (activeContent) activeContent.classList.add('active');
                
                const sp = dayContent.querySelector('.quick-spinner');
                if (sp) sp.remove();
            }, 220);
        }

        const addItemModal = document.getElementById('add-item-modal');
        const modalSuggestions = document.getElementById('modal-suggestions');
        const modalAddSelectedButton = document.getElementById('modal-add-selected-button');
        const modalAddCustomButton = document.getElementById('modal-add-custom-button');
        const modalCustomItemInput = document.getElementById('modal-custom-item-input');
        const modalCustomPriceInput = document.getElementById('modal-custom-price-input');
        const suggestionSearchInput = document.getElementById('suggestion-search-input');
        const addToAllDaysToggle = document.getElementById('add-to-all-days-toggle');
        const modalTabs = document.querySelector('.modal-tabs');
        const modalTabButtons = document.querySelectorAll('.modal-tab-btn');
        const modalTabContents = document.querySelectorAll('.modal-tab-content');

        // --- Edit Item Modal Elements ---
        const editItemModal = document.getElementById('edit-item-modal');
        const editModalClose = editItemModal.querySelector('.modal-close');
        const editModalNameInput = document.getElementById('modal-edit-item-name');
        const editModalPriceInput = document.getElementById('modal-edit-item-price');
        const editModalSaveButton = document.getElementById('modal-save-changes-button');
        const editForAllDaysToggle = document.getElementById('edit-for-all-days-toggle');
        let currentItemToEdit = null;

        // --- Delete Item Modal Elements ---
        const deleteItemModal = document.getElementById('delete-item-modal');
        const deleteModalClose = deleteItemModal.querySelector('.modal-close');
        const deleteConfirmationText = document.getElementById('delete-item-confirmation-text');
        const deleteForAllDaysToggle = document.getElementById('delete-for-all-days-toggle');
        const cancelDeleteButton = document.getElementById('modal-cancel-delete-button');
        const confirmDeleteButton = document.getElementById('modal-confirm-delete-button');


        const modalClose = document.querySelector('.modal-close');
        let currentMenuList = null;

        function showAddItemModal(list) {
            currentMenuList = list;
            addItemModal.classList.add('active');
            populateSuggestions(foodSuggestions); // Show all suggestions initially
        }

        function hideAddItemModal() {
            addItemModal.classList.remove('active');
            setTimeout(() => {
                modalCustomItemInput.value = '';
                modalCustomPriceInput.value = '';
                modalSuggestions.innerHTML = '';
                suggestionSearchInput.value = '';
                addToAllDaysToggle.checked = false; // Reset toggle on close
                // Reset tabs to default
                modalTabButtons.forEach(btn => btn.classList.remove('active'));
                modalTabContents.forEach(content => content.classList.remove('active'));
                document.querySelector('.modal-tab-btn[data-tab="suggestions"]').classList.add('active');
                document.getElementById('tab-suggestions').classList.add('active');
                populateSuggestions(foodSuggestions); // Reset for next time
            }, 300);
            currentMenuList = null;
        }

        modalClose.addEventListener('click', hideAddItemModal);
        addItemModal.addEventListener('click', e => { if (e.target === addItemModal) hideAddItemModal(); });

        // --- Edit Item Modal Logic ---
        function showEditItemModal(itemEl) {
            currentItemToEdit = itemEl;
            editModalNameInput.value = itemEl.dataset.name;
            editModalPriceInput.value = itemEl.dataset.price;
            editForAllDaysToggle.checked = false; // Reset toggle
            editItemModal.classList.add('active');
            editModalNameInput.focus();
        }

        function hideEditItemModal() {
            editItemModal.classList.remove('active');
            currentItemToEdit = null;
        }

        editModalClose.addEventListener('click', hideEditItemModal);
        editItemModal.addEventListener('click', e => { if (e.target === editItemModal) hideEditItemModal(); });

        editModalSaveButton.addEventListener('click', () => {
            if (!currentItemToEdit) return;

            const newName = editModalNameInput.value.trim();
            const newPrice = editModalPriceInput.value.trim();
            const editAll = editForAllDaysToggle.checked;

            const originalName = currentItemToEdit.dataset.name;
            const sourceMealContent = currentItemToEdit.closest('.meal-content');
            const mealName = sourceMealContent.dataset.name;

            if (editAll) {
                // Iterate through all instances of this meal type across all days
                document.querySelectorAll(`.meal-content[data-name="${mealName}"]`).forEach(mealContent => {
                    const list = mealContent.querySelector('.menu-items-list');
                    // Find an item with either the new name or the original name
                    let existingItem = Array.from(list.querySelectorAll('.menu-item')).find(
                        item => item.dataset.name === newName || item.dataset.name === originalName
                    );

                    if (existingItem) { // If it exists, update it
                        existingItem.dataset.name = newName;
                        existingItem.dataset.price = newPrice;
                        updateMenuItemDisplay(existingItem);
                    } else { // If it doesn't exist, add it
                        addMenuItem(list, newName, newPrice);
                    }
                });
            } else { // Original behavior: update only the single item that was clicked
                currentItemToEdit.dataset.name = newName;
                currentItemToEdit.dataset.price = newPrice;
                updateMenuItemDisplay(currentItemToEdit);
            }
                hideEditItemModal();
                debouncedSave();
        });

        // --- Delete Item Modal Logic ---
        let currentItemToDelete = null;

        function showDeleteItemModal(itemEl) {
            currentItemToDelete = itemEl;
            deleteConfirmationText.textContent = `Are you sure you want to delete "${itemEl.dataset.name}"?`;
            deleteForAllDaysToggle.checked = false; // Reset toggle
            deleteItemModal.classList.add('active');
        }

        function hideDeleteItemModal() {
            deleteItemModal.classList.remove('active');
            currentItemToDelete = null;
        }

        deleteModalClose.addEventListener('click', hideDeleteItemModal);
        cancelDeleteButton.addEventListener('click', hideDeleteItemModal);
        deleteItemModal.addEventListener('click', e => { if (e.target === deleteItemModal) hideDeleteItemModal(); });

        confirmDeleteButton.addEventListener('click', () => {
            if (!currentItemToDelete) return;

            const deleteAll = deleteForAllDaysToggle.checked;
            const itemName = currentItemToDelete.dataset.name;

            if (deleteAll) {
                const sourceMealContent = currentItemToDelete.closest('.meal-content');
                const mealName = sourceMealContent.dataset.name;

                // Find and delete all instances of this item in the same meal type
                document.querySelectorAll(`.meal-content[data-name="${mealName}"] .menu-item`).forEach(itemEl => {
                    if (itemEl.dataset.name === itemName) {
                        itemEl.remove();
                    }
                });
            } else {
                currentItemToDelete.remove(); // Original behavior: delete only the single item
            }
            hideDeleteItemModal();
            debouncedSave();
        });
        // --- Modal Tab Logic ---
        if (modalTabs) {
            modalTabs.addEventListener('click', e => {
                if (e.target.matches('.modal-tab-btn')) {
                    const tabId = e.target.dataset.tab;
                    modalTabButtons.forEach(btn => btn.classList.remove('active'));
                    modalTabContents.forEach(content => content.classList.remove('active'));

                    e.target.classList.add('active');
                    document.getElementById(`tab-${tabId}`).classList.add('active');
                }
            });
        }

        function populateSuggestions(suggestions) {
            modalSuggestions.innerHTML = '';
            suggestions.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = item;
                div.dataset.name = item;
                div.addEventListener('click', () => {
                    div.classList.toggle('selected');
                });
                modalSuggestions.appendChild(div);
            });
        }

        suggestionSearchInput.addEventListener('input', () => {
            const query = suggestionSearchInput.value.toLowerCase().trim();
            const filteredSuggestions = foodSuggestions.filter(item => 
                item.toLowerCase().includes(query)
            );
            populateSuggestions(filteredSuggestions);
        });

        modalAddSelectedButton.addEventListener('click', () => {
            const selectedItems = modalSuggestions.querySelectorAll('.suggestion-item.selected');
            if (selectedItems.length === 0) {
                alert('Please select at least one item to add.');
                return;
            }
            if (currentMenuList) {
                const addAll = addToAllDaysToggle.checked;
                const sourceMealContent = currentMenuList.closest('.meal-content');
                const mealName = sourceMealContent.dataset.name;

                if (addAll) {
                    // Find the same meal across all days
                    document.querySelectorAll(`.meal-content[data-name="${mealName}"]`).forEach(mealContent => {
                        const list = mealContent.querySelector('.menu-items-list');
                        selectedItems.forEach(itemEl => addMenuItem(list, itemEl.dataset.name, ''));
                    });
                } else {
                    // Add only to the current list
                    selectedItems.forEach(itemEl => {
                        addMenuItem(currentMenuList, itemEl.dataset.name, '');
                    });
                }
                 hideAddItemModal();
                 debouncedSave();
            } else {
                alert('Please select at least one item to add.');
            }
        });

        modalAddCustomButton.addEventListener('click', () => {
            const itemName = modalCustomItemInput.value.trim();
            const itemPrice = modalCustomPriceInput.value.trim();

            if (!itemName) {
                alert('Please enter a custom item name.');
                return;
            }

            if (currentMenuList) {
                const addAll = addToAllDaysToggle.checked;
                const sourceMealContent = currentMenuList.closest('.meal-content');
                const mealName = sourceMealContent.dataset.name;

                if (addAll) {
                    document.querySelectorAll(`.meal-content[data-name="${mealName}"]`).forEach(mealContent => {
                        const list = mealContent.querySelector('.menu-items-list');
                        addMenuItem(list, itemName, itemPrice);
                    });
                } else {
                    addMenuItem(currentMenuList, itemName, itemPrice);
                }
                 hideAddItemModal();
                 debouncedSave();
            }
        });

        dayTabsContainer.addEventListener('click', e => { if (e.target.classList.contains('day-tab')) switchDayTab(parseInt(e.target.dataset.dayIndex)); });
        
        dayContentContainer.addEventListener('click', e => {
            const dayContent = e.target.closest('.day-content');
            if (!dayContent) return;
            const isEditMode = dashboardContainer.classList.contains('edit-active');

            const addItemButton = e.target.closest('.add-item-btn-large');
            if (addItemButton) {
                const mealContent = addItemButton.closest('.meal-content');
                const list = mealContent.querySelector('.menu-items-list');
                showAddItemModal(list);
                return;
            }

            if (!isEditMode) return;

            if (e.target.closest('.delete-item')) {
                const itemEl = e.target.closest('.menu-item');
                showDeleteItemModal(itemEl);
            } else if (e.target.closest('.edit-item')) {
                showEditItemModal(e.target.closest('.menu-item'));
            }
        });
        
        loadFoodSuggestions();
        loadData();
        switchDayTab(todayIndex);
    });