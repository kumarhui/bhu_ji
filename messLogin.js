document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginButton = loginForm.querySelector('.login-btn');
    const togglePasswordIcon = document.querySelector('.toggle-password');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('remember');
    const forgotPasswordLink = document.querySelector('.forgot-password');
    const auth = firebase.auth();
    const database = firebase.database();

    // Load saved credentials on page load
    const savedEmail = localStorage.getItem('messOwnerEmail');
    const savedPassword = localStorage.getItem('messOwnerPassword');
    // Default to 'true' if not set, since checkbox is checked by default
    const rememberChecked = localStorage.getItem('messOwnerRemember') !== 'false';

    if (rememberChecked && savedEmail) {
        emailInput.value = savedEmail;
        passwordInput.value = savedPassword || '';
        rememberCheckbox.checked = true;
    } else {
        rememberCheckbox.checked = false;
    }

    // Check if user is already signed in
    auth.onAuthStateChanged(user => {
        // Only redirect if the user is signed in AND not currently on the login page.
        if (user && !window.location.pathname.endsWith('messLogin.html')) {
            console.log('User already signed in, redirecting to dashboard.');
            window.location.href = `messOwnerDashboard.html?uid=${user.uid}`;
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = emailInput.value;
            const password = passwordInput.value;
            const remember = rememberCheckbox.checked;

            // Show loading state on the button
            loginButton.disabled = true;
            loginButton.innerHTML = `
                <span>Logging in...</span>
                <i class="fas fa-spinner fa-spin"></i>
            `;

            if (remember) {
                localStorage.setItem('messOwnerEmail', email);
                localStorage.setItem('messOwnerPassword', password);
                localStorage.setItem('messOwnerRemember', 'true');
            } else {
                localStorage.removeItem('messOwnerEmail');
                localStorage.removeItem('messOwnerPassword');
                localStorage.setItem('messOwnerRemember', 'false');
            }

            // Sign in with Firebase
            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    // After successful login, check both potential locations for the user's data.
                    const messRef = database.ref('messOwners/' + user.uid);
                    const canteenRef = database.ref('canteenOwners/' + user.uid);

                    // Try to find the user in messOwners first
                    return messRef.once('value').then(messSnapshot => {
                        if (messSnapshot.exists()) {
                            return user; // Found in messOwners, proceed.
                        }
                        // Not in messOwners, check canteenOwners
                        return canteenRef.once('value').then(canteenSnapshot => {
                            if (canteenSnapshot.exists()) {
                                return user; // Found in canteenOwners, proceed.
                            }
                            // Data is missing from both! This is an edge case.
                            // For now, we'll log an error and let them in. The dashboard should handle missing data.
                            // A more robust solution might be to re-create the data here if needed.
                            console.error(`Data for user ${user.uid} not found in 'messOwners' or 'canteenOwners'.`);
                            // We'll still let them log in, assuming the dashboard has fallbacks.
                            return user;
                        });
                    });
                })
                .then((user) => {
                    console.log('Login and data check complete for user:', user.uid);
                    window.location.href = `messOwnerDashboard.html?uid=${user.uid}`; // Redirect to dashboard
                })
                .catch((error) => {
                    console.error('Firebase login error:', error);
                    if (error.code === 'auth/user-not-found') {
                        alert('No account found with this email. Please create an account first.');
                    } else {
                        alert(error.message);
                    }
                    // Revert button to original state on error
                    loginButton.disabled = false;
                    loginButton.innerHTML = `
                        <span>Login</span>
                        <i class="fas fa-arrow-right"></i>
                    `;
                });
        });
    }

    if (togglePasswordIcon) {
        togglePasswordIcon.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                togglePasswordIcon.classList.remove('fa-eye-slash');
                togglePasswordIcon.classList.add('fa-eye');
            } else {
                passwordInput.type = 'password';
                togglePasswordIcon.classList.remove('fa-eye');
                togglePasswordIcon.classList.add('fa-eye-slash');
            }
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Password reset feature coming soon. Contact admin for assistance.');
        });
    }
});
