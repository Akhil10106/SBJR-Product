let isLoginMode = true;

const firebaseConfig = {
    apiKey: "AIzaSyCkBwXC7aOBjqpuPVj-wRED8ui34DCXiyQ",
    authDomain: "shop-7cf72.firebaseapp.com",
    projectId: "shop-7cf72",
    storageBucket: "shop-7cf72.firebasestorage.app",
    messagingSenderId: "782394709152",
    appId: "1:782394709152:web:8bf1be14e5b7e62c8725c5",
    measurementId: "G-FMTNT4Z7YS"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

function switchAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? 'Login' : 'Register';
    document.getElementById('auth-switch').innerHTML = isLoginMode
        ? `Don't have an account? <a href="#" onclick="switchAuthMode()">Register</a>`
        : `Already have an account? <a href="#" onclick="switchAuthMode()">Login</a>`;
}

function handleAuth() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('auth-error');
    const authBtn = document.getElementById('auth-btn');

    if (!email || !password) {
        errorElement.textContent = 'Please enter both email/phone and password.';
        return;
    }

    authBtn.disabled = true;
    authBtn.textContent = isLoginMode ? 'Logging in...' : 'Registering...';

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, password)
            .then(userCredential => {
                errorElement.textContent = '';
                const user = userCredential.user;
                if (user.email === 'akhilgoel985@gmail.com' && password === '123456') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'user.html';
                }
            })
            .catch(error => {
                errorElement.textContent = getFriendlyErrorMessage(error);
                console.error('Login error:', error);
            })
            .finally(() => {
                authBtn.disabled = false;
                authBtn.textContent = 'Login';
            });
    } else {
        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const userId = userCredential.user.uid;
                const phoneNumber = email.includes('@example.com') ? email.split('@')[0] : '';
                db.ref(`users/${userId}/profile`).set({
                    email: email,
                    phoneNumber: phoneNumber
                });
                errorElement.textContent = '';
                window.location.href = 'user.html';
            })
            .catch(error => {
                errorElement.textContent = getFriendlyErrorMessage(error);
                console.error('Registration error:', error);
            })
            .finally(() => {
                authBtn.disabled = false;
                authBtn.textContent = 'Register';
            });
    }
}

function getFriendlyErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'The email address is not valid.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Invalid email or password.';
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        default:
            return 'An error occurred. Please try again.';
    }
}

auth.onAuthStateChanged(user => {
    if (user) {
        if (user.email === 'akhilgoel985@gmail.com') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'user.html';
        }
    }
});