// K3K3 Rider Login System - Real Backend API Integration
const API_BASE = 'http://localhost:8810';

class RiderLoginSystem {
    constructor() {
        this.init();
    }

    init() {
        this.setupPasswordToggle();
        this.setupLoginForm();
    }

    // ─── Password Toggle ─────────────────────────────────────────────────────
    setupPasswordToggle() {
        const passwordToggle = document.querySelector('.password-toggle');
        const passwordInput  = document.getElementById('password');
        const passwordIcon   = document.getElementById('passwordIcon');

        if (passwordToggle && passwordInput && passwordIcon) {
            passwordToggle.addEventListener('click', function (e) {
                e.preventDefault();
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    passwordToggle.style.background = 'rgba(255,204,0,0.2)';
                    passwordIcon.classList.replace('fa-eye', 'fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    passwordToggle.style.background = 'transparent';
                    passwordIcon.classList.replace('fa-eye-slash', 'fa-eye');
                }
            });
        }
    }

    // ─── Format DOB as DD-MM-YYYY (same format backend uses) ─────────────────
    formatDOBPassword(dateOfBirth) {
        if (!dateOfBirth) return '01-01-1990';
        try {
            let parsed;
            if (typeof dateOfBirth === 'string' && dateOfBirth.includes('-') && dateOfBirth.length === 10) {
                // Could be YYYY-MM-DD or DD-MM-YYYY
                if (dateOfBirth[4] === '-') {
                    // YYYY-MM-DD
                    parsed = new Date(dateOfBirth);
                } else {
                    // DD-MM-YYYY — parse manually
                    const [d, m, y] = dateOfBirth.split('-');
                    parsed = new Date(`${y}-${m}-${d}`);
                }
            } else {
                parsed = new Date(dateOfBirth);
            }
            const day   = String(parsed.getDate()).padStart(2, '0');
            const month = String(parsed.getMonth() + 1).padStart(2, '0');
            const year  = parsed.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (_) {
            return '01-01-1990';
        }
    }

    // ─── Validate password requirements for the change-password form ──────────
    validatePasswordRequirements(password) {
        const errors = [];
        if (password.length < 8)              errors.push('At least 8 characters long');
        if (!/\d/.test(password))             errors.push('Contains at least 1 number');
        if (!/[a-zA-Z]/.test(password))       errors.push('Contains at least 1 letter');
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Contains at least 1 special character');
        if (/^\d{2}-\d{2}-\d{4}$/.test(password)) errors.push('Cannot be your Date of Birth format (DD-MM-YYYY)');
        return { isValid: errors.length === 0, errors };
    }

    // ─── Show error message ───────────────────────────────────────────────────
    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    }

    clearError() {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.style.display = 'none';
        }
    }

    // ─── Login Form ───────────────────────────────────────────────────────────
    setupLoginForm() {
        const loginForm = document.getElementById('riderLoginForm');
        if (!loginForm) return;

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.clearError();

            const identifier = document.getElementById('username').value.trim();
            const password   = document.getElementById('password').value.trim();

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const origText  = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
                submitBtn.disabled  = true;
            }

            try {
                // ── Try real backend first ───────────────────────────────────
                const result = await this.authenticateWithBackend(identifier, password);

                if (result.success) {
                    // Store session
                    const session = {
                        riderId:      result.data.public_id,
                        dbRiderId:    result.data.rider_id,
                        userId:       result.data.user_id,
                        firstName:    result.data.fname,
                        lastName:     result.data.lname,
                        email:        result.data.email,
                        phone:        result.data.phone,
                        loginTime:    new Date().toISOString(),
                        isFirstLogin: result.data.is_first_login
                    };
                    localStorage.setItem('riderSession', JSON.stringify(session));

                    if (result.data.is_first_login) {
                        // Must change password on first login
                        this.showPasswordChangeModal(session, password);
                    } else {
                        this.redirectToDashboard(session);
                    }

                } else {
                    this.showError(result.message || 'Invalid credentials');
                }
            } catch (err) {
                console.error('Login error:', err);
                this.showError('Unable to connect to server. Please check your connection.');
            } finally {
                if (submitBtn) {
                    submitBtn.innerHTML = origText;
                    submitBtn.disabled  = false;
                }
            }
        });
    }

    // ─── Authenticate with real backend ──────────────────────────────────────
    async authenticateWithBackend(identifier, password) {
        try {
            const response = await fetch(`${API_BASE}/admin/riders/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ identifier, password })
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, data };
            } else if (response.status === 403) {
                return { success: false, message: data.detail || 'Your account is not active. Please contact admin.' };
            } else {
                return { success: false, message: data.detail || 'Invalid credentials' };
            }
        } catch (err) {
            console.error('Backend auth error:', err);
            throw err;
        }
    }

    // ─── Password Change Modal (first login) ──────────────────────────────────
    showPasswordChangeModal(session, currentPassword) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'password-change-overlay';
        modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white; border-radius: 16px; width: 90%; max-width: 450px;
            max-height: 90vh; overflow-y: auto;
            box-shadow: 0 25px 50px rgba(0,0,0,0.25); animation: slideUp 0.3s ease;
        `;

        modalContent.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a1a, #000); color: white; padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px;">
                    <i class="fas fa-lock" style="font-size: 32px; color: #FFD700;"></i>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700;">First Login — Change Password</h2>
                </div>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">For your security, please create a new password</p>
            </div>

            <div style="padding: 32px 24px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FFD700, #FFA500); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 auto 16px;">
                        ${session.firstName.charAt(0)}${session.lastName.charAt(0)}
                    </div>
                    <h3 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">Welcome, ${session.firstName}!</h3>
                    <p style="margin: 0; color: #666; font-size: 14px;">Rider ID: ${session.riderId}</p>
                </div>

                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 18px; margin-top: 2px;"></i>
                        <div>
                            <h4 style="margin: 0 0 8px 0; color: #92400e; font-size: 14px; font-weight: 600;">SECURITY REQUIREMENT</h4>
                            <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.5;">
                                You must change your password before continuing. Your current password (Date of Birth) is temporary.
                            </p>
                        </div>
                    </div>
                </div>

                <form id="passwordChangeForm">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">New Password</label>
                        <div style="position: relative;">
                            <input type="password" id="newPassword" required style="
                                width: 100%; padding: 12px 40px 12px 12px; border: 1px solid #d1d5db;
                                border-radius: 8px; font-size: 14px; box-sizing: border-box;
                            " placeholder="Enter new password">
                            <button type="button" id="toggleNewPassword" style="
                                position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                                background: none; border: none; color: #6b7280; cursor: pointer; font-size: 16px;
                                padding: 8px; border-radius: 50%; transition: all 0.2s;
                            "><i class="fas fa-eye"></i></button>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Confirm New Password</label>
                        <div style="position: relative;">
                            <input type="password" id="confirmNewPassword" required style="
                                width: 100%; padding: 12px 40px 12px 12px; border: 1px solid #d1d5db;
                                border-radius: 8px; font-size: 14px; box-sizing: border-box;
                            " placeholder="Confirm new password">
                            <button type="button" id="toggleConfirmPassword" style="
                                position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                                background: none; border: none; color: #6b7280; cursor: pointer; font-size: 16px;
                                padding: 8px; border-radius: 50%; transition: all 0.2s;
                            "><i class="fas fa-eye"></i></button>
                        </div>
                    </div>

                    <div style="background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #6b7280;">
                        <h5 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">Password Requirements:</h5>
                        <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                            <li>At least 8 characters long</li>
                            <li>Contains at least 1 number</li>
                            <li>Contains at least 1 letter</li>
                            <li>Contains at least 1 special character</li>
                            <li>Cannot be your Date of Birth</li>
                        </ul>
                    </div>

                    <div id="passwordError" style="
                        background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px;
                        padding: 12px; margin-bottom: 20px; color: #991b1b; font-size: 13px; display: none;
                    "></div>

                    <div style="display: flex; gap: 12px;">
                        <button type="button" id="cancelPasswordChange" style="
                            flex: 1; padding: 12px 20px; background: #f3f4f6; color: #374151;
                            border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;
                            font-weight: 600; cursor: pointer;
                        ">Cancel</button>
                        <button type="submit" id="submitPasswordChange" style="
                            flex: 1; padding: 12px 20px; background: linear-gradient(135deg, #1a1a1a, #000);
                            color: white; border: none; border-radius: 8px; font-size: 14px;
                            font-weight: 600; cursor: pointer;
                        ">Update Password</button>
                    </div>
                </form>
            </div>
        `;

        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
        this.setupPasswordChangeForm(session, currentPassword, modalOverlay);
    }

    // ─── Password Change Form Handlers ────────────────────────────────────────
    setupPasswordChangeForm(session, currentPassword, modalOverlay) {
        const form                = document.getElementById('passwordChangeForm');
        const newPasswordInput    = document.getElementById('newPassword');
        const confirmPasswordInput= document.getElementById('confirmNewPassword');
        const passwordError       = document.getElementById('passwordError');
        const toggleNewBtn        = document.getElementById('toggleNewPassword');
        const toggleConfirmBtn    = document.getElementById('toggleConfirmPassword');
        const cancelBtn           = document.getElementById('cancelPasswordChange');
        const submitBtn           = document.getElementById('submitPasswordChange');

        toggleNewBtn.addEventListener('click', () => {
            const t = newPasswordInput.type === 'password' ? 'text' : 'password';
            newPasswordInput.type = t;
            toggleNewBtn.innerHTML = t === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
        toggleNewBtn.addEventListener('mouseenter', () => toggleNewBtn.style.background = 'rgba(0,0,0,0.05)');
        toggleNewBtn.addEventListener('mouseleave', () => toggleNewBtn.style.background = 'none');

        toggleConfirmBtn.addEventListener('click', () => {
            const t = confirmPasswordInput.type === 'password' ? 'text' : 'password';
            confirmPasswordInput.type = t;
            toggleConfirmBtn.innerHTML = t === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
        toggleConfirmBtn.addEventListener('mouseenter', () => toggleConfirmBtn.style.background = 'rgba(0,0,0,0.05)');
        toggleConfirmBtn.addEventListener('mouseleave', () => toggleConfirmBtn.style.background = 'none');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            passwordError.style.display = 'none';

            const newPassword     = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword !== confirmPassword) {
                passwordError.textContent = 'Passwords do not match';
                passwordError.style.display = 'block';
                return;
            }

            const validation = this.validatePasswordRequirements(newPassword);
            if (!validation.isValid) {
                passwordError.innerHTML = validation.errors.join('<br>');
                passwordError.style.display = 'block';
                return;
            }

            // Update password via API
            submitBtn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled   = true;

            try {
                const res = await fetch(`${API_BASE}/admin/riders/${session.dbRiderId}/change-password`, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        current_password: currentPassword,
                        new_password:     newPassword
                    })
                });

                if (res.ok) {
                    // Update session flag
                    session.isFirstLogin = false;
                    localStorage.setItem('riderSession', JSON.stringify(session));

                    document.body.removeChild(modalOverlay);
                    this.showSuccessToast(`Welcome to K3K3, ${session.firstName}! Password updated.`);
                    setTimeout(() => this.redirectToDashboard(session), 1500);
                } else {
                    const err = await res.json();
                    passwordError.textContent = err.detail || 'Failed to update password. Please try again.';
                    passwordError.style.display = 'block';
                    submitBtn.innerHTML = 'Update Password';
                    submitBtn.disabled  = false;
                }
            } catch (err) {
                passwordError.textContent = 'Server error. Please try again.';
                passwordError.style.display = 'block';
                submitBtn.innerHTML = 'Update Password';
                submitBtn.disabled  = false;
            }
        });

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) document.body.removeChild(modalOverlay);
        });
    }

    // ─── Success Toast ────────────────────────────────────────────────────────
    showSuccessToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white; padding: 16px 24px; border-radius: 12px;
            box-shadow: 0 10px 25px rgba(16,185,129,0.3); z-index: 10001;
            font-weight: 600; font-size: 14px; max-width: 320px;
        `;
        toast.innerHTML = `<i class="fas fa-check-circle" style="margin-right: 8px;"></i>${message}`;
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
    }

    // ─── Redirect to Rider Dashboard ──────────────────────────────────────────
    redirectToDashboard(session) {
        localStorage.setItem('riderSession', JSON.stringify(session));

        // Check rider status and redirect accordingly
        if (session.status === 'approved') {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = 'rider-pending.html';
        }
    }
}

// ─── Logout helper (called from rider dashboard pages) ────────────────────────
function riderLogout() {
    localStorage.removeItem('riderSession');
    sessionStorage.removeItem('riderSession');
    window.location.href = 'rider-login.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    window.riderLogin = new RiderLoginSystem();
});
