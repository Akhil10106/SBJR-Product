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

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => console.error('Error logging out:', error));
}

function showSection(section) {
    const sections = ['dashboard', 'add-purchase', 'customers'];
    sections.forEach(s => {
        const element = document.getElementById(`${s}-section`);
        if (element) element.style.display = s === section ? 'block' : 'none';
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });

    if (section === 'customers') {
        loadCustomers();
    } else if (section === 'dashboard') {
        updateDashboard();
    }
}

function calculateTotalPrice() {
    const quantity = parseFloat(document.getElementById('quantity')?.value) || 0;
    const pricePerUnit = parseFloat(document.getElementById('price-per-unit')?.value) || 0;
    const totalPrice = quantity * pricePerUnit;
    const totalPriceInput = document.getElementById('total-price');
    if (totalPriceInput) totalPriceInput.value = totalPrice.toFixed(2);
}

document.getElementById('quantity')?.addEventListener('input', calculateTotalPrice);
document.getElementById('price-per-unit')?.addEventListener('input', calculateTotalPrice);

function normalizePhoneNumber(phone) {
    // Remove spaces, dashes, country codes, and other non-digits
    return phone.replace(/[^0-9]/g, '').slice(-10); // Keep last 10 digits
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

function addCustomer(event) {
    event.preventDefault(); // Prevent form submission from reloading the page

    let phone = document.getElementById('phone-number')?.value || '';
    phone = normalizePhoneNumber(phone);

    const customer = {
        name: document.getElementById('customer-name')?.value || '',
        residence: document.getElementById('residence')?.value || '',
        phone: phone,
        product: document.getElementById('product-name')?.value || '',
        quantity: parseInt(document.getElementById('quantity')?.value) || 0,
        pricePerUnit: parseFloat(document.getElementById('price-per-unit')?.value) || 0,
        totalPrice: parseFloat(document.getElementById('total-price')?.value) || 0,
        paymentStatus: document.getElementById('payment-status')?.value || 'Pending',
        purchaseDate: new Date().toISOString().split('T')[0]
    };

    if (!customer.name || !customer.residence || !customer.phone || !customer.product || customer.quantity <= 0 || customer.pricePerUnit < 0) {
        showNotification('Please fill all required fields correctly.', true);
        return;
    }

    if (!/^\d{10}$/.test(customer.phone)) {
        showNotification('Phone number must be 10 digits.', true);
        return;
    }

    // Store under global customers and by phone number
    const customerId = db.ref('customers').push().key;
    const updates = {};
    updates[`customers/${customerId}`] = customer;
    updates[`phoneCustomers/${customer.phone}/${customerId}`] = customer;

    db.ref().update(updates)
        .then(() => {
            document.getElementById('customer-form').reset();
            document.getElementById('total-price').value = '';
            showNotification('Customer purchase added successfully.');
            showSection('dashboard');
        })
        .catch(error => {
            console.error('Error adding customer:', error);
            showNotification('Failed to add customer. Please try again.', true);
        });
}

function loadCustomers() {
    db.ref('customers').on('value', snapshot => {
        const customers = snapshot.val();
        displayCustomers(customers);
    });
}

function displayCustomers(customers) {
    const tableBody = document.getElementById('customer-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    Object.entries(customers || {}).forEach(([id, customer]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.residence}</td>
            <td>${customer.phone}</td>
            <td>${customer.product}</td>
            <td>${customer.quantity}</td>
            <td>₹${customer.totalPrice.toFixed(2)}</td>
            <td>${customer.paymentStatus}</td>
            <td>
                <button onclick="updatePaymentStatus('${id}', '${customer.paymentStatus}')">${customer.paymentStatus === 'Pending' ? 'Mark Paid' : 'Mark Pending'}</button>
                <button onclick="deleteCustomer('${id}', '${customer.phone}')">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updatePaymentStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Pending' ? 'Paid' : 'Pending';
    db.ref(`customers/${id}`).update({ paymentStatus: newStatus })
        .then(() => {
            db.ref(`phoneCustomers`).once('value', snapshot => {
                const phoneCustomers = snapshot.val();
                Object.entries(phoneCustomers || {}).forEach(([phone, customers]) => {
                    if (customers[id]) {
                        db.ref(`phoneCustomers/${phone}/${id}`).update({ paymentStatus: newStatus });
                    }
                });
            });
            showNotification(`Payment status updated to ${newStatus}.`);
        })
        .catch(error => {
            console.error('Error updating payment status:', error);
            showNotification('Failed to update payment status.', true);
        });
}

function deleteCustomer(id, phone) {
    const updates = {};
    updates[`customers/${id}`] = null;
    updates[`phoneCustomers/${phone}/${id}`] = null;

    db.ref().update(updates)
        .then(() => {
            showNotification('Customer deleted successfully.');
            showSection('customers');
        })
        .catch(error => {
            console.error('Error deleting customer:', error);
            showNotification('Failed to delete customer.', true);
        });
}

function updateDashboard() {
    db.ref('customers').once('value', snapshot => {
        const customers = snapshot.val() || {};
        const totalCustomers = Object.keys(customers).length;
        const totalPayments = Object.values(customers).reduce((sum, c) => sum + (c.paymentStatus === 'Paid' ? c.totalPrice : 0), 0);
        const pendingAmount = Object.values(customers).reduce((sum, c) => sum + (c.paymentStatus === 'Pending' ? c.totalPrice : 0), 0);
        const topCustomer = Object.values(customers).reduce((top, c) => c.totalPrice > (top.totalPrice || 0) ? c : top, {});

        document.getElementById('total-customers').textContent = totalCustomers;
        document.getElementById('total-payments').textContent = `₹${totalPayments.toFixed(2)}`;
        document.getElementById('pending-amount').textContent = `₹${pendingAmount.toFixed(2)}`;
        document.getElementById('top-customer').textContent = topCustomer.name || '-';
    });
}

auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'index.html';
    } else if (user.email !== 'akhilgoel985@gmail.com') {
        window.location.href = 'user.html';
    } else {
        showSection('dashboard');
        document.getElementById('customer-form')?.addEventListener('submit', addCustomer);
    }
});