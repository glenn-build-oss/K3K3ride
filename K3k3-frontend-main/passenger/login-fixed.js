// K3K3 Passenger Login & Sign Up - Professional JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Load safe storage utility
    const script = document.createElement('script');
    script.src = '../js/storage-utils.js';
    document.head.appendChild(script);
    
    // Initialize Google OAuth
    if (typeof initGoogleOAuth === 'function') {
        initGoogleOAuth();
    }
    
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            this.classList.add('active');
            document.getElementById(targetTab + '-tab').classList.add('active');
        });
    });
    
    // Password toggle functionality
    const passwordToggles = document.querySelectorAll('.password-toggle');
    
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            const eyeSlashIcon = this.querySelector('.eye-slash-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.style.display = 'none';
                eyeSlashIcon.style.display = 'block';
                this.style.background = '#f0f0f0';
                this.style.color = '#667eea';
            } else {
                passwordInput.type = 'password';
                eyeIcon.style.display = 'block';
                eyeSlashIcon.style.display = 'none';
                this.style.background = 'none';
                this.style.color = '#666';
            }
        });
        
        // Hide password on mouse release (click and hold functionality)
        toggle.addEventListener('mousedown', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            const eyeSlashIcon = this.querySelector('.eye-slash-icon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.style.display = 'none';
                eyeSlashIcon.style.display = 'block';
                this.style.background = '#f0f0f0';
                this.style.color = '#667eea';
            }
        });
        
        toggle.addEventListener('mouseup', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            const eyeSlashIcon = this.querySelector('.eye-slash-icon');
            
            passwordInput.type = 'password';
            eyeIcon.style.display = 'block';
            eyeSlashIcon.style.display = 'none';
            this.style.background = 'none';
            this.style.color = '#666';
        });
        
        toggle.addEventListener('mouseleave', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            const eyeIcon = this.querySelector('.eye-icon');
            const eyeSlashIcon = this.querySelector('.eye-slash-icon');
            
            passwordInput.type = 'password';
            eyeIcon.style.display = 'block';
            eyeSlashIcon.style.display = 'none';
            this.style.background = 'none';
            this.style.color = '#666';
        });
    });
    
    // Check URL hash for default tab
    function checkDefaultTab() {
        const hash = window.location.hash;
        if (hash === '#signup') {
            // Switch to signup tab
            document.querySelector('[data-tab="signup"]').click();
        }
    }
    
    checkDefaultTab();
    
    // Login form submission - SUSPENDED FOR TESTING
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Bypass authentication for testing
            const email = document.getElementById('login-email').value || 'test@test.com';
            const rememberMe = document.querySelector('input[name="remember"]').checked;
            
            // Show loading state
            const loginBtn = this.querySelector('.login-btn');
            const originalBtnText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            loginBtn.disabled = true;
            
            // Create mock user object
            const user = {
                id: 1,
                fname: 'Test',
                lname: 'User',
                email: email,
                role_type: 'passenger',
                phone: '+233123456789'
            };
            
            const storageType = rememberMe ? 'localStorage' : 'sessionStorage';
            const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
            try {
                storage.setItem('k3k3_user', JSON.stringify(user));
                storage.setItem('k3k3_user_name', user.fname || user.name || '');
                storage.setItem('k3k3_user_email', user.email || '');
                storage.setItem('k3k3_user_type', user.role_type || 'passenger');
                storage.setItem('k3k3_user_id', String(user.id || ''));
            } catch (e) {
                console.warn('Storage access blocked during login:', e.message);
            }
            
            // Show success toast with user's name
            const displayName = user.fname || user.name || 'User';
            showToast('success', `Welcome back to K3K3, ${displayName}!`, 'Login Successful');
            
            // Redirect to dashboard after delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
            // Restore button state
            loginBtn.innerHTML = originalBtnText;
            loginBtn.disabled = false;
        });
    }
    
    // Sign up form submission
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const firstName = document.getElementById('signup-firstname').value;
            const middleName = document.getElementById('signup-middlename').value;
            const lastName = document.getElementById('signup-lastname').value;
            const email = document.getElementById('signup-email').value;
            const phone = document.getElementById('signup-phone').value.trim();
            const countryCode = document.getElementById('signup-countryCode').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            const termsAccepted = document.querySelector('input[name="terms"]').checked;
            
            // Validation
            if (!phone || phone.trim() === '') {
                showToast('error', 'Phone number is required. Please enter your contact number.', 'Missing Information');
                return;
            }
            
            // Remove Ghana-specific validation - accept any international phone format
            const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
            if (!phoneRegex.test(phone.trim()) || phone.replace(/\D/g, '').length < 7) {
                showToast('error', 'Please enter a valid phone number with country code.', 'Invalid Phone Number');
                return;
            }
            
            if (password !== confirmPassword) {
                showToast('error', 'Passwords do not match. Please confirm your password.', 'Password Mismatch');
                return;
            }
            
            if (!termsAccepted) {
                showToast('error', 'You must accept the terms and conditions to continue.', 'Terms Required');
                return;
            }
            
            // Password strength validation
            if (!validatePassword(password)) {
                showToast('error', 'Password must be at least 8 characters with uppercase, lowercase, and numbers.', 'Weak Password');
                return;
            }
            
            // Show loading state
            const signupBtn = this.querySelector('.signup-btn');
            const originalBtnText = signupBtn.innerHTML;
            signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
            signupBtn.disabled = true;
            
            try {
                // Call register API
                const response = await fetch('http://localhost:8810/users/register/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        fname: firstName,
                        lname: lastName,
                        email: email, 
                        phone: phone,
                        password: password,
                        dob: '1990-01-01',
                        nationality: 'Ghanaian',
                        role_type: 'passenger',
                        is_active: true,
                        gender: 'other'
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // data IS the new user object (FastAPI returns it directly)
                    const user = data;
                    try {
                        sessionStorage.setItem('k3k3_user', JSON.stringify(user));
                        sessionStorage.setItem('k3k3_user_name', user.fname || user.name || '');
                        sessionStorage.setItem('k3k3_user_email', user.email || '');
                        sessionStorage.setItem('k3k3_user_type', user.role_type || 'passenger');
                        sessionStorage.setItem('k3k3_user_id', String(user.id || ''));
                    } catch (e) {
                        console.warn('Storage access blocked during signup:', e.message);
                    }
                    
                    // Show success toast with personalized message
                    const displayName = user.fname || user.name || firstName || 'User';
                    showToast('success', `Welcome to K3K3, ${displayName}! Your account has been created successfully.`, 'Account Created');
                    
                    // Redirect to dashboard after delay
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 2500);
                } else {
                    showToast('error', data.detail || 'Unable to create account. This email may already be registered.', 'Registration Failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                showToast('error', 'Unable to connect to server. Please check your internet connection and try again.', 'Connection Error');
            } finally {
                // Restore button state
                signupBtn.innerHTML = originalBtnText;
                signupBtn.disabled = false;
            }
        });
    }
    
    // Password validation function
    function validatePassword(password) {
        const minLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        
        return minLength && hasUpper && hasLower && hasNumber;
    }
    
    // Real-time password validation
    const signupPassword = document.getElementById('signup-password');
    const confirmPassword = document.getElementById('signup-confirm-password');
    
    if (signupPassword) {
        signupPassword.addEventListener('input', function() {
            const isValid = validatePassword(this.value);
            const requirements = document.querySelector('.password-requirements');
            
            if (this.value.length > 0) {
                if (isValid) {
                    requirements.style.borderColor = '#28a745';
                    requirements.style.backgroundColor = '#f8fff9';
                } else {
                    requirements.style.borderColor = '#dc3545';
                    requirements.style.backgroundColor = '#fff8f8';
                }
            } else {
                requirements.style.borderColor = '#667eea';
                requirements.style.backgroundColor = '#f8f9fa';
            }
        });
    }
    
    if (confirmPassword) {
        confirmPassword.addEventListener('input', function() {
            const signupPasswordValue = signupPassword.value;
            
            if (this.value.length > 0) {
                if (this.value === signupPasswordValue) {
                    this.style.borderColor = '#28a745';
                    this.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.1)';
                } else {
                    this.style.borderColor = '#dc3545';
                    this.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.1)';
                }
            } else {
                this.style.borderColor = '#e1e8ed';
                this.style.boxShadow = 'none';
            }
        });
    }
    
    // Social login handlers
    const socialBtns = document.querySelectorAll('.social-btn');
    socialBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const platform = this.classList.contains('google') ? 'Google' : 'Social';
            // Check if Google OAuth is available
            if (this.classList.contains('google') && typeof loginWithGooglePopup === 'function') {
                loginWithGooglePopup();
            } else {
                showToast('info', `${platform} login coming soon!`);
            }
        });
    });
    
    // Forgot password handler
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'forgot-password.html';
        });
    }
    
    // Terms and conditions handlers
    const termsLinks = document.querySelectorAll('.terms-link');
    termsLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                // Allow navigation to actual pages
                return true;
            } else {
                // Show toast for placeholder links
                e.preventDefault();
                showToast('info', 'Terms and conditions page coming soon!');
            }
        });
    });
});

