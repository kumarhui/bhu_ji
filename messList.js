document.addEventListener('DOMContentLoaded', () => {
    const messList = document.getElementById('mess-list');
    const canteenList = document.getElementById('canteen-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const searchInput = document.getElementById('search-input');

    const dbRef = firebase.database().ref('messOwners');
    let allUsersData = {}; // Store all users data to filter locally

    // Show spinner and hide lists initially
    loadingSpinner.style.display = 'flex';

    dbRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            allUsersData = snapshot.val();
            renderLists(allUsersData);
        }
        loadingSpinner.style.display = 'none';
    }, (error) => {
        messList.innerHTML = '';
        canteenList.innerHTML = '';
        console.error("Firebase read failed: ", error);
        loadingSpinner.innerHTML = '<p>Error loading data.</p>';
    });

    function renderLists(usersData) {
        messList.innerHTML = '';
        canteenList.innerHTML = '';
        let messCount = 0;
        let canteenCount = 0;

        if (usersData) {
            Object.keys(usersData).forEach(uid => {
                const user = usersData[uid];
                // Make the check more robust to handle potential key variations like 'profite'
                const profile = user.profile || user.profite;

                // If profile exists and isHidden is not explicitly true, show the card
                if (profile && profile.isHidden !== true) {
                    const cardHtml = createMessCard(uid, profile);
                    // Handle 'userType' and 'user Type', and default to 'mess' if not specified
                    const userType = (profile.userType || profile['user Type'] || 'mess').toLowerCase().trim();

                    if (userType === 'canteen') {
                        canteenList.innerHTML += cardHtml;
                        canteenCount++;
                    } else if (userType === 'mess') {
                        messList.innerHTML += cardHtml;
                        messCount++;
                    }
                }
            });
        }

        // Handle empty states after filtering
        if (messCount === 0) {
            messList.innerHTML = '<li class="list-item-card"><div class="card-header">No messes found.</div></li>';
        }
        if (canteenCount === 0) {
            canteenList.innerHTML = '<li class="list-item-card"><div class="card-header">No canteens found.</div></li>';
        }
    }

    function createMessCard(uid, profile) {
        // Make status and phone checks robust to handle key variations
        const isMessOpen = profile.messStatus === true;
        const statusClass = isMessOpen ? 'on' : 'off';
        const statusText = isMessOpen ? 'Open' : 'Closed';
        const phone = profile.phone || '';
        const phoneLink = phone ? `<a href="tel:${phone}" class="action-btn call-btn" title="Call"><i class="fas fa-phone-alt"></i></a>` : '';
        // The "View Menu" button should always be enabled.
        const viewMenuDisabled = '';

        return `
            <li class="list-item-card" data-uid="${uid}">
                <div class="card-info">
                    <div class="card-header">${profile.messName || 'Unnamed Mess'}</div>
                    <div class="status-indicator">
                        <span class="status-dot ${statusClass}"></span>
                        <span class="status-text ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="card-actions">
                    ${phoneLink}
                    <a href="messDetail.html?uid=${uid}" class="action-btn view-menu-btn ${viewMenuDisabled}">View Menu</a>
                </div>
            </li>
        `;
    }

    // Tab switching logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs and content
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate the clicked tab and its content
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Card click navigation logic
    function handleCardClick(event) {
        // Find the closest parent with the .list-item-card class
        const card = event.target.closest('.list-item-card');
        // If a card was clicked and it has a data-uid attribute, navigate
        if (card && card.dataset.uid) {
            // Show the spinner before navigating
            loadingSpinner.style.display = 'flex';

            window.location.href = `messDetail.html?uid=${card.dataset.uid}`;
        }
    }
    messList.addEventListener('click', handleCardClick);
    canteenList.addEventListener('click', handleCardClick);

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = {};

        Object.keys(allUsersData).forEach(uid => {
            const user = allUsersData[uid];
            const profile = user.profile || user.profite;
            if (profile && profile.messName && profile.messName.toLowerCase().includes(searchTerm)) {
                filteredUsers[uid] = user;
            }
        });

        renderLists(filteredUsers);
    });
});