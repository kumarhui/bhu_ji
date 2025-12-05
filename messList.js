document.addEventListener('DOMContentLoaded', () => {
    const messList = document.getElementById('mess-list');
    const canteenList = document.getElementById('canteen-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const searchInput = document.getElementById('search-input');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // Restore the active tab from session storage when the page loads
    const savedTabId = sessionStorage.getItem('activeMessListTab');
    if (savedTabId) {
        // Deactivate the default active elements
        document.querySelector('.tab-link.active')?.classList.remove('active');
        document.querySelector('.tab-content.active')?.classList.remove('active');

        // Activate the saved tab and its corresponding content
        const savedTab = document.querySelector(`.tab-link[data-tab="${savedTabId}"]`);
        const savedContent = document.getElementById(savedTabId);
        
        if (savedTab) savedTab.classList.add('active');
        if (savedContent) savedContent.classList.add('active');
    }

    const db = firebase.database();
    const messRef = db.ref('messOwners'); // Corrected: Fetch messes from messOwners
    const canteenRef = db.ref('canteenOwners'); // This is already correct

    let allMesses = [];
    let allCanteens = [];

    // Hide lists initially
    messList.style.display = 'none';
    canteenList.style.display = 'none';

    const showLoading = (isLoading) => {
        loadingSpinner.style.display = isLoading ? 'flex' : 'none';
        messList.style.display = isLoading ? 'none' : 'block';
        canteenList.style.display = isLoading ? 'none' : 'block';
    };

    const createListItem = (item, uid) => {
        // Data is nested under a 'profile' object for messOwners
        const profile = item.profile || item; // Handle both structures for robustness
        const statusClass = profile.messStatus ? 'on' : 'off';
        const statusText = profile.messStatus ? 'Open' : 'Closed';
        const phone = profile.phone || '';
        const userType = profile.userType || 'mess'; // Default to 'mess' if not present

        const li = document.createElement('li');
        li.className = 'list-item-card';
        li.style.cursor = 'pointer'; // Make it look clickable
        li.style.marginBottom = '12px'; // Add gap between cards
        li.onclick = () => {
            // Save the current active tab to session storage before navigating
            const activeTab = document.querySelector('.tab-link.active');
            if (activeTab) {
                sessionStorage.setItem('activeMessListTab', activeTab.dataset.tab);
            }
            // Navigate to the detail page
            window.location.href = `messDetail.html?uid=${uid}&type=${userType}`;
        };

        li.innerHTML = `
            <div class="card-content">
                <div class="card-header">${profile.messName || 'N/A'}</div>
                <div class="status-indicator">
                    <span class="status-dot ${statusClass}"></span>
                    <span class="status-text ${statusClass}">${statusText}</span>
                </div>
            </div>
            ${phone ? `
            <div class="card-action">
                <a href="tel:${phone}" 
                   class="call-button" 
                   onclick="event.stopPropagation()" 
                   style="background-color: #2ecc71; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);"
                   aria-label="Call"
                   title="Call ${profile.messName}"
                >
                    <i class="fas fa-phone-alt"></i>
                </a>
            </div>` : ''}
        `;
        return li;
    };

    const renderList = (list, element, emptyMessage) => {
        element.innerHTML = '';
        if (list.length === 0) {
            element.innerHTML = `<li class="list-item-card"><div class="card-header">${emptyMessage}</div></li>`;
            return;
        }
        list.forEach(item => {
            element.appendChild(createListItem(item.data, item.uid));
        });
    };

    const fetchData = () => {
        showLoading(true);

        const messPromise = messRef.once('value');
        const canteenPromise = canteenRef.once('value');

        Promise.all([messPromise, canteenPromise]).then(([messSnapshot, canteenSnapshot]) => {
            allMesses = [];
            if (messSnapshot.exists()) {
                messSnapshot.forEach(childSnapshot => {
                    const messData = childSnapshot.val();
                    // Don't show if isHidden is true in the profile
                    if (!messData.profile?.isHidden) {
                        allMesses.push({ uid: childSnapshot.key, data: messData });
                    }
                });
            }

            allCanteens = [];
            if (canteenSnapshot.exists()) {
                canteenSnapshot.forEach(childSnapshot => {
                    const canteenData = childSnapshot.val();
                    if (!canteenData.profile?.isHidden) {
                        allCanteens.push({ uid: childSnapshot.key, data: canteenData });
                    }
                });
            }

            renderList(allMesses, messList, 'No messes found.');
            renderList(allCanteens, canteenList, 'No canteens found.');

        }).catch(error => {
            console.error("Error fetching data: ", error);
            messList.innerHTML = `<li class="list-item-card"><div class="card-header">Error loading messes.</div></li>`;
            canteenList.innerHTML = `<li class="list-item-card"><div class="card-header">Error loading canteens.</div></li>`;
        }).finally(() => {
            showLoading(false);
        });
    };

    const filterData = () => {
        const query = searchInput.value.toLowerCase();

        const filteredMesses = allMesses.filter(item =>
            (item.data.profile?.messName || item.data.messName || '').toLowerCase().includes(query)
        );
        renderList(filteredMesses, messList, 'No messes match your search.');

        const filteredCanteens = allCanteens.filter(item =>
            (item.data.profile?.messName || item.data.messName || '').toLowerCase().includes(query)
        );
        renderList(filteredCanteens, canteenList, 'No canteens match your search.');
    };

    // Tab switching logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = document.getElementById(tab.dataset.tab);
            tabContents.forEach(tc => tc.classList.remove('active'));
            target.classList.add('active');
        });
    });

    searchInput.addEventListener('input', filterData);

    // Initial data fetch
    fetchData();
});