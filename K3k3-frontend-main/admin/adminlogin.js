// K3K3 Admin Login - Professional UI Handler

// Toast Notification System
function hideNotification() {
    var notification = document.getElementById('notification');
    if (notification) {
        notification.classList.remove('toast-show');
        setTimeout(function() { notification.className = 'toast'; notification.innerHTML = ''; }, 300);
    }
}

function showNotification(type, message, title) {
    var notification = document.getElementById('notification');
    if (!notification) return;

    var validTypes = ['success', 'error', 'info', 'warning'];

    if (type && validTypes.indexOf(type) === -1 && validTypes.indexOf(message) !== -1) {
        var temp = type; type = message; message = temp;
    }
    if (!type || validTypes.indexOf(type) === -1) {
        message = type || message || 'Notification';
        type = 'info';
    }

    var icons = {
        error:   'fas fa-exclamation-circle',
        info:    'fas fa-info-circle',
        warning: 'fas fa-exclamation-triangle',
        success: 'fas fa-check-circle'
    };
    var titles = { error: 'Error', info: 'Information', warning: 'Warning', success: 'Success' };
    var icon = icons[type];
    var titleText = title || titles[type];

    notification.innerHTML =
        '<div class="toast-content" style="align-items: flex-start;">' +
            '<i class="' + icon + '" style="margin-top: 2px;"></i>' +
            '<div style="display: flex; flex-direction: column; gap: 4px;">' +
                '<span style="font-weight: 600; font-size: 15px; color: #111827;">' + titleText + '</span>' +
                '<span style="font-weight: 400; font-size: 13px; color: #4B5563; line-height: 1.4;">' + message + '</span>' +
            '</div>' +
        '</div>' +
        '<div class="toast-progress"></div>';

    notification.className = 'toast';
    void notification.offsetWidth;
    notification.classList.add('toast-' + type);
    notification.classList.add('toast-show');

    if (notification.hideTimeout) clearTimeout(notification.hideTimeout);
    notification.hideTimeout = setTimeout(hideNotification, 5000);
}

window.showToast = showNotification;

// Password Toggle
document.addEventListener('DOMContentLoaded', function() {
    var passwordToggle = document.querySelector('.password-toggle');
    var passwordInput  = document.getElementById('password');
    var passwordIcon   = document.getElementById('passwordIcon');

    if (passwordToggle && passwordInput && passwordIcon) {
        passwordToggle.addEventListener('click', function(e) {
            e.preventDefault();
            var isHidden = passwordInput.type === 'password';
            passwordInput.type = isHidden ? 'text' : 'password';
            passwordToggle.style.background = isHidden ? 'rgba(255,204,0,0.2)' : 'transparent';
            passwordIcon.classList.toggle('fa-eye', !isHidden);
            passwordIcon.classList.toggle('fa-eye-slash', isHidden);
        });
    }
});

// Admin Login Form
document.addEventListener('DOMContentLoaded', function() {
    var form = document.getElementById('adminLoginForm');
    if (!form) {
        console.error('adminLoginForm element not found');
        return;
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var email    = document.getElementById('username').value.trim();
        var password = document.getElementById('password').value.trim();
        var errorDiv = document.getElementById('errorMessage');
        var loginBtn = form.querySelector('button[type="submit"]');

        if (errorDiv) errorDiv.textContent = '';

        if (!email || !password) {
            showNotification('error', 'Please enter your email and password.', 'Missing Fields');
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Verifying...';
        }

        console.log('Admin login attempt for:', email);

        fetch('http://localhost:8810/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        })
        .then(function(response) {
            if (response.ok) {
                return response.json().then(function(user) {
                    console.log('Admin login successful, id=' + user.id);

                    localStorage.setItem('k3k3_admin_token', 'admin_session_' + Date.now());
                    localStorage.setItem('current_admin', JSON.stringify({
                        id:        user.id,
                        name:      user.name,
                        email:     user.email,
                        role:      user.role_type || 'admin',
                        loginTime: new Date().toISOString()
                    }));

                    showNotification('success', 'Welcome back, ' + (user.name || 'Admin') + '! Redirecting...', 'Login Successful');

                    setTimeout(function() {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                });
            } else {
                return response.json().then(function(errData) {
                    var msg = (errData && errData.detail) ? errData.detail : 'Invalid credentials. Please try again.';
                    showNotification('error', msg, 'Login Failed');
                    if (loginBtn) {
                        loginBtn.disabled = false;
                        loginBtn.textContent = 'Login to Admin Panel';
                    }
                }).catch(function() {
                    showNotification('error', 'Login failed. Please try again.', 'Login Failed');
                    if (loginBtn) {
                        loginBtn.disabled = false;
                        loginBtn.textContent = 'Login to Admin Panel';
                    }
                });
            }
        })
        .catch(function(err) {
            console.error('Admin login network error:', err);
            showNotification('error', 'Cannot reach the server. Make sure the backend is running on port 8810.', 'Connection Error');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login to Admin Panel';
            }
        });
    });
});