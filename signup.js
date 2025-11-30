document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');
    const database = firebase.database();
    const auth = firebase.auth();

    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const userType = document.querySelector('input[name="userType"]:checked').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            // Create user with Firebase Authentication
            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Signed in 
                    const user = userCredential.user;
                    console.log('Signup successful for user:', user.uid);

                    // Now, save additional user data to the Realtime Database
                    const userRef = database.ref('messOwners/' + user.uid);
                    return userRef.set({
                        profile: {
                            email: email,
                            messName: "My Mess", // Store messName in profile
                            phone: phone,
                            userType: userType,
                            messStatus: true, // Store messStatus in profile
                            createdAt: firebase.database.ServerValue.TIMESTAMP
                        },
                        weekdays: {} // Create an empty weekdays object
                    });
                })
                .then(() => {
                    alert('Sign up successful! Please log in.');
                    window.location.href = 'messLogin.html'; // Redirect to the mess owner login page
                })
                .catch((error) => {
                    console.error('Firebase signup error:', error);
                    alert(error.message);
                });
        });
    }

    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const passwordInput = icon.previousElementSibling;
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    });
});
