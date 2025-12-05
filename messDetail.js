document.addEventListener('DOMContentLoaded', function () {
    const messNameHeader = document.getElementById('mess-name-header');
    const messNameElement = document.getElementById('mess-name');
    const messEmailElement = document.getElementById('mess-email');
    const dayTabsContainer = document.querySelector('.day-tabs');
    const dayContentContainer = document.getElementById('day-content-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const whatsappLink = document.getElementById('whatsapp-link');

    // Function to get mess ID from URL
    function getUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            uid: urlParams.get('uid'),
            type: urlParams.get('type') || 'mess' // Default to 'mess' if type is not specified
        };
    }
    const { uid: messId, type: ownerType } = getUrlParams();

    if (!messId) {
        messNameElement.textContent = 'Mess not found.';
        loadingSpinner.style.display = 'none';
        return;
    }
    
    // Determine the correct database path based on the owner type
    const dbPath = ownerType === 'canteen' ? 'canteenOwners/' : 'messOwners/';
    const messOwnerRef = database.ref(dbPath + messId);
    
    messOwnerRef.on('value', (snapshot) => {
        const ownerData = snapshot.val();
        if (ownerData && ownerData.profile) {
            const profileData = ownerData.profile;
            const messName = profileData.messName || 'Unnamed Mess';
            
            messNameHeader.textContent = messName;
            messNameElement.textContent = messName;
            messEmailElement.textContent = profileData.email || 'No email provided';

            // Set up contact links
            if (profileData.phone) {
                // WhatsApp link
                whatsappLink.href = `https://wa.me/91${profileData.phone}`;
                whatsappLink.style.display = 'inline-flex';
            } else {
                whatsappLink.style.display = 'none';
            }

            const userType = (profileData.userType || 'mess').toLowerCase();
            // Render day tabs and content
            // The menu data is inside the 'weekdays' node
            renderDays(ownerData.weekdays, userType);
        } else {
            messNameElement.textContent = 'Mess details not found.';
        }
        loadingSpinner.style.display = 'none';
    }, (error) => {
        console.error("Firebase read failed: " + error.code);
        messNameElement.textContent = 'Error loading mess details.';
        loadingSpinner.style.display = 'none';
    });

    // Function to render day tabs and content
    function renderDays(menuData, userType) {
        dayTabsContainer.innerHTML = '';
        dayContentContainer.innerHTML = '';

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date().getDay();

        days.forEach((day, index) => {
            const dayTab = document.createElement('button');
            dayTab.className = 'day-tab';
            dayTab.textContent = day.substring(0, 3);
            dayTab.dataset.day = day;

            if (index === today) {
                dayTab.classList.add('active');
            }

            dayTabsContainer.appendChild(dayTab);

            const dayContent = document.createElement('div');
            dayContent.className = 'day-content';
            dayContent.id = `content-${day}`;
            if (index === today) {
                dayContent.classList.add('active');
            }

            // Render meals for the day
            const dayData = menuData ? menuData[day.slice(0, 2)] : null; // Use 'Su', 'Mo', etc. for keys
            if (dayData && dayData.meals) {
                renderMeals(dayContent, dayData.meals, userType, day.slice(0, 2));
            } else {
                // If no meals, show empty state
                renderMeals(dayContent, null, userType, day.slice(0, 2));
            }
            dayContentContainer.appendChild(dayContent);
        });

        // Add event listeners to tabs
        const tabs = document.querySelectorAll('.day-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate current active elements
                document.querySelector('.day-tab.active').classList.remove('active');
                document.querySelector('.day-content.active').classList.remove('active');

                // Activate new tab and content
                tab.classList.add('active');
                document.getElementById(`content-${tab.dataset.day}`).classList.add('active');
            });
        });
    }

    // Function to render meals in a specific order
    function renderMeals(container, mealsData, userType, dayKey) {
        container.innerHTML = ''; // Clear previous content
        const mealOrder = ['Breakfast', 'Lunch', 'Dinner'];

        let hasMeals = false;
        const lunchAndDinnerCards = [];

        mealOrder.forEach(mealName => {
            if (mealsData && mealsData[mealName.toLowerCase()]) {
                let displayMealName = mealName;
                // If the user type is 'canteen', change the labels
                if (userType === 'canteen') {
                    if (mealName === 'Lunch') {
                        displayMealName = 'Morning';
                    } else if (mealName === 'Dinner') {
                        displayMealName = 'Evening';
                    }
                }

                const mealCard = createMealCard(displayMealName, mealName, mealsData[mealName.toLowerCase()].items, dayKey);
                if (mealName === 'Lunch' || mealName === 'Dinner') {
                    lunchAndDinnerCards.push(mealCard);
                } else {
                    container.appendChild(mealCard);
                }
                hasMeals = true;
            }
        });

        if (lunchAndDinnerCards.length > 0) {
            const mealContainer = document.createElement('div');
            mealContainer.className = 'meal-container';
            lunchAndDinnerCards.forEach(card => mealContainer.appendChild(card));
            container.appendChild(mealContainer);
        }

        if (!hasMeals) {
            container.innerHTML = '<div class="empty-state"><p>No menu available for this day.</p></div>';
        }
    }

    // Function to create a meal card
    function createMealCard(displayMealName, originalMealName, mealItems, dayKey) {
        const mealCard = document.createElement('div');
        mealCard.className = 'meal-card';

        const mealTitle = document.createElement('h3');
        mealTitle.className = 'meal-title';
        
        let iconClass = 'fa-utensils'; // Default icon
        if (originalMealName === 'Breakfast') iconClass = 'fa-coffee';
        if (originalMealName === 'Lunch') iconClass = 'fa-sun';
        if (originalMealName === 'Dinner') iconClass = 'fa-moon';

        mealTitle.innerHTML = `<i class="fas ${iconClass}"></i> ${displayMealName}`;
        mealCard.appendChild(mealTitle);

        const menuList = document.createElement('ul');
        menuList.className = 'menu-list';

        if (mealItems && Object.keys(mealItems).length > 0) {
            for (const itemId in mealItems) {
                const item = mealItems[itemId];
                const itemCard = document.createElement('li');
                itemCard.className = 'menu-item-card';


                // New path: Save votes directly on the item object.
                const votePath = `votes/${messId}/${dayKey}/${originalMealName.toLowerCase()}/${itemId}`;
                const voteRef = database.ref(votePath);

                itemCard.innerHTML = `
                    <div class="item-details">
                        <span class="item-name">${item.name}</span>
                        ${item.price ? `<span class="item-price">₹${item.price}</span>` : ''}
                    </div>
                    <div class="item-actions">
                        <button class="like-btn" data-item-id="${itemId}" aria-label="Like ${item.name}">
                            <i class="far fa-thumbs-up"></i>
                            <span class="vote-count">0</span>
                        </button>
                    </div>
                `;

                const likeBtn = itemCard.querySelector('.like-btn');
                const likeCountSpan = likeBtn.querySelector('.vote-count');


                // --- Voting Logic ---
                const localVoteKey = `vote_${messId}_${itemId}`;

                // NEW: Function to instantly update button colors and state
                const updateButtonState = (newVoteState) => {
                    if (newVoteState === 'like') {
                        likeBtn.classList.add('active');
                    } else { // null or undefined
                        likeBtn.classList.remove('active');
                    }
                };

                // Function to handle a vote transaction
                const handleVote = (voteType) => {
                    const currentVote = localStorage.getItem(localVoteKey);
                    const newVote = (currentVote === voteType) ? null : voteType;
                    
                    // Add a flag to prevent the listener from overwriting the optimistic update
                    itemCard.classList.add('is-voting');

                    // 1. Optimistic UI Update: Change color instantly
                    updateButtonState(newVote);

                    // Trigger animation on like
                    if (newVote === 'like') {
                        likeBtn.classList.add('liked-animation');
                        likeBtn.addEventListener('animationend', () => likeBtn.classList.remove('liked-animation'), { once: true });
                    }

                    // 2. Background Firebase Transaction
                    voteRef.transaction(currentData => {
                        if (currentData === null) {
                            currentData = { likes: 0, dislikes: 0 };
                        }

                        if (currentVote === voteType) { // User is un-voting
                            currentData[voteType + 's']--;
                        } else { // New vote or switching vote
                            currentData[voteType + 's']++;
                            if (currentVote) { // Switching vote
                                const otherVoteType = voteType === 'like' ? 'dislike' : 'like';
                                currentData[otherVoteType + 's']--;
                            }
                        }
                        return currentData;
                    }, (error, committed, snapshot) => {
                        if (error) {
                            console.error('Transaction failed abnormally!', error);
                        } else if (!committed) {
                            // This can happen if another client writes to the same location.
                            // The transaction will be re-run automatically, so no action is needed here.
                            console.log('Vote transaction not committed, will retry.');
                        } else {
                            // 3. Update local storage only after successful commit
                            if (newVote) localStorage.setItem(localVoteKey, newVote);
                            else localStorage.removeItem(localVoteKey);
                            // The on('value') listener will handle the UI update.

                            // Remove the flag now that the process is complete
                            itemCard.classList.remove('is-voting');
                        }
                    });
                };

                // Make the entire card double-clickable
                itemCard.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    handleVote('like'); // Trigger the like action
                });

                // Listen for real-time vote updates from Firebase
                voteRef.on('value', (snapshot) => {
                    const votes = snapshot.val();
                    const likes = votes?.likes || 0;

                    // Update counts
                    likeCountSpan.textContent = likes;

                    // Only update the button state from the listener if the user is not currently interacting with it.
                    // This prevents the listener from overwriting the optimistic UI update.
                    if (!itemCard.classList.contains('is-voting')) {
                        const localVote = localStorage.getItem(localVoteKey);
                        updateButtonState(localVote);
                    }
                });

                menuList.appendChild(itemCard);
            }
        } else {
            const noItem = document.createElement('li');
            noItem.className = 'menu-item-empty';
            noItem.textContent = 'No items for this meal.';
            menuList.appendChild(noItem);
        }

        mealCard.appendChild(menuList);
        return mealCard;
    }
});