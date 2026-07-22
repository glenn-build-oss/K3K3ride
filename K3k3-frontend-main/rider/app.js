// K3K3 Rider Application System
class RiderApp {
    constructor() {
        this.currentUser = null;
        this.applicationData = {
            personalInfo: {},
            contactInfo: {},
            idVerification: {},
            vehicleInfo: {},
            paymentInfo: {}
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingSession();
        console.log('🚀 K3K3 Rider App Initialized');
    }

    setupEventListeners() {
        // Registration form steps
        document.getElementById('startRegistration')?.addEventListener('click', () => this.startRegistration());
        document.getElementById('nextStep1')?.addEventListener('click', () => this.nextStep(1));
        document.getElementById('nextStep2')?.addEventListener('click', () => this.nextStep(2));
        document.getElementById('nextStep3')?.addEventListener('click', () => this.nextStep(3));
        document.getElementById('nextStep4')?.addEventListener('click', () => this.nextStep(4));
        document.getElementById('submitApplication')?.addEventListener('click', () => this.submitApplication());
        
        // Form inputs
        this.setupFormValidation();
    }

    checkExistingSession() {
        const savedApplication = localStorage.getItem('k3k3_rider_application');
        if (savedApplication) {
            this.applicationData = JSON.parse(savedApplication);
            console.log('📋 Found saved application data');
        }
    }

    startRegistration() {
        console.log('📝 Starting rider registration...');
        this.showStep(1);
        this.updateProgressBar(0);
    }

    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.registration-step').forEach(step => {
            step.style.display = 'none';
        });
        
        // Show current step
        const currentStep = document.getElementById(`step${stepNumber}`);
        if (currentStep) {
            currentStep.style.display = 'block';
        }
        
        // Update progress
        this.updateProgressBar(stepNumber - 1);
    }

    updateProgressBar(progress) {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${progress * 25}%`;
        }
        
        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            if (index <= progress) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    nextStep(currentStep) {
        if (this.validateStep(currentStep)) {
            this.saveStepData(currentStep);
            this.showStep(currentStep + 1);
        }
    }

    validateStep(stepNumber) {
        switch(stepNumber) {
            case 1:
                return this.validatePersonalInfo();
            case 2:
                return this.validateContactInfo();
            case 3:
                return this.validateIdVerification();
            case 4:
                return this.validateVehicleInfo();
            default:
                return true;
        }
    }

    validatePersonalInfo() {
        const firstName = document.getElementById('firstName')?.value;
        const lastName = document.getElementById('lastName')?.value;
        const dateOfBirth = document.getElementById('dateOfBirth')?.value;
        const gender = document.getElementById('gender')?.value;
        
        if (!firstName || !lastName || !dateOfBirth || !gender) {
            this.showError('Please fill in all personal information fields');
            return false;
        }
        
        // Validate age (must be 18+)
        const age = this.calculateAge(dateOfBirth);
        if (age < 18) {
            this.showError('You must be at least 18 years old to register');
            return false;
        }
        
        return true;
    }

    validateContactInfo() {
        const phone = document.getElementById('phone')?.value;
        const email = document.getElementById('email')?.value;
        const address = document.getElementById('address')?.value;
        const emergencyContact = document.getElementById('emergencyContact')?.value;
        
        if (!phone || !email || !address || !emergencyContact) {
            this.showError('Please fill in all contact information fields');
            return false;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showError('Please enter a valid email address');
            return false;
        }
        
        // Validate Ghana phone format
        const phoneRegex = /^(\+233|0)[234567]\d{7}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            this.showError('Please enter a valid Ghana phone number');
            return false;
        }
        
        return true;
    }

    validateIdVerification() {
        const idType = document.getElementById('idType')?.value;
        const idNumber = document.getElementById('idNumber')?.value;
        const idUpload = document.getElementById('idUpload')?.files[0];
        
        if (!idType || !idNumber || !idUpload) {
            this.showError('Please provide ID type, number, and upload ID document');
            return false;
        }
        
        // Validate ID number format based on type
        if (idType === 'Ghana Card') {
            const ghanaCardRegex = /^GHA-\d{9}-\d$/;
            if (!ghanaCardRegex.test(idNumber)) {
                this.showError('Please enter a valid Ghana Card number (format: GHA-XXXXXXXXX)');
                return false;
            }
        }
        
        // Validate file size (max 5MB)
        if (idUpload.size > 5 * 1024 * 1024) {
            this.showError('ID file size must be less than 5MB');
            return false;
        }
        
        return true;
    }

    validateVehicleInfo() {
        const vehicleType = document.getElementById('vehicleType')?.value;
        const vehicleBrand = document.getElementById('vehicleBrand')?.value;
        const vehicleModel = document.getElementById('vehicleModel')?.value;
        const vehicleYear = document.getElementById('vehicleYear')?.value;
        const vehiclePlate = document.getElementById('vehiclePlate')?.value;
        
        if (!vehicleType || !vehicleBrand || !vehicleModel || !vehicleYear || !vehiclePlate) {
            this.showError('Please fill in all vehicle information fields');
            return false;
        }
        
        // Validate vehicle year (not too old or too new)
        const currentYear = new Date().getFullYear();
        if (vehicleYear < 2010 || vehicleYear > currentYear + 1) {
            this.showError('Vehicle year must be between 2010 and current year');
            return false;
        }
        
        return true;
    }

    saveStepData(stepNumber) {
        switch(stepNumber) {
            case 1:
                this.applicationData.personalInfo = {
                    firstName: document.getElementById('firstName')?.value,
                    lastName: document.getElementById('lastName')?.value,
                    dateOfBirth: document.getElementById('dateOfBirth')?.value,
                    gender: document.getElementById('gender')?.value
                };
                break;
            case 2:
                this.applicationData.contactInfo = {
                    phone: document.getElementById('phone')?.value,
                    email: document.getElementById('email')?.value,
                    address: document.getElementById('address')?.value,
                    emergencyContact: document.getElementById('emergencyContact')?.value
                };
                break;
            case 3:
                this.applicationData.idVerification = {
                    idType: document.getElementById('idType')?.value,
                    idNumber: document.getElementById('idNumber')?.value,
                    idUpload: document.getElementById('idUpload')?.files[0]?.name
                };
                break;
            case 4:
                this.applicationData.vehicleInfo = {
                    vehicleType: document.getElementById('vehicleType')?.value,
                    vehicleBrand: document.getElementById('vehicleBrand')?.value,
                    vehicleModel: document.getElementById('vehicleModel')?.value,
                    vehicleYear: document.getElementById('vehicleYear')?.value,
                    vehiclePlate: document.getElementById('vehiclePlate')?.value
                };
                break;
        }
        
        // Save to localStorage
        localStorage.setItem('k3k3_rider_application', JSON.stringify(this.applicationData));
    }

    async submitApplication() {
        try {
            console.log('📤 Submitting rider application...');
            
            // Validate final step (payment info)
            if (!this.validatePaymentInfo()) {
                return;
            }
            
            // Save final step data
            this.applicationData.paymentInfo = {
                preferredMethod: document.getElementById('paymentMethod')?.value,
                accountNumber: document.getElementById('accountNumber')?.value
            };
            
            // Generate complete rider profile
            const riderProfile = this.generateRiderProfile();
            
            // Show loading state
            this.showLoading();
            
            // Submit to backend (or simulate for now)
            await this.submitToBackend(riderProfile);
            
            // Show success
            this.showSuccess();
            
            // Clear saved application
            localStorage.removeItem('k3k3_rider_application');
            
        } catch (error) {
            console.error('❌ Error submitting application:', error);
            this.showError('Failed to submit application. Please try again.');
        }
    }

    validatePaymentInfo() {
        const paymentMethod = document.getElementById('paymentMethod')?.value;
        const accountNumber = document.getElementById('accountNumber')?.value;
        
        if (!paymentMethod || !accountNumber) {
            this.showError('Please provide payment information');
            return false;
        }
        
        // Validate account number format based on payment method
        if (paymentMethod === 'Mobile Money') {
            const phoneRegex = /^(\+233|0)[234567]\d{7}$/;
            if (!phoneRegex.test(accountNumber.replace(/\s/g, ''))) {
                this.showError('Please enter a valid mobile money number');
                return false;
            }
        }
        
        return true;
    }

    generateRiderProfile() {
        const fullName = `${this.applicationData.personalInfo.firstName} ${this.applicationData.personalInfo.lastName}`;
        const email = this.applicationData.contactInfo.email;
        const phone = this.applicationData.contactInfo.phone;
        
        // Generate unique rider ID
        const riderId = this.generateRiderId();
        
        return {
            id: riderId,
            name: fullName,
            email: email,
            phone: phone,
            status: 'pending',
            joinDate: new Date().toISOString().split('T')[0],
            trips: 0,
            rating: 0.0,
            avatar: this.getRandomAvatar(),
            profile: {
                dateOfBirth: this.applicationData.personalInfo.dateOfBirth,
                address: this.applicationData.contactInfo.address,
                emergencyContact: this.applicationData.contactInfo.emergencyContact,
                idType: this.applicationData.idVerification.idType,
                idNumber: this.applicationData.idVerification.idNumber,
                verificationStatus: 'pending'
            },
            performance: {
                totalRevenue: 0,
                avgTripDistance: 0,
                completionRate: 0,
                cancellationRate: 0,
                lastActiveDate: null
            },
            payment: {
                preferredMethod: this.applicationData.paymentInfo.preferredMethod,
                accountNumber: this.applicationData.paymentInfo.accountNumber,
                walletBalance: 0.00
            },
            vehicle: this.applicationData.vehicleInfo,
            applicationDate: new Date().toISOString(),
            applicationSource: 'web'
        };
    }

    generateRiderId() {
        // Generate unique rider ID with K3P prefix
        const randomDigits = Math.floor(Math.random() * 900000) + 100000;
        return `K3P-${randomDigits}`;
    }

    getRandomAvatar() {
        const avatars = ['👨', '👩', '🧑', '👱', '👴', '👵'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    async submitToBackend(riderProfile) {
        // Simulate API call to submit rider data
        console.log('📤 Submitting rider profile:', riderProfile);
        
        // In a real implementation, this would be:
        // const response = await fetch('/api/riders/register', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(riderProfile)
        // });
        
        // For now, simulate the API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Store in localStorage for admin system to pick up
        this.storeForAdminSystem(riderProfile);
        
        return riderProfile;
    }

    storeForAdminSystem(riderProfile) {
        // Store in a shared location that admin system can access
        let pendingApplications = JSON.parse(localStorage.getItem('k3k3_pending_applications') || '[]');
        pendingApplications.push({
            ...riderProfile,
            timestamp: Date.now()
        });
        localStorage.setItem('k3k3_pending_applications', JSON.stringify(pendingApplications));
        
        console.log('✅ Rider application stored for admin review');
    }

    showLoading() {
        const submitBtn = document.getElementById('submitApplication');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        }
    }

    showSuccess() {
        const submitBtn = document.getElementById('submitApplication');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Application Submitted!';
        }
        
        // Show success message
        this.showNotification('Application submitted successfully! We will review your application within 24-48 hours.', 'success');
        
        // Redirect to success page after delay
        setTimeout(() => {
            window.location.href = 'application-success.html';
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    calculateAge(dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }

    setupFormValidation() {
        // Add real-time validation
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        // Add specific validation based on field type
        if (field.id === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (value && !emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        } else if (field.id === 'phone') {
            const phoneRegex = /^(\+233|0)[234567]\d{7}$/;
            if (value && !phoneRegex.test(value.replace(/\s/g, ''))) {
                isValid = false;
                errorMessage = 'Please enter a valid Ghana phone number';
            }
        } else if (field.required && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }
        
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }
        
        return isValid;
    }

    showFieldError(field, message) {
        field.classList.add('error');
        
        // Remove existing error message
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        
        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(field) {
        field.classList.remove('error');
        const errorDiv = field.parentNode.querySelector('.field-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
}

// Initialize the rider app
const riderApp = new RiderApp();
