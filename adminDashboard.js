document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
        apiKey: "AIzaSyBZ-7pydjL8cZ919jZqLaVMa37FYapCaLY",
        authDomain: "bhu-mess.firebaseapp.com",
        databaseURL: "https://bhu-mess-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "bhu-mess",
        storageBucket: "bhu-mess.firebasestorage.app",
        messagingSenderId: "272028293626",
        appId: "1:272028293626:web:85b7604008b5463e38ec43",
        measurementId: "G-TTYFR01MK9"
    };
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const suggestionsRef = database.ref('food_suggestions');

    const suggestionsCard = document.getElementById('add-suggestions-card');
    const modal = document.getElementById('suggestions-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    const addSuggestionForm = document.getElementById('add-suggestion-form');
    const newSuggestionInput = document.getElementById('new-suggestion-input');

    suggestionsCard.addEventListener('click', () => {
        modal.style.display = 'flex';
        suggestionsRef.on('value', (snapshot) => {
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
        });
    });

    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    addSuggestionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newSuggestion = newSuggestionInput.value.trim();
        if (newSuggestion) {
            suggestionsRef.push(newSuggestion);
            newSuggestionInput.value = '';
        }
    });
});