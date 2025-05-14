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
const storage = firebase.storage();

let activityLog = [];

function logout() {
    auth.signOut().then(() => {
        addActivity('Logged out');
        window.location.href = 'index.html';
    }).catch(error => console.error('Error logging out:', error));
}

function showSection(section) {
    const sections = ['purchases', 'profile'];
    sections.forEach(s => {
        const element = document.getElementById(`${s}-section`);
        if (element) element.style.display = s === section ? 'block' : 'none';
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });
    if (section === 'profile') {
        loadProfile();
    } else if (section === 'purchases') {
        loadPurchases();
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) toggle.checked = document.body.classList.contains('dark-mode');
    addActivity('Toggled dark mode');
}

function normalizePhoneNumber(phone) {
    return phone.replace(/[^0-9]/g, '').slice(-10);
}

function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${isError ? 'error' : 'success'}`;
        notification.classList.add('active');
        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }
}

function loadPurchases() {
    const user = auth.currentUser;
    if (!user) return;

    const userId = user.uid;
    db.ref(`users/${userId}/profile`).once('value', snapshot => {
        const profile = snapshot.val() || {};
        let phoneNumber = profile.phoneNumber || user.email.split('@')[0];
        phoneNumber = normalizePhoneNumber(phoneNumber);

        db.ref(`phoneCustomers/${phoneNumber}`).on('value', snapshot => {
            const purchases = snapshot.val();
            displayPurchases(purchases);
            updateProfileStats(purchases);
            if (!purchases) {
                showNotification('No purchases found for this phone number.', true);
            }
        }, error => {
            console.error('Error loading purchases:', error);
            showNotification('Failed to load purchases.', true);
        });
    });
}

function openModal(purchase) {
    document.getElementById('modal-product-name').textContent = purchase.product;
    document.getElementById('modal-quantity').textContent = purchase.quantity;
    document.getElementById('modal-total-price').textContent = purchase.totalPrice.toFixed(2);
    document.getElementById('modal-purchase-date').textContent = purchase.purchaseDate;
    document.getElementById('modal-payment-status').textContent = purchase.paymentStatus;
    document.getElementById('product-modal').style.display = 'flex';
    addActivity(`Viewed details for purchase of ${purchase.product}`);
}

function closeModal() {
    document.getElementById('product-modal').style.display = 'none';
}

function displayPurchases(purchases) {
    const grid = document.getElementById('purchase-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!purchases) {
        grid.innerHTML = '<p class="no-purchases">No purchases available.</p>';
        return;
    }

    Object.entries(purchases).forEach(([id, purchase]) => {
        const card = document.createElement('div');
        card.className = 'purchase-card';
        card.innerHTML = `
            <div class="purchase-header">
                <h3>${purchase.product}</h3>
                <span class="status ${purchase.paymentStatus.toLowerCase()}">${purchase.paymentStatus}</span>
            </div>
            <div class="purchase-preview">
                <p><i class="fas fa-rupee-sign"></i> ₹${purchase.totalPrice.toFixed(2)}</p>
                <p><i class="fas fa-calendar"></i> ${purchase.purchaseDate}</p>
            </div>
        `;
        card.addEventListener('click', () => openModal(purchase));
        grid.appendChild(card);
    });
}

function updateProfileStats(purchases) {
    const totalPurchases = Object.keys(purchases || {}).length;
    const totalSpent = Object.values(purchases || {}).reduce((sum, p) => sum + p.totalPrice, 0);

    document.getElementById('total-purchases').textContent = totalPurchases;
    document.getElementById('total-spent').textContent = `₹${totalSpent.toFixed(2)}`;
}

function loadProfile() {
    const user = auth.currentUser;
    if (user) {
        const userId = user.uid;
        db.ref(`users/${userId}/profile`).once('value', snapshot => {
            const profile = snapshot.val() || {};
            document.getElementById('profile-name').textContent = profile.displayName || user.email.split('@')[0];
            document.getElementById('profile-email').textContent = user.email;
            document.getElementById('profile-display-name').value = profile.displayName || '';
            document.getElementById('profile-phone').value = profile.phoneNumber || '';
            document.getElementById('profile-picture').src = profile.photoURL || 'https://via.placeholder.com/100';
            displayActivity();
        });
    }
}

function updateProfile() {
    const user = auth.currentUser;
    const displayName = document.getElementById('profile-display-name')?.value;
    let phoneNumber = document.getElementById('profile-phone')?.value;

    if (user && displayName) {
        phoneNumber = normalizePhoneNumber(phoneNumber);
        if (!/^\d{10}$/.test(phoneNumber) && phoneNumber) {
            showNotification('Phone number must be 10 digits.', true);
            return;
        }

        const userId = user.uid;
        user.updateProfile({ displayName })
            .then(() => {
                db.ref(`users/${userId}/profile`).update({ displayName, phoneNumber })
                    .then(() => {
                        addActivity('Updated profile');
                        loadProfile();
                        loadPurchases();
                        showNotification('Profile updated successfully.');
                    })
                    .catch(error => {
                        console.error('Error updating profile:', error);
                        showNotification('Failed to update profile.', true);
                    });
            })
            .catch(error => {
                console.error('Error updating profile:', error);
                showNotification('Failed to update profile.', true);
            });
    } else {
        showNotification('Display name is required.', true);
    }
}

function handleProfilePictureUpload() {
    const user = auth.currentUser;
    const fileInput = document.getElementById('profile-picture-input');
    const file = fileInput.files[0];

    if (user && file) {
        const userId = user.uid;
        const storageRef = storage.ref(`profilePictures/${userId}`);
        storageRef.put(file)
            .then(snapshot => snapshot.ref.getDownloadURL())
            .then(url => {
                user.updateProfile({ photoURL: url })
                    .then(() => {
                        db.ref(`users/${userId}/profile`).update({ photoURL: url })
                            .then(() => {
                                addActivity('Updated profile picture');
                                loadProfile();
                                showNotification('Profile picture updated.');
                            });
                    });
            })
            .catch(error => {
                console.error('Error uploading profile picture:', error);
                showNotification('Failed to upload profile picture.', true);
            });
    }
}

function addActivity(action) {
    const timestamp = new Date().toLocaleString();
    activityLog.unshift(`${timestamp}: ${action}`);
    if (activityLog.length > 5) activityLog.pop();
    displayActivity();
}

function displayActivity() {
    const activityList = document.getElementById('activity-list');
    if (activityList) {
        activityList.innerHTML = activityLog.length ? activityLog.map(item => `<li>${item}</li>`).join('') : '<li>No recent activity</li>';
    }
}

document.getElementById('profile-picture-input')?.addEventListener('change', handleProfilePictureUpload);
document.addEventListener('click', (event) => {
    const modal = document.getElementById('product-modal');
    if (event.target === modal) {
        closeModal();
    }
});

auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'index.html';
    } else if (user.email === 'akhilgoel985@gmail.com') {
        window.location.href = 'admin.html';
    } else {
        addActivity('Logged in');
        loadPurchases();
        showSection('purchases');
    }
});