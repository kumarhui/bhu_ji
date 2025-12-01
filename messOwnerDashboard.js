document.addEventListener('DOMContentLoaded', function() {
        const dashboardContainer = document.querySelector('.dashboard-container');
        const dayTabsContainer = document.querySelector('.day-tabs');
        const dayContentContainer = document.getElementById('day-content-container');
        const editModeToggle = document.getElementById('edit-mode-toggle');
        const messStatusToggle = document.getElementById('mess-status-toggle');
        const saveButton = document.getElementById('save-button');
        const logoutButton = document.getElementById('logout-button'); // Get logout button
        const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        const todayIndex = new Date().getDay();
        let foodSuggestions = []; // This will be populated from Firebase
        
        const urlParams = new URLSearchParams(window.location.search);
        const ownerUid = urlParams.get('uid');
        const profilePath = ownerUid ? `messOwners/${ownerUid}/profile` : null;
        const weekdaysPath = ownerUid ? `messOwners/${ownerUid}/weekdays` : null;

        let saveTimeout;
        const debouncedSave = () => {
            if (!dashboardContainer.classList.contains('edit-active')) return;
            clearTimeout(saveTimeout);  
            saveTimeout = setTimeout(saveData, 1500);
        };

        function saveData() {
            saveButton.textContent = 'Saving...';
            saveButton.classList.add('saving');
            saveButton.disabled = true;

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
                    saveButton.textContent = 'Saved!';
                    saveButton.classList.remove('saving');
                    setTimeout(() => {
                        saveButton.textContent = 'Save';
                        saveButton.disabled = false;
                    }, 2000);
                })
                .catch((error) => {
                    console.error("Firebase save failed: ", error);
                    saveButton.textContent = 'Error!';
                    saveButton.classList.remove('saving');
                    saveButton.disabled = false;
                });
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
            // Load profile and weekdays data in parallel
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
                                    const capitalizedMealName = mealName.charAt(0).toUpperCase() + mealName.slice(1);
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
                    createMealTab(dayContent, 'Lunch', '55', true);
                    createMealTab(dayContent, 'Dinner', '55');
                }
            });
        }

        editModeToggle.addEventListener('change', function() {
            dashboardContainer.classList.toggle('edit-active', this.checked);
        });

        // Add event listener for the new edit button on the welcome card
        const editMessDetailsBtn = document.getElementById('edit-mess-details-btn');
        if (editMessDetailsBtn) {
            editMessDetailsBtn.addEventListener('click', () => {
                const welcomeCard = document.querySelector('.welcome-card');
                const isEditing = welcomeCard.classList.toggle('details-editing');

                // Toggle visibility of text vs. input fields
                document.querySelectorAll('.welcome-text').forEach(el => {
                    el.style.display = isEditing ? 'none' : '';
                });
                document.querySelectorAll('.welcome-input').forEach(el => {
                    el.style.display = isEditing ? '' : 'none';
                });

                // Change icon to save/check when editing
                const icon = editMessDetailsBtn.querySelector('i');
                icon.className = isEditing ? 'fas fa-check' : 'fas fa-pencil-alt';

                if (!isEditing) saveData(); // Save when clicking the checkmark
            });
        }

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

        saveButton.addEventListener('click', saveData);
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
                populateSuggestions(foodSuggestions); // Reset for next time
            }, 300);
            currentMenuList = null;
        }

        modalClose.addEventListener('click', hideAddItemModal);
        addItemModal.addEventListener('click', e => { if (e.target === addItemModal) hideAddItemModal(); });

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

        modalCustomItemInput.addEventListener('input', () => {
            const query = modalCustomItemInput.value.toLowerCase().trim();
            const filteredSuggestions = foodSuggestions.filter(item => 
                item.toLowerCase().includes(query)
            );
            populateSuggestions(filteredSuggestions);
        });

        modalAddSelectedButton.addEventListener('click', () => {
            const selectedItems = modalSuggestions.querySelectorAll('.suggestion-item.selected');
            if (selectedItems.length > 0 && currentMenuList) {
                selectedItems.forEach(itemEl => {
                    addMenuItem(currentMenuList, itemEl.dataset.name, ''); // Add without price
                });
                hideAddItemModal();
                debouncedSave();
            } else {
                alert('Please select at least one item to add.');
            }
        });

        modalAddCustomButton.addEventListener('click', () => {
            const itemName = modalCustomItemInput.value.trim();
            if (itemName && currentMenuList) {
                const itemPrice = modalCustomPriceInput.value.trim();
                addMenuItem(currentMenuList, itemName, itemPrice); // Add the single custom item
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
                if (window.confirm(`Are you sure you want to delete "${itemEl.dataset.name}"?`)) {
                    itemEl.remove();
                    debouncedSave();
                }
            } else if (e.target.closest('.edit-item')) {
                const itemEl = e.target.closest('.menu-item');
                const oldName = itemEl.dataset.name;
                const oldPrice = itemEl.dataset.price;

                const newName = prompt("Enter new item name:", oldName);
                if (newName && newName.trim() !== '') {
                    const newPrice = prompt("Enter new price (optional):", oldPrice);
                    itemEl.dataset.name = newName.trim();
                    itemEl.dataset.price = newPrice ? newPrice.trim() : '';
                    updateMenuItemDisplay(itemEl);
                    debouncedSave();
                }
            }
        });
        
        loadFoodSuggestions();
        loadData();
        switchDayTab(todayIndex);
    });