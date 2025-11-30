document.addEventListener('DOMContentLoaded', function() {
    const usersList = document.getElementById('users-list');
    const loadingSpinner = document.getElementById('loading-spinner');
    const emptyState = document.getElementById('empty-state');
    const dbRef = firebase.database().ref('messOwners');
    const allMessesToggle = document.getElementById('all-messes-status-toggle');

    // Show spinner initially
    loadingSpinner.style.display = 'flex';
    usersList.style.display = 'none';
    emptyState.style.display = 'none';

    dbRef.on('value', (snapshot) => {
        usersList.innerHTML = ''; // Clear previous list
        loadingSpinner.style.display = 'none'; // Hide spinner

        if (snapshot.exists()) {
            const usersData = snapshot.val();
            usersList.style.display = 'block';
            emptyState.style.display = 'none';

            Object.keys(usersData).forEach(uid => {
                const user = usersData[uid];
                // Ensure the user has a profile object before proceeding
                if (user.profile) {
                    const profile = user.profile;
                    const listItem = document.createElement('li');
                    listItem.className = 'user-item';
                    listItem.dataset.uid = uid;

                    const statusClass = profile.messStatus ? 'open' : 'closed';

                    listItem.innerHTML = `
                        <div class="user-info">
                            <div class="user-name">
                                <span class="status-dot ${statusClass}" title="Mess is ${statusClass}"></span>
                                ${profile.messName || 'Unnamed Mess'}
                            </div>
                            <div class="user-details">
                                <span><i class="fas fa-envelope"></i> ${profile.email || 'No Email'}</span>
                                <span><i class="fas fa-phone"></i> ${profile.phone || 'No Phone'}</span>
                            </div>
                        </div>
                        <div class="user-actions">
                            <button class="action-btn delete-btn" title="Delete User" data-uid="${uid}"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    usersList.appendChild(listItem);

                    // Add click event to navigate to the dashboard
                    listItem.addEventListener('click', () => {
                        window.location.href = `messOwnerDashboard.html?uid=${uid}`;
                    });
                }
            });
        } else {
            // No users found
            usersList.style.display = 'none';
            emptyState.style.display = 'block';
        }
    }, (error) => {
        console.error("Firebase read failed: " + error.code);
        loadingSpinner.innerHTML = '<p>Error loading data. Please try again.</p>';
    });

    // Handle the master toggle for all messes
    if (allMessesToggle) {
        allMessesToggle.addEventListener('change', (event) => {
            const newStatus = event.target.checked;
            const confirmationMessage = `Are you sure you want to turn ${newStatus ? 'ON' : 'OFF'} all messes?`;

            if (window.confirm(confirmationMessage)) {
                dbRef.once('value').then(snapshot => {
                    if (snapshot.exists()) {
                        const updates = {};
                        snapshot.forEach(childSnapshot => {
                            const uid = childSnapshot.key;
                            // We create a multi-path update object
                            updates[`/${uid}/profile/messStatus`] = newStatus;
                        });
                        // Perform a single update for all users
                        return dbRef.update(updates);
                    }
                }).then(() => {
                    alert(`All messes have been turned ${newStatus ? 'ON' : 'OFF'}.`);
                }).catch(error => {
                    console.error("Failed to update all messes:", error);
                    alert("An error occurred. Could not update all messes.");
                });
            }
        });
    }
});