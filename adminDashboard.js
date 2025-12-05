document.addEventListener('DOMContentLoaded', () => {
    const suggestionsModal = document.getElementById('suggestions-modal');
    const addSuggestionsCard = document.getElementById('add-suggestions-card');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    const addSuggestionForm = document.getElementById('add-suggestion-form');
    const newSuggestionInput = document.getElementById('new-suggestion-input');

    const db = firebase.database();
    const suggestionsRef = db.ref('food_suggestions');

    function loadSuggestions() {
        suggestionsRef.once('value').then(snapshot => {
            suggestionsList.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const suggestion = childSnapshot.val();
                    const li = document.createElement('li');
                    li.textContent = suggestion;
                    li.className = 'suggestion-item';
                    suggestionsList.appendChild(li);
                });
            } else {
                suggestionsList.innerHTML = '<li class="suggestion-item">No suggestions yet.</li>';
            }
        }).catch(error => {
            console.error("Error loading suggestions:", error);
            suggestionsList.innerHTML = '<li class="suggestion-item">Error loading suggestions.</li>';
        });
    }

    addSuggestionsCard.addEventListener('click', () => {
        suggestionsModal.style.display = 'flex';
        loadSuggestions();
    });

    closeModalBtn.addEventListener('click', () => suggestionsModal.style.display = 'none');
    suggestionsModal.addEventListener('click', (e) => { if (e.target === suggestionsModal) suggestionsModal.style.display = 'none'; });

    addSuggestionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newSuggestion = newSuggestionInput.value.trim();
        if (newSuggestion) {
            suggestionsRef.push(newSuggestion);
            newSuggestionInput.value = '';
        }
    });

    // --- Canteen Migration Logic ---
    const migrateCard = document.getElementById('migrate-canteens-card');
    if (migrateCard) {
        migrateCard.addEventListener('click', () => {
            if (!confirm('Are you sure you want to migrate canteen owners to a new "canteenOwners" node? This action cannot be undone.')) {
                return;
            }

            const sourceRef = db.ref('messOwners');
            const canteenOwnersRef = db.ref('canteenOwners');

            migrateCard.querySelector('.service-desc').textContent = 'Migrating...';
            migrateCard.style.cursor = 'not-allowed';
            migrateCard.style.opacity = '0.6';

            sourceRef.once('value', snapshot => {
                const data = snapshot.val();
                if (!data) {
                    alert('No users found to migrate.');
                    return;
                }

                const updates = {};
                let canteensFound = 0;

                for (const uid in data) {
                    const userProfile = data[uid].profile;
                    if (userProfile && userProfile.userType && userProfile.userType.toLowerCase() === 'canteen') {
                        updates[`/messOwners/${uid}`] = null;
                        updates[`/canteenOwners/${uid}`] = data[uid];
                        canteensFound++;
                    }
                }

                db.ref().update(updates)
                    .then(() => alert(`${canteensFound} canteen owner(s) migrated successfully!`))
                    .catch(error => alert(`Migration failed: ${error.message}`))
                    .finally(() => {
                        migrateCard.querySelector('.service-desc').textContent = 'Move canteen owners to a separate data node.';
                        migrateCard.style.cursor = 'pointer';
                        migrateCard.style.opacity = '1';
                    });
            });
        });
    }
});