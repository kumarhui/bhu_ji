document.addEventListener('DOMContentLoaded', function () {
    const messNameHeader = document.getElementById('mess-name-header');
    const messNameElement = document.getElementById('mess-name');
    const messEmailElement = document.getElementById('mess-email');
    const dayTabsContainer = document.querySelector('.day-tabs');
    const dayContentContainer = document.getElementById('day-content-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const whatsappLink = document.getElementById('whatsapp-link');

    // Function to get mess ID from URL
    function getMessId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('uid'); // Corrected from 'id' to 'uid'
    }
    const messId = getMessId();

    if (!messId) {
        messNameElement.textContent = 'Mess not found.';
        loadingSpinner.style.display = 'none';
        return;
    }

    // Fetch mess details
    const messOwnerRef = database.ref('messOwners/' + messId);
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
                renderMeals(dayContent, dayData.meals, userType);
            } else {
                // If no meals, show empty state
                renderMeals(dayContent, null, userType);
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
    function renderMeals(container, mealsData, userType) {
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

                const mealCard = createMealCard(displayMealName, mealName, mealsData[mealName.toLowerCase()].items);
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
    function createMealCard(displayMealName, originalMealName, mealItems) {
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
            for (const key in mealItems) {
                const item = mealItems[key];
                const listItem = document.createElement('li');
                listItem.className = 'menu-item';

                const itemName = document.createElement('span');
                itemName.className = 'item-name';
                itemName.textContent = item.name;

                const itemPrice = document.createElement('span');
                itemPrice.className = 'item-price';
                itemPrice.textContent = item.price ? `₹${item.price}` : '';

                listItem.appendChild(itemName);
                listItem.appendChild(itemPrice);
                menuList.appendChild(listItem);
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