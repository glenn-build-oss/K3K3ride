// Multi-Step Rider Application Form

class RiderApplicationForm {

    constructor() {

        this.currentStep = 1;

        this.totalSteps = 4;

        this.formData = {};

        

        this.initializeElements();

        this.attachEventListeners();

        this.updateProgressBar();

    }

    

    initializeElements() {

        this.form = document.getElementById('riderApplicationForm');

        this.stepIndicators = document.querySelectorAll('.step-indicator');

        this.formSteps = document.querySelectorAll('.form-step');

        this.steps = this.formSteps; // ✅ Added missing property

        this.progressSteps = this.stepIndicators; // ✅ Added missing property

        this.prevBtn = document.getElementById('prevBtn');

        this.nextBtn = document.getElementById('nextBtn');

        this.submitBtn = document.getElementById('submitBtn');

        this.progressBar = document.getElementById('progressBar');

        this.fileInputs = this.form.querySelectorAll('input[type="file"]');

        

        console.log('🎯 Form elements initialized:');

        console.log('📝 Form:', this.form);

        console.log('📁 File inputs:', this.fileInputs.length);

        console.log('👆 File inputs array:', Array.from(this.fileInputs));

        

        // File upload handlers - only set up once to prevent duplicates

        // Note: We don't add change event listeners here because they're set up in setupDragAndDrop

        

        // Real-time form validation

        this.form.addEventListener('input', (e) => {

            this.validateField(e.target);

            this.updateProgressOnInput();

        });

        

        // Also update progress on change events (for selects, checkboxes)

        this.form.addEventListener('change', (e) => {

            this.validateField(e.target);

            this.updateProgressOnInput();

        });

    }

    

    attachEventListeners() {

        this.prevBtn.addEventListener('click', () => this.previousStep());

        this.nextBtn.addEventListener('click', () => this.nextStep());

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        

        // Nationality dropdown change handler

        const nationalitySelect = document.getElementById('nationality');

        if (nationalitySelect) {

            nationalitySelect.addEventListener('change', (e) => this.handleNationalityChange(e));

        }

        

        // Drag and drop for file uploads

        this.setupDragAndDrop();

    }

    

    handleNationalityChange(event) {

        const nationality = event.target.value;

        const specifyGroup = document.getElementById('specifyCountryGroup');

        const specifyInput = document.getElementById('specifyCountry');

        

        if (nationality) {

            // Show the specify field with faint styling

            specifyGroup.style.display = 'block';

            specifyInput.classList.add('faint-ink');

            specifyInput.setAttribute('required', 'required');

            specifyInput.placeholder = 'Please specify your country';

            specifyInput.value = '';

        } else {

            // Hide if no nationality selected

            specifyGroup.style.display = 'none';

            specifyInput.removeAttribute('required');

            specifyInput.value = '';

        }

    }

    

    setupDragAndDrop() {

        const fileUploads = document.querySelectorAll('.file-upload');

        console.log('🎯 Setting up drag and drop for', fileUploads.length, 'file upload areas');

        

        fileUploads.forEach((upload, index) => {

            console.log(`📁 Setting up upload area ${index + 1}:`, upload);

            

            // Get the file input for this upload area

            const input = upload.querySelector('input[type="file"]');

            

            // Add change event listener to the file input

            if (input) {

                input.addEventListener('change', (e) => this.handleFileUpload(e));

            }

            

            // Add click handler for manual file selection

            upload.addEventListener('click', (e) => {

                // Only trigger if the click is not on the file input itself

                if (e.target !== input) {

                    e.preventDefault();

                    e.stopPropagation();

                    console.log('Click detected on upload area');

                    if (input) {

                        console.log('Triggering file input click');

                        input.click();

                    } else {

                        console.error('No file input found in upload area');

                    }

                }

            });

            

            // Prevent default drag behaviors

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {

                upload.addEventListener(eventName, (e) => {

                    e.preventDefault();

                    e.stopPropagation();

                }, false);

            });

            

            // Highlight drop area when item is dragged over it

            ['dragenter', 'dragover'].forEach(eventName => {

                upload.addEventListener(eventName, () => {

                    upload.classList.add('drag-over');

                    console.log('🎯 Drag over detected');

                }, false);

            });

            

            ['dragleave', 'drop'].forEach(eventName => {

                upload.addEventListener(eventName, () => {

                    upload.classList.remove('drag-over');

                    console.log('🎯 Drag leave/drop detected');

                }, false);

            });

            

            // Handle dropped files

            upload.addEventListener('drop', (e) => {

                e.preventDefault();

                e.stopPropagation();

                console.log('📥 Drop event detected:', e);

                const files = e.dataTransfer.files;

                console.log('📁 Files dropped:', files.length, files);

                

                if (files.length > 0) {

                    console.log('🎯 Found input:', input);

                    

                    if (input) {

                        // Create a new DataTransfer object to set the files

                        const dataTransfer = new DataTransfer();

                        for (let i = 0; i < files.length; i++) {

                            dataTransfer.items.add(files[i]);

                        }

                        input.files = dataTransfer.files;

                        

                        console.log('📁 Files set to input:', input.files);

                        

                        // Trigger the file upload handler

                        this.handleFileUpload({ target: input });

                    } else {

                        console.error('❌ No file input found in upload area');

                    }

                }

            }, false);

        });

    }

    

    handleFileUpload(event) {

        const input = event.target;

        const file = input.files[0];

        

        if (file) {

            const uploadPreview = input.nextElementSibling;

            const uploadText = uploadPreview.querySelector('.upload-text');

            const uploadHint = uploadPreview.querySelector('.upload-hint');

            const fileUpload = input.closest('.file-upload');

            

            // Validate file size

            const maxSize = input.id === 'passportPhoto' ? 10 * 1024 * 1024 : 20 * 1024 * 1024; // 10MB for passport, 20MB for others

            const maxLabel = input.id === 'passportPhoto' ? '10MB' : '20MB';

            

            if (file.size > maxSize) {

                this.showError(`File size exceeds ${maxLabel} limit. Please choose a smaller file.`);

                // Reset input

                input.value = '';

                uploadText.textContent = 'Click to upload or drag and drop';

                uploadHint.textContent = input.id === 'passportPhoto' ? 'PNG, JPG up to 10MB' : 'PNG, JPG, PDF up to 20MB';

                uploadPreview.style.color = '';

                fileUpload.classList.remove('has-file');

                return;

            }

            

            // Validate file type

            const allowedTypes = input.id === 'passportPhoto' 

                ? ['image/jpeg', 'image/jpg', 'image/png']

                : ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

            

            if (!allowedTypes.includes(file.type)) {

                const allowedTypesText = input.id === 'passportPhoto' ? 'PNG, JPG, PDF' : 'PNG, JPG, PDF';

                this.showError(`Invalid file type. Please upload ${allowedTypesText} files only.`);

                // Reset input

                input.value = '';

                uploadText.textContent = 'Click to upload or drag and drop';

                uploadHint.textContent = input.id === 'passportPhoto' ? 'PNG, JPG, PDF up to 10MB' : 'PNG, JPG, PDF up to 20MB';

                uploadPreview.style.color = '';

                fileUpload.classList.remove('has-file');

                return;

            }

            

            // Create preview for image files

            if (file.type.startsWith('image/')) {

                const reader = new FileReader();

                reader.onload = (e) => {

                    const img = document.createElement('img');

                    img.src = e.target.result;

                    img.className = 'preview-image';

                    

                    // Clear existing preview content

                    uploadPreview.innerHTML = '';

                    uploadPreview.appendChild(img);

                    

                    // Add file info

                    const fileInfo = document.createElement('div');

                    fileInfo.className = 'file-info';

                    fileInfo.innerHTML = `

                        <div class="file-name">${file.name}</div>

                        <div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>

                    `;

                    uploadPreview.appendChild(fileInfo);

                };

                reader.readAsDataURL(file);

            } else {

                // For PDF and other files, show icon

                uploadPreview.innerHTML = `

                    <i class="fas fa-file-pdf" style="font-size: 3rem; color: #dc2626; margin-bottom: 10px;"></i>

                    <div class="file-info">

                        <div class="file-name">${file.name}</div>

                        <div class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>

                    </div>

                `;

            }

            

            // Update upload area

            uploadPreview.style.color = 'var(--k3k3-success)';

            fileUpload.classList.add('has-file');

            

            // Store file data

            this.formData[input.name] = file;

            

            // Show success feedback

            this.showSuccess(`${file.name} uploaded successfully!`);

        }

    }

    

    // File management functions

    exportFile(inputId) {

        const file = this.formData[input.name];

        

        if (!file) {

            this.showError('No file uploaded to export');

            return;

        }

        

        try {

            // Create download link

            const downloadLink = document.createElement('a');

            downloadLink.href = URL.createObjectURL(file);

            downloadLink.download = file.name;

            downloadLink.style.display = 'none';

            

            document.body.appendChild(downloadLink);

            downloadLink.click();

            document.body.removeChild(downloadLink);

            

            // Clean up the URL

            setTimeout(() => {

                URL.revokeObjectURL(downloadLink.href);

            }, 1000);

            

            // Log for debugging

            console.log(` Exporting file: ${file.name} (${file.type})`);

            

            // Show success message

            this.showSuccess(`${file.name} exported successfully!`);

        } catch (error) {

            console.error(' Error exporting file:', error);

            this.showError('Failed to export file. Please try again.');

        }

    }

    

    exportFile(inputId) {

        const input = document.getElementById(inputId);

        const file = this.formData[input.name];

        

        // Clear the file input

        input.value = '';

        

        // Remove from form data

        delete this.formData[input.name];

        

        // Reset preview

        uploadPreview.innerHTML = `

            <span class="upload-text">Click to upload or drag and drop</span>

            <span class="upload-hint">${input.id === 'passportPhoto' ? 'PNG, JPG up to 10MB' : 'PNG, JPG, PDF up to 20MB'}</span>

        `;

        uploadPreview.style.color = '';

        fileUpload.classList.remove('has-file');

        

        // Log for debugging

        console.log(`🗑️ Removed file: ${input.name}`);

        

        // Show success message

        this.showSuccess('File removed successfully!');

    }

    

    updateProgressOnInput() {

        // Check current step completion and update progress bar

        const currentStepElement = document.querySelector(`.form-step[data-step="${this.currentStep}"]`);

        if (!currentStepElement) return;

        

        // Get all required fields in current step

        const requiredFields = currentStepElement.querySelectorAll('[required]');

        const optionalFields = currentStepElement.querySelectorAll('input:not([required]), select:not([required]), textarea:not([required])');

        

        // Check if all required fields are filled

        let allRequiredFilled = true;

        requiredFields.forEach(field => {

            if (field.type === 'checkbox') {

                if (!field.checked) {

                    allRequiredFilled = false;

                }

            } else if (field.type === 'file') {

                if (!this.formData[field.name]) {

                    allRequiredFilled = false;

                }

            } else {

                if (!field.value || !field.value.trim()) {

                    allRequiredFilled = false;

                }

            }

        });

        

        // Update progress bar to show completion of current step

        const progressSteps = document.querySelectorAll('.step');

        const stepNames = ['', 'Personal Info', 'Vehicle Details', 'Documents', 'Review'];

        progressSteps.forEach((step, index) => {

            if (!step) return;

            

            step.classList.remove('active', 'completed');

            

            if (index + 1 < this.currentStep) {

                // Previous steps are completed

                step.classList.add('completed');

                step.innerHTML = `<span class="step-number">✓</span><span class="step-title">${stepNames[index + 1]} completed</span>`;

            } else if (index + 1 === this.currentStep) {

                // Current step - check if required fields are filled

                if (allRequiredFilled) {

                    step.classList.add('completed');

                    step.innerHTML = `<span class="step-number">✓</span><span class="step-title">${stepNames[index + 1]} completed</span>`;

                } else {

                    step.classList.add('active');

                    step.innerHTML = `<span class="step-number active">${index + 1}</span><span class="step-title">${stepNames[index + 1]}</span>`;

                }

            } else {

                // Future steps

                step.innerHTML = `<span class="step-number">${index + 1}</span><span class="step-title">${stepNames[index + 1]}</span>`;

            }

        });

    }

    

    validateField(field) {

        // Bypass all validation for testing

        return true;

    }

    

    validateCurrentStep() {

        console.log(`🔍 Validating step ${this.currentStep}`);

        

        switch(this.currentStep) {

            case 1:

                return this.validatePersonalInfo();

            case 2:

                return this.validateVehicleDetails();

            case 3:

                return this.validateDocuments();

            case 4:

                return this.validateReview();

            default:

                return true;

        }

    }

    

    validatePersonalInfo() {

        const firstName = document.getElementById('firstName').value.trim();

        const lastName = document.getElementById('lastName').value.trim();

        const email = document.getElementById('email').value.trim();

        const phone = document.getElementById('phone').value.trim();

        const dateOfBirth = document.getElementById('dateOfBirth').value;

        const nationality = document.getElementById('nationality').value;

        const address = document.getElementById('address').value.trim();

        

        // Check each field individually for better user feedback

        if (!firstName) {

            this.showToast('Please fill in the First Name field', 'error');

            return false;

        }

        if (!lastName) {

            this.showToast('Please fill in the Last Name field', 'error');

            return false;

        }

        if (!email) {

            this.showToast('Please fill in the Email field', 'error');

            return false;

        }

        if (!phone) {

            this.showToast('Please fill in the Phone Number field', 'error');

            return false;

        }

        if (!dateOfBirth) {

            this.showToast('Please fill in the Date of Birth field', 'error');

            return false;

        }

        if (!nationality) {

            this.showToast('Please fill in the Nationality field', 'error');

            return false;

        }

        if (!address) {

            this.showToast('Please fill in the Address field', 'error');

            return false;

        }

        

        // Email validation

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {

            this.showToast('Please enter a valid email address (e.g., name@domain.com).', 'error');

            return false;

        }

        

        // Phone validation (basic)

        if (phone.length < 10) {

            this.showToast('Please enter a valid phone number (minimum 10 digits).', 'error');

            return false;

        }

        

        // Show professional success message when all fields are filled

        this.showToast('Personal Information completed successfully! Proceeding to Vehicle Details.', 'success');

        console.log('✅ Personal Info validation passed');

        return true;

    }

    

    validateVehicleDetails() {

        const vehicleType = document.getElementById('vehicleType').value;

        const vehicleMake = document.getElementById('vehicleMake').value.trim();

        const vehicleModel = document.getElementById('vehicleModel').value.trim();

        const vehicleYear = document.getElementById('vehicleYear').value;

        const vehicleColor = document.getElementById('vehicleColor').value.trim();

        const plateNumber = document.getElementById('plateNumber').value.trim();

        

        // Check each field individually for better user feedback

        if (!vehicleType) {

            this.showToast('Please fill in the Vehicle Type field', 'error');

            return false;

        }

        if (!vehicleMake) {

            this.showToast('Please fill in the Vehicle Make field', 'error');

            return false;

        }

        if (!vehicleModel) {

            this.showToast('Please fill in the Vehicle Model field', 'error');

            return false;

        }

        if (!vehicleYear) {

            this.showToast('Please fill in the Vehicle Year field', 'error');

            return false;

        }

        if (!vehicleColor) {

            this.showToast('Please fill in the Vehicle Color field', 'error');

            return false;

        }

        if (!plateNumber) {

            this.showToast('Please fill in the Plate Number field', 'error');

            return false;

        }

        

        // Year validation

        const currentYear = new Date().getFullYear();

        const year = parseInt(vehicleYear);

        if (isNaN(year) || year < 1990 || year > currentYear) {

            this.showToast(`Please enter a valid vehicle year (1990-${currentYear}).`, 'error');

            return false;

        }

        

        // Show professional success message when all fields are filled

        this.showToast('Vehicle Details completed successfully! Proceeding to Documents.', 'success');

        console.log('✅ Vehicle Details validation passed');

        return true;

    }

    

    validateDocuments() {

        const riderLicense = this.formData.riderLicense;

        const vehicleRegistration = this.formData.vehicleRegistration;

        const insurance = this.formData.insurance;

        const idCard = this.formData.idCard;

        const passportPhoto = this.formData.passportPhoto;

        

        // Check each document individually for better user feedback

        if (!riderLicense) {

            this.showToast('Please upload your Rider\'s License document', 'error');

            return false;

        }

        if (!vehicleRegistration) {

            this.showToast('Please upload your Vehicle Registration document', 'error');

            return false;

        }

        if (!insurance) {

            this.showToast('Please upload your Insurance Certificate document', 'error');

            return false;

        }

        if (!idCard) {

            this.showToast('Please upload your National ID Card document', 'error');

            return false;

        }

        if (!passportPhoto) {

            this.showToast('Please upload your Passport Photo', 'error');

            return false;

        }

        

        // Show professional success message when all documents are uploaded

        this.showToast('All documents uploaded successfully! Proceeding to Review.', 'success');

        console.log('✅ Documents validation passed');

        return true;

    }

    

    validateReview() {

        // Review step just needs to ensure all previous data is saved

        if (!this.formData.firstName || !this.formData.lastName || !this.formData.email) {

            this.showToast('Please complete all previous steps before reviewing your application.', 'error');

            return false;

        }

        

        // Show professional success message for review completion

        this.showToast('Application review completed! Ready to submit your K3K3 rider application.', 'success');

        console.log('✅ Review validation passed');

        return true;

    }

    

    nextStep() {

        if (!this.validateCurrentStep()) {

            this.showToast('Please fill in all required fields before proceeding.', 'error');

            return;

        }

        

        // Save current step data

        this.saveStepData();

        

        if (this.currentStep < this.totalSteps) {

            this.currentStep++;

            this.showStep(this.currentStep);

            this.updateProgressBar();

            this.updateNavigationButtons();

            

            // Show professional transition message

            const stepNames = ['', 'Personal Information', 'Vehicle Details', 'Documents', 'Review'];

            this.showToast(`Moving to ${stepNames[this.currentStep]} step.`, 'info');

            

            // If we're on the review step, populate the review section

            if (this.currentStep === 4) {

                this.populateReview();

            }

        }

    }

    

    previousStep() {

        if (this.currentStep > 1) {

            this.currentStep--;

            this.showStep(this.currentStep);

            this.updateProgressBar();

            this.updateNavigationButtons();

        }

    }

    

    showStep(stepNumber) {

        if (!this.steps) {

            console.error('❌ Steps not initialized');

            return;

        }

        

        this.steps.forEach(step => {

            if (step) step.classList.remove('active');

        });

        

        const targetStep = document.querySelector(`.form-step[data-step="${stepNumber}"]`);

        if (targetStep) {

            targetStep.classList.add('active');

        }

    }

    

    updateProgressBar() {

        if (!this.progressSteps) {

            console.error('❌ Progress steps not initialized');

            return;

        }

        

        this.progressSteps.forEach((step, index) => {

            if (!step) return;

            

            step.classList.remove('active', 'completed');

            

            if (index + 1 < this.currentStep) {

                // Previous steps are completed

                step.classList.add('completed');

                const stepNames = ['', 'Personal Info', 'Vehicle Details', 'Documents', 'Review'];

                step.innerHTML = `<span class="step-number">✓</span><span class="step-title">${stepNames[index + 1]} completed</span>`;

            } else if (index + 1 === this.currentStep) {

                step.classList.add('active');

                const stepNames = ['', 'Personal Info', 'Vehicle Details', 'Documents', 'Review'];

                step.innerHTML = `<span class="step-number active">${index + 1}</span><span class="step-title">${stepNames[index + 1]}</span>`;

            } else {

                // Future steps - show number but not active

                const stepNames = ['', 'Personal Info', 'Vehicle Details', 'Documents', 'Review'];

                step.innerHTML = `<span class="step-number">${index + 1}</span><span class="step-title">${stepNames[index + 1]}</span>`;

            }

        });

    }

    

    updateNavigationButtons() {

        if (this.prevBtn) {

            this.prevBtn.style.display = this.currentStep === 1 ? 'none' : 'block';

        }

        if (this.nextBtn) {

            this.nextBtn.style.display = this.currentStep === this.totalSteps ? 'none' : 'block';

        }

        if (this.submitBtn) {

            this.submitBtn.style.display = this.currentStep === this.totalSteps ? 'block' : 'none';

        }

    }

    

    saveStepData() {

        const currentStepElement = document.querySelector(`.form-step[data-step="${this.currentStep}"]`);

        if (!currentStepElement) {

            console.error('❌ Current step element not found');

            return;

        }

        

        const inputs = currentStepElement.querySelectorAll('input, select, textarea');

        

        inputs.forEach(input => {

            if (input.type === 'checkbox') {

                if (input.name === 'features') {

                    if (!this.formData.features) this.formData.features = [];

                    if (input.checked) {

                        this.formData.features.push(input.value);

                    }

                } else {

                    this.formData[input.name] = input.checked;

                }

            } else if (input.type === 'file') {

                // File inputs are handled separately

            } else {

                this.formData[input.name] = input.value;

            }

        });

    }

    

    populateReview() {

        // Personal Information Review

        const personalReview = document.getElementById('reviewPersonal');

        personalReview.innerHTML = `

            <p><strong>Name:</strong> ${this.formData.firstName} ${this.formData.lastName}</p>

            <p><strong>Email:</strong> ${this.formData.email}</p>

            <p><strong>Phone:</strong> ${this.formData.fullPhone || 'Not provided'}</p>

            <p><strong>Date of Birth:</strong> ${new Date(this.formData.dateOfBirth).toLocaleDateString()}</p>

            <p><strong>Nationality:</strong> ${this.formData.nationality}</p>

            <p><strong>Address:</strong> ${this.formData.address}</p>

            ${this.formData.about ? `<p><strong>About:</strong> ${this.formData.about}</p>` : ''}

        `;

        

        // Vehicle Information Review

        const vehicleReview = document.getElementById('reviewVehicle');

        vehicleReview.innerHTML = `

            <p><strong>Vehicle Type:</strong> ${this.formData.vehicleType}</p>

            <p><strong>Make:</strong> ${this.formData.vehicleMake}</p>

            <p><strong>Model:</strong> ${this.formData.vehicleModel}</p>

            <p><strong>Year:</strong> ${this.formData.vehicleYear}</p>

            <p><strong>Color:</strong> ${this.formData.vehicleColor}</p>

            <p><strong>Plate Number:</strong> ${this.formData.plateNumber}</p>

            ${this.formData.features && this.formData.features.length > 0 ? 

                `<p><strong>Features:</strong> ${this.formData.features.join(', ')}</p>` : ''}

        `;

        

        // Documents Review

        const documentsReview = document.getElementById('reviewDocuments');

        const documentNames = {

            riderLicense: "Rider's License",

            vehicleRegistration: "Vehicle Registration",

            insurance: "Insurance Certificate",

            idCard: "National ID Card",

            passportPhoto: "Passport Photo"

        };

        

        let documentsHTML = '';

        for (const [key, value] of Object.entries(this.formData)) {

            if (documentNames[key] && value instanceof File) {

                documentsHTML += `<p><strong>${documentNames[key]}:</strong> ${value.name}</p>`;

            }

        }

        documentsReview.innerHTML = documentsHTML || '<p>No documents uploaded</p>';

    }

    

    async handleSubmit(event) {

        event.preventDefault();

        

        // Show immediate toast notification

        this.showSuccess('Application submitted successfully! Thank you for applying to K3K3.');

        

        // Bypass validation for testing

        

        // Show loading state

        this.submitBtn.textContent = 'Submitting...';

        this.submitBtn.disabled = true;

        this.form.classList.add('loading');

        

        try {

            // Simulate API call (replace with actual endpoint)

            await this.submitApplication();

            

            // Show success message for admin review

            this.showSuccess('Your application has been submitted successfully! It has been sent to our admin team for review. You will receive an email response within 3-5 business days. You can check your application status by logging into your rider dashboard.');

            

            // Reset form after delay (don't redirect to admin)

            setTimeout(() => {

                this.resetForm();

                // Optionally redirect to rider login to check status

                // window.location.href = 'rider-login.html';

            }, 3000);

            

        } catch (error) {

            this.showError('There was an error submitting your application. Please try again.');

        } finally {

            this.submitBtn.textContent = 'Submit Application';

            this.submitBtn.disabled = false;

            this.form.classList.remove('loading');

        }

    }

    

    async submitApplication() {
        const BACKEND = '';

        const payload = {
            first_name:                 this.formData.firstName              || '',
            last_name:                  this.formData.lastName               || '',
            email:                      this.formData.email                  || '',
            phone:                      this.formData.fullPhone || this.formData.phone || '',
            date_of_birth:              this.formData.dateOfBirth            || null,
            gender:                     this.formData.gender                 || null,
            nationality:                this.formData.nationality            || null,
            address:                    this.formData.address                || null,
            city:                       this.formData.city                   || null,
            about:                      this.formData.about                  || null,
            license_number:             this.formData.licenseNumber          || null,
            license_expiry:             this.formData.licenseExpiry          || null,
            ghana_card_number:          this.formData.ghanaCardNumber        || null,
            vehicle_type:               this.formData.vehicleType            || null,
            vehicle_make:               this.formData.vehicleMake            || null,
            vehicle_model:              this.formData.vehicleModel           || null,
            vehicle_year:               this.formData.vehicleYear            || null,
            vehicle_plate:              this.formData.plateNumber || this.formData.vehiclePlate || null,
            vehicle_color:              this.formData.vehicleColor           || null,
            experience:                 this.formData.experience             || null,
            insurance_provider:         this.formData.insuranceProvider      || null,
            insurance_expiry:           this.formData.insuranceExpiry        || null,
            emergency_contact_name:     this.formData.emergencyContactName   || null,
            emergency_contact_phone:    this.formData.emergencyContactPhone  || null,
            emergency_contact_relation: this.formData.emergencyContactRelation || null,
            bank_name:                  this.formData.bankName               || null,
            account_number:             this.formData.accountNumber          || null,
        };

        // Validate required fields before sending
        if (!payload.first_name || !payload.last_name || !payload.email || !payload.phone) {
            throw new Error('Please fill in all required personal information fields.');
        }

        console.log('Submitting application to backend:', BACKEND + '/applications/');

        const response = await fetch(BACKEND + '/applications/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Application saved to database:', result.app_ref);
            // Also keep a local copy so the page can show the ref
            localStorage.setItem('lastApplicationRef', result.app_ref);
            return { success: true, appRef: result.app_ref, id: result.id };
        } else {
            let errMsg = 'Failed to submit application.';
            try {
                const errData = await response.json();
                errMsg = errData.detail || errMsg;
            } catch (_) {}
            throw new Error(errMsg);
        }
    }

    

    storeApplicationData() {

        // Get current application count for sequential numbering

        const existingApplications = JSON.parse(localStorage.getItem('riderApplications') || '[]');

        

        // Find the highest existing K3PA ID to continue sequence

        let nextNumber = 1;

        if (existingApplications.length > 0) {

            // Look for existing K3PA IDs to determine next number

            const k3paApplications = existingApplications.filter(app => 

                app.id && app.id.startsWith('K3PA-')

            );

            

            if (k3paApplications.length > 0) {

                // Extract numbers from existing K3PA IDs and find the highest

                const existingNumbers = k3paApplications.map(app => {

                    const match = app.id.match(/K3PA-(\d+)/);

                    return match ? parseInt(match[1]) : 0;

                }).filter(num => num > 0);

                

                if (existingNumbers.length > 0) {

                    const highestNumber = Math.max(...existingNumbers);

                    nextNumber = highestNumber + 1;

                }

            } else {

                // No K3PA IDs found, start from 1 + existing count

                nextNumber = existingApplications.length + 1;

            }

        }

        

        // Generate sequential K3K3 application ID

        const appId = 'K3PA-' + String(nextNumber).padStart(6, '0');

        

        // Prepare application data for rider applications admin

        const applicationData = {

            riderId: appId,

            id: appId,

            firstName: this.formData.firstName || 'Kwame',

            lastName: this.formData.lastName || 'Rider',

            email: this.formData.email || 'rider@k3k3.com',

            phone: this.formData.phone || '+233 XXX XXXX',

            vehicle: this.formData.vehicleType + ' ' + (this.formData.vehicleMake || '') + ' ' + (this.formData.vehicleModel || ''),

            rating: '0.0',

            trips: '0',

            earnings: '0',

            applicationDate: new Date().toISOString().split('T')[0],

            status: 'pending',

            dateOfBirth: this.formData.dateOfBirth || '1990-01-01',

            address: this.formData.address || 'Accra, Ghana',

            vehicleYear: this.formData.vehicleYear || '2020',

            vehiclePlate: this.formData.vehiclePlate || 'GR-1234-20',

            vehicleColor: this.formData.vehicleColor || 'Black',

            experience: this.formData.experience || '1+ years',

            // Documents for admin viewing

            documents: [

                ...(this.formData.riderLicense ? [{

                    id: 'license',

                    name: 'Rider License',

                    type: 'PDF',

                    url: this.getDocumentUrl(this.formData.riderLicense),

                    icon: 'fa-file-pdf'

                }] : []),

                ...(this.formData.vehicleRegistration ? [{

                    id: 'registration',

                    name: 'Vehicle Registration',

                    type: 'PDF',

                    url: this.getDocumentUrl(this.formData.vehicleRegistration),

                    icon: 'fa-file-pdf'

                }] : []),

                ...(this.formData.insurance ? [{

                    id: 'insurance',

                    name: 'Insurance Certificate',

                    type: 'PDF',

                    url: this.getDocumentUrl(this.formData.insurance),

                    icon: 'fa-file-pdf'

                }] : []),

                ...(this.formData.idCard ? [{

                    id: 'idcard',

                    name: 'ID Card',

                    type: 'Image',

                    url: this.getDocumentUrl(this.formData.idCard),

                    icon: 'fa-image'

                }] : []),

                ...(this.formData.passportPhoto ? [{

                    id: 'photo',

                    name: 'Passport Photo',

                    type: 'Image',

                    url: this.getDocumentUrl(this.formData.passportPhoto),

                    icon: 'fa-image'

                }] : [])

            ],

            adminNotes: ''

        };

        

        // Store in localStorage for rider applications admin to detect

        localStorage.setItem('riderApplication', JSON.stringify(applicationData));

        

        // Also store in riderApplications array for persistence

        existingApplications.push(applicationData);

        localStorage.setItem('riderApplications', JSON.stringify(existingApplications));

        

        console.log('Application stored for rider admin:', applicationData);

        console.log(`Generated K3PA ID: ${appId} (continuing from existing applications)`);

    }

    

    getDocumentUrl(file) {

        // Create object URL for any file type (images and PDFs)

        try {

            if (file) {

                return URL.createObjectURL(file);

            }

        } catch (error) {

            console.error('❌ Error creating document URL:', error);

        }

        return '../assets/documents/placeholder.pdf';

    }

    

    resetForm() {

        this.form.reset();

        this.currentStep = 1;

        this.formData = {};

        this.showStep(1);

        this.updateProgressBar();

        this.updateNavigationButtons();

        

        // Reset file upload previews

        this.fileInputs.forEach(input => {

            const preview = input.nextElementSibling;

            const uploadText = preview.querySelector('.upload-text');

            const uploadHint = preview.querySelector('.upload-hint');

            uploadText.textContent = 'Click to upload or drag and drop';

            

            // Set correct hint based on input type

            if (input.id === 'passportPhoto') {

                uploadHint.textContent = 'PNG, JPG up to 10MB';

            } else {

                uploadHint.textContent = 'PNG, JPG, PDF up to 20MB';

            }

            

            preview.style.color = '';

        });

    }

    

    showToast(message, type = 'info') {

        // Remove existing toast

        const existingToast = document.querySelector('.toast');

        if (existingToast) {

            existingToast.remove();

        }

        

        // Create toast element

        const toast = document.createElement('div');

        toast.className = `toast toast-${type}`;

        toast.innerHTML = `

            <div class="toast-content">

                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>

                <span>${message}</span>

            </div>

        `;

        

        // Add to document

        document.body.appendChild(toast);

        

        // Trigger animation

        setTimeout(() => {

            toast.classList.add('show');

        }, 100);

        

        // Auto remove after 3 seconds

        setTimeout(() => {

            toast.classList.remove('show');

            setTimeout(() => {

                if (toast.parentNode) {

                    toast.parentNode.removeChild(toast);

                }

            }, 300);

        }, 3000);

    }

    

    showError(message) {

        this.showToast(message, 'error');

        console.error('❌ Error:', message);

    }

    

    showSuccess(message) {

        this.showToast(message, 'success');

        console.log('✅ Success:', message);

    }

    

    showMessage(message, type) {

        // Remove any existing toast notifications first

        const existingToasts = document.querySelectorAll('[data-toast]');

        existingToasts.forEach(toast => toast.remove());

        

        // Create professional toast notification

        const toast = document.createElement('div');

        toast.setAttribute('data-toast', 'true');

        toast.style.cssText = `

            position: fixed;

            top: 20px;

            right: 20px;

            padding: 15px 25px;

            border-radius: 10px;

            z-index: 9999;

            font-weight: 500;

            font-size: 16px;

            box-shadow: 0 4px 15px rgba(0,0,0,0.2);

            transform: translateX(100%);

            transition: transform 0.3s ease;

            max-width: 400px;

        `;

        

        // Set colors based on type

        if (type === 'error') {

            toast.style.background = 'linear-gradient(135deg, #D62828 0%, #EF4444 100%)';

            toast.style.color = 'white';

        } else if (type === 'success') {

            toast.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';

            toast.style.color = 'white';

        } else {

            toast.style.background = 'linear-gradient(135deg, #ffcc00 0%, #FFD60A 100%)';

            toast.style.color = '#222222';

        }

        

        toast.textContent = message;

        document.body.appendChild(toast);

        

        // Animate in

        setTimeout(() => {

            toast.style.transform = 'translateX(0)';

        }, 100);

        

        // Auto-remove after 8 seconds

        setTimeout(() => {

            toast.style.transform = 'translateX(100%)';

            setTimeout(() => {

                document.body.removeChild(toast);

            }, 300);

        }, 8000);

    }

}



// Initialize the application

document.addEventListener('DOMContentLoaded', function() {

    const app = new RiderApplicationForm();

    

    // Make file management functions globally accessible

    window.viewFile = (inputId) => app.viewFile(inputId);

    window.exportFile = (inputId) => app.exportFile(inputId);

    window.removeFile = (inputId) => app.removeFile(inputId);

    

    // Initialize the form

    app.initializeElements();

    app.attachEventListeners();

    app.showStep(1);

    app.updateProgressBar();

    app.updateNavigationButtons();

});



// ... (rest of the code remains the same)



const utils = {

    // Format phone number as user types (allow international formats)

    formatPhoneNumber(input) {

        // Remove all non-digit characters except + for international numbers

        let value = input.value.replace(/[^\d+]/g, '');

        

        // Don't limit length for international numbers

        // Just ensure it starts with + if it's an international number

        if (value.startsWith('+')) {

            // International number - keep as is

            input.value = value;

        } else {

            // Local number - just digits

            input.value = value;

        }

    },

    

    // Format plate number as user types

    formatPlateNumber(input) {

        let value = input.value.toUpperCase();

        // Add hyphens automatically

        if (value.length === 2) value += '-';

        if (value.length === 6) value += '-';

        input.value = value;

    },

    

    // Get country name from code

    getCountryName(code) {

        const countries = {

            '+233': 'Ghana',

            '+234': 'Nigeria',

            '+254': 'Kenya',

            '+255': 'Tanzania',

            '+256': 'Uganda',

            '+258': 'Mozambique',

            '+260': 'Zambia',

            '+263': 'Zimbabwe',

            '+264': 'Namibia',

            '+265': 'Malawi',

            '+266': 'Lesotho',

            '+267': 'Botswana',

            '+268': 'Eswatini',

            '+27': 'South Africa',

            '+211': 'South Sudan',

            '+212': 'Morocco',

            '+213': 'Algeria',

            '+216': 'Tunisia',

            '+218': 'Libya',

            '+220': 'Gambia',

            '+221': 'Senegal',

            '+222': 'Mauritania',

            '+223': 'Mali',

            '+224': 'Guinea',

            '+225': 'Côte d\'Ivoire',

            '+226': 'Burkina Faso',

            '+227': 'Niger',

            '+228': 'Togo',

            '+229': 'Benin',

            '+230': 'Mauritius',

            '+231': 'Liberia',

            '+232': 'Sierra Leone',

            '+237': 'Cameroon',

            '+238': 'Cape Verde',

            '+239': 'São Tomé & Príncipe',

            '+240': 'Equatorial Guinea',

            '+241': 'Gabon',

            '+242': 'Republic of the Congo',

            '+243': 'Democratic Republic of the Congo',

            '+244': 'Angola',

            '+245': 'Guinea-Bissau',

            '+246': 'Mayotte',

            '+247': 'Ascension Island',

            '+248': 'Seychelles',

            '+249': 'Sudan',

            '+250': 'Rwanda',

            '+251': 'Ethiopia',

            '+252': 'Somalia',

            '+253': 'Djibouti',

            '+254': 'Kenya',

            '+257': 'Burundi',

            '+258': 'Mozambique',

            '+259': 'Madagascar',

            '+290': 'Saint Helena',

            '+291': 'Eritrea',

            '+297': 'Aruba',

            '+298': 'Faroe Islands',

            '+299': 'Greenland',

            '+350': 'Gibraltar',

            '+351': 'Portugal',

            '+352': 'Luxembourg',

            '+353': 'Ireland',

            '+354': 'Iceland',

            '+355': 'Albania',

            '+356': 'Malta',

            '+357': 'Cyprus',

            '+358': 'Finland',

            '+359': 'Bulgaria',

            '+36': 'Hungary',

            '+371': 'Latvia',

            '+372': 'Estonia',

            '+373': 'Moldova',

            '+374': 'Armenia',

            '+375': 'Belarus',

            '+376': 'Andorra',

            '+377': 'Monaco',

            '+378': 'San Marino',

            '+380': 'Ukraine',

            '+381': 'Serbia',

            '+382': 'Montenegro',

            '+383': 'Kosovo',

            '+385': 'Croatia',

            '+386': 'Slovenia',

            '+387': 'Bosnia & Herzegovina',

            '+389': 'North Macedonia',

            '+39': 'Italy',

            '+40': 'Romania',

            '+41': 'Switzerland',

            '+43': 'Austria',

            '+44': 'United Kingdom',

            '+45': 'Denmark',

            '+46': 'Sweden',

            '+47': 'Norway',

            '+48': 'Poland',

            '+49': 'Germany'

        };

        return countries[code] || 'Unknown';

    }

};



// Add formatting listeners

document.addEventListener('DOMContentLoaded', () => {

    const phoneInput = document.getElementById('phone');

    if (phoneInput) {

        phoneInput.addEventListener('input', () => utils.formatPhoneNumber(phoneInput));

    }

    

    const plateInput = document.getElementById('plateNumber');

    if (plateInput) {

        plateInput.addEventListener('input', () => utils.formatPlateNumber(plateInput));

    }

});