// Professional Toast Notification System
function showNotification(type, message, title = '') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    // Auto-correct arguments if they are passed in wrong order
    const validTypes = ['success', 'error', 'info', 'warning'];
    if (type && !validTypes.includes(type) && validTypes.includes(message)) {
        // Swap them
        const temp = type;
        type = message;
        message = temp;
    }
    
    // If no type specified or invalid type, default to info
    if (!type || !validTypes.includes(type)) {
        message = type || message || 'Notification'; // The first argument was actually the message
        type = 'info';
    }
    
    let icon = '';
    let titleText = title;
    
    switch(type) {
        case 'error':
            icon = 'fas fa-exclamation-circle';
            titleText = title || 'Error';
            break;
        case 'info':
            icon = 'fas fa-info-circle';
            titleText = title || 'Information';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            titleText = title || 'Warning';
            break;
        case 'success':
            icon = 'fas fa-check-circle';
            titleText = title || 'Success';
            break;
    }
    
    notification.innerHTML = `
        <div class="toast-content" style="align-items: flex-start;">
            <i class="${icon}" style="margin-top: 2px;"></i>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="font-weight: 600; font-size: 15px; color: #111827;">${titleText}</span>
                <span style="font-weight: 400; font-size: 13px; color: #4B5563; line-height: 1.4;">${message}</span>
            </div>
        </div>
        <div class="toast-progress"></div>
    `;
    
    // Reset classes to ensure animation works
    notification.className = 'toast';
    
    // Force a reflow
    void notification.offsetWidth;
    
    // Add specific type and show class
    notification.classList.add(`toast-${type}`);
    notification.classList.add('toast-show');
    
    // Clear any existing timeout
    if (notification.hideTimeout) {
        clearTimeout(notification.hideTimeout);
    }
    
    // Auto-hide after 5 seconds
    notification.hideTimeout = setTimeout(() => {
        hideNotification();
    }, 5000);
}

function hideNotification() {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.classList.remove('toast-show');
    notification.classList.add('toast-hide');
    
    // Wait for animation to complete before clearing
    setTimeout(() => {
        notification.className = 'toast';
        notification.innerHTML = '';
    }, 300);
}

// Export showNotification function for global use
window.showNotification = showNotification;

// Backward compatibility - map showToast to showNotification
window.showToast = showNotification;
