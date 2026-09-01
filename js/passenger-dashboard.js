// K3K3 Passenger Dashboard - Professional JavaScript

// Global Variables
let isMenuOpen = false;
let currentRideStatus = null;
let selectedSeats = 0;
let userLocation = null;

// Navigation Functions
function goToCancellations() {
    window.location.href = 'cancellations.html';
}

function goToRideHistory() {
    window.location.href = 'ride-history.html';
}

function goToRideStatus() {
    window.location.href = 'ride-status.html';
}

function goToProfile() {
    window.location.href = 'profile.html';
}

function handleLogout() {
    showLogoutConfirmationToast();
}

// Toggle Main Menu
function toggleMainMenu() {
    const menu = document.getElementById('mainDropdownMenu');
    const hamburger = document.querySelector('.hamburger-menu');
    
    const isMenuOpen = menu.classList.contains('active');
    
    if (!isMenuOpen) {
        menu.classList.add('active');
        hamburger.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        menu.classList.remove('active');
        hamburger.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close Main Menu
function closeMainMenu() {
    const menu = document.getElementById('mainDropdownMenu');
    const hamburger = document.querySelector('.hamburger-menu');
    
    menu.classList.remove('active');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
}

// Placeholder functions for menu items
function showPaymentMethods() {
    closeMainMenu();
    alert('Payment Methods - Feature coming soon!');
}

function showNotifications() {
    closeMainMenu();
    alert('Notifications - Feature coming soon!');
}

function showSupport() {
    closeMainMenu();
    alert('Support - Feature coming soon!');
}

function showSettings() {
    closeMainMenu();
    alert('Settings - Feature coming soon!');
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Authentication check disabled - dashboard now accessible without login
    // checkAuthentication();
    
    initializeDashboard();
    setupEventListeners();
    loadUserProfile();
    checkRideStatus();
    
    // Check and request location permission on dashboard load
    checkLocationPermissionOnLoad();
});

// Check User Authentication - DISABLED
function checkAuthentication() {
    // Authentication disabled - always allow access
    console.log('Authentication check bypassed - dashboard accessible without login');
    return true;
    
    // Original authentication code (now disabled):
    /*
    const token = localStorage.getItem('k3k3_token');
    const user = localStorage.getItem('k3k3_user');
    
    if (!token || !user) {
        // User not authenticated - redirect to login
        showNotification('Please login to access the dashboard', 'warning');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1500);
        return false;
    }
    
    return true;
    */
}

// Initialize Dashboard
function initializeDashboard() {
    console.log('K3K3 Passenger Dashboard Initialized');
    
    // Authentication check disabled - dashboard accessible without login
    // Ready for backend integration with optional authentication
    
    // Load user data
    loadUserData();
    
    // Initialize map
    initializeMap();
    
    // Check for active ride
    checkActiveRide();
}

// Setup Event Listeners
function setupEventListeners() {
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        const menu = document.getElementById('mainDropdownMenu');
        const hamburger = document.querySelector('.hamburger-menu');
        
        if (!menu.contains(e.target) && !hamburger.contains(e.target)) {
            closeMainMenu();
        }
    });
    
    // Handle escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeMainMenu();
            closeLocationPicker();
            closeAddDestinationDialog();
        }
    });
    
    // Handle location inputs
    const pickupInput = document.getElementById('pickupInput');
    const destinationInput = document.getElementById('destinationInput');
    
    if (pickupInput) {
        pickupInput.addEventListener('input', () => handleLocationInput('pickup'));
        pickupInput.addEventListener('focus', () => showLocationSuggestions('pickup'));
        pickupInput.addEventListener('blur', () => hideLocationSuggestions('pickup'));
    }
    
    if (destinationInput) {
        destinationInput.addEventListener('input', () => handleLocationInput('destination'));
        destinationInput.addEventListener('focus', () => showLocationSuggestions('destination'));
        destinationInput.addEventListener('blur', () => hideLocationSuggestions('destination'));
    }
}

// Toggle Main Menu
function toggleMainMenu() {
    const menu = document.getElementById('mainDropdownMenu');
    const hamburger = document.querySelector('.hamburger-menu');
    
    isMenuOpen = !isMenuOpen;
    
    if (isMenuOpen) {
        menu.classList.add('active');
        hamburger.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        closeMainMenu();
    }
}

// Close Main Menu
function closeMainMenu() {
    const menu = document.getElementById('mainDropdownMenu');
    const hamburger = document.querySelector('.hamburger-menu');
    
    menu.classList.remove('active');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
    isMenuOpen = false;
}

// Show Section
function showSection(sectionName) {
    console.log('Navigating to section:', sectionName);
    closeMainMenu();
    
    // Here you would typically show/hide different sections
    // For now, we'll just show a notification
    showNotification(`Navigating to ${sectionName}`, 'info');
    
    // Update active menu item
    updateActiveMenuItem(sectionName);
}

// Update Active Menu Item
function updateActiveMenuItem(sectionName) {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(sectionName)) {
            item.classList.add('active');
        }
    });
}

// Go to Profile
function goToProfile() {
    closeMainMenu();
    window.location.href = 'profile.html';
}

// Show Payment Methods
function showPaymentMethods() {
    closeMainMenu();
    showNotification('Opening payment methods...', 'info');
    // Implement payment methods modal or redirect
}

// Show Notifications
function showNotifications() {
    closeMainMenu();
    showNotification('Opening notifications...', 'info');
    // Implement notifications modal
}

// Show Support
function showSupport() {
    closeMainMenu();
    showNotification('Opening support center...', 'info');
    // Implement support modal or redirect
}

// Show Settings
function showSettings() {
    closeMainMenu();
    
    // Load saved settings
    loadSettingsData();
    
    // Show settings modal
    const modal = document.getElementById('settingsModal');
    modal.classList.add('show');
}

// Close Settings
function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
}

// Load Settings Data
function loadSettingsData() {
    // Load saved preferences
    const defaultSeats = localStorage.getItem('k3k3_default_seats') || '1';
    const preferredPayment = localStorage.getItem('k3k3_preferred_payment') || 'cash';
    const pushNotifications = localStorage.getItem('k3k3_push_notifications') === 'true';
    const smsNotifications = localStorage.getItem('k3k3_sms_notifications') === 'true';
    const emailNotifications = localStorage.getItem('k3k3_email_notifications') === 'true';
    const locationServices = localStorage.getItem('k3k3_location_services') !== 'false';
    const shareTripData = localStorage.getItem('k3k3_share_trip_data') !== 'false';
    const twoFactorAuth = localStorage.getItem('k3k3_two_factor_auth') === 'true';
    
    // Update UI
    document.getElementById('defaultSeats').value = defaultSeats;
    document.getElementById('preferredPayment').value = preferredPayment;
    document.getElementById('pushNotifications').checked = pushNotifications;
    document.getElementById('smsNotifications').checked = smsNotifications;
    document.getElementById('emailNotifications').checked = emailNotifications;
    document.getElementById('locationServices').checked = locationServices;
    document.getElementById('shareTripData').checked = shareTripData;
    document.getElementById('twoFactorAuth').checked = twoFactorAuth;
}

// Settings Functions
function editProfile() {
    showNotification('Opening profile editor...', 'info');
    // TODO: Implement profile editing modal
}

function changePassword() {
    showNotification('Opening password change...', 'info');
    // TODO: Implement password change modal
}

function updateDefaultSeats() {
    const value = document.getElementById('defaultSeats').value;
    localStorage.setItem('k3k3_default_seats', value);
    showNotification('Default seats updated', 'success');
}

function updatePreferredPayment() {
    const value = document.getElementById('preferredPayment').value;
    localStorage.setItem('k3k3_preferred_payment', value);
    showNotification('Preferred payment updated', 'success');
}

function manageFavorites() {
    showNotification('Opening favorite destinations...', 'info');
    // TODO: Implement favorites management
}

function togglePushNotifications() {
    const checked = document.getElementById('pushNotifications').checked;
    localStorage.setItem('k3k3_push_notifications', checked);
    showNotification(checked ? 'Push notifications enabled' : 'Push notifications disabled', 'success');
}

function toggleSMSNotifications() {
    const checked = document.getElementById('smsNotifications').checked;
    localStorage.setItem('k3k3_sms_notifications', checked);
    showNotification(checked ? 'SMS notifications enabled' : 'SMS notifications disabled', 'success');
}

function toggleEmailNotifications() {
    const checked = document.getElementById('emailNotifications').checked;
    localStorage.setItem('k3k3_email_notifications', checked);
    showNotification(checked ? 'Email notifications enabled' : 'Email notifications disabled', 'success');
}

function toggleLocationServices() {
    const checked = document.getElementById('locationServices').checked;
    localStorage.setItem('k3k3_location_services', checked);
    if (checked) {
        enableLocationTracking();
        showNotification('Location services enabled', 'success');
    } else {
        showNotification('Location services disabled', 'info');
    }
}

function toggleShareTripData() {
    const checked = document.getElementById('shareTripData').checked;
    localStorage.setItem('k3k3_share_trip_data', checked);
    showNotification(checked ? 'Trip sharing enabled' : 'Trip sharing disabled', 'success');
}

function toggleTwoFactorAuth() {
    const checked = document.getElementById('twoFactorAuth').checked;
    localStorage.setItem('k3k3_two_factor_auth', checked);
    if (checked) {
        showNotification('Two-factor authentication enabled', 'success');
        // TODO: Implement 2FA setup
    } else {
        showNotification('Two-factor authentication disabled', 'info');
    }
}

function openHelpCenter() {
    showNotification('Opening help center...', 'info');
    // TODO: Implement help center
}

function showAbout() {
    showNotification('K3K3 Version 1.0.0 - © 2024 K3K3 Transport', 'info');
}

function clearCache() {
    if (confirm('Are you sure you want to clear all cached data? This will remove your preferences and saved locations.')) {
        // Clear all K3K3 localStorage data
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('k3k3_')) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        showNotification('Cache cleared successfully', 'success');
        closeSettings();
        
        // Reload page to reset to defaults
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }
}

function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        if (confirm('This will permanently delete all your data. Are you absolutely sure?')) {
            showNotification('Account deletion requested', 'info');
            // TODO: Implement actual account deletion API call
            closeSettings();
        }
    }
}

// Handle Logout
function handleLogout() {
    closeMainMenu();
    showLogoutConfirmationToast();
}

// Professional Logout Confirmation Toast
function showLogoutConfirmationToast() {
    // Remove existing logout toast if any
    const existing = document.getElementById('k3k3-logout-toast');
    if (existing) existing.remove();

    const user = JSON.parse(localStorage.getItem('k3k3_user') || '{}');
    const userName = user.name || user.fname || 'User';

    const toast = document.createElement('div');
    toast.id = 'k3k3-logout-toast';
    toast.innerHTML = `
        <div style="
            position: fixed; bottom: 32px; right: 32px; z-index: 99999;
            background: #ffffff; border-radius: 16px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
            padding: 20px 24px; min-width: 320px; max-width: 380px;
            border-left: 4px solid #EF4444;
            animation: k3k3ToastSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
            font-family: 'Inter', 'Segoe UI', sans-serif;
        ">
            <div style="display:flex; align-items:flex-start; gap:14px;">
                <div style="
                    width:42px; height:42px; border-radius:50%; flex-shrink:0;
                    background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
                    display:flex; align-items:center; justify-content:center;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </div>
                <div style="flex:1; min-width:0;">
                    <p style="margin:0 0 2px; font-weight:700; font-size:15px; color:#111827; letter-spacing:-0.01em;">Sign Out of K3K3?</p>
                    <p style="margin:0 0 16px; font-size:13px; color:#6B7280; line-height:1.5;">You're about to sign out, <strong>${userName}</strong>. Your session will be securely ended.</p>
                    <div style="display:flex; gap:10px;">
                        <button onclick="confirmLogout()" style="
                            flex:1; padding:10px 0; border:none; border-radius:10px; cursor:pointer;
                            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
                            color:#fff; font-weight:600; font-size:13px; letter-spacing:0.01em;
                            box-shadow: 0 2px 8px rgba(239,68,68,0.3);
                            transition: opacity 0.2s;
                        " onmouseover="this.style.opacity=0.88" onmouseout="this.style.opacity=1">
                            Yes, Sign Out
                        </button>
                        <button onclick="cancelLogout()" style="
                            flex:1; padding:10px 0; border: 1.5px solid #E5E7EB; border-radius:10px; cursor:pointer;
                            background: #F9FAFB; color:#374151; font-weight:600; font-size:13px;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='#F9FAFB'">
                            Stay Logged In
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <style>
            @keyframes k3k3ToastSlideIn {
                from { opacity:0; transform: translateY(20px) scale(0.95); }
                to   { opacity:1; transform: translateY(0) scale(1); }
            }
            @keyframes k3k3ToastSlideOut {
                from { opacity:1; transform: translateY(0) scale(1); }
                to   { opacity:0; transform: translateY(20px) scale(0.95); }
            }
        </style>
    `;
    document.body.appendChild(toast);
}

function confirmLogout() {
    const toast = document.getElementById('k3k3-logout-toast');
    if (toast) {
        const inner = toast.querySelector('div');
        if (inner) inner.style.animation = 'k3k3ToastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 320);
    }
    const user = JSON.parse(localStorage.getItem('k3k3_user') || '{}');
    const userName = user.name || user.fname || 'User';
    localStorage.removeItem('k3k3_user');
    localStorage.removeItem('k3k3_token');
    localStorage.removeItem('k3k3_user_type');
    showNotification(`Goodbye, ${userName}! You have been securely signed out.`, 'success');
    setTimeout(() => { window.location.href = '../index.html'; }, 1600);
}

function cancelLogout() {
    const toast = document.getElementById('k3k3-logout-toast');
    if (toast) {
        const inner = toast.querySelector('div');
        if (inner) inner.style.animation = 'k3k3ToastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 320);
    }
}

// Toggle Destination Dropdown
function toggleDestinationDropdown() {
    const dropdown = document.getElementById('destinationDropdown');
    const icon = document.getElementById('dropdownIcon');
    
    dropdown.classList.toggle('active');
    
    if (dropdown.classList.contains('active')) {
        icon.style.transform = 'rotate(180deg)';
    } else {
        icon.style.transform = 'rotate(0deg)';
    }
}

// Select Quick Destination
function selectQuickDestination(destination) {
    const destinationInput = document.getElementById('destinationInput');
    const destinations = {
        'cedi': 'Cedi Auditorium, Ho',
        'sokode': 'Sokode Hostel, Ho',
        'mirage': 'Mirage, Ho',
        'godokpe': 'Godokpe, Ho',
        'trafalgar': 'Trafalgar, Ho',
        'htu': 'HTU Main Campus, Ho',
        'dave': 'Dave Cafe, Ho'
    };
    
    if (destinationInput && destinations[destination]) {
        destinationInput.value = destinations[destination];
        showNotification(`Destination set to ${destinations[destination]}`, 'success');
    }
    
    toggleDestinationDropdown();
}

// Show Add Destination Dialog
function showAddDestinationDialog() {
    const dialog = document.getElementById('addDestinationPopup');
    if (dialog) {
        dialog.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Close Add Destination Dialog
function closeAddDestinationDialog() {
    const dialog = document.getElementById('addDestinationPopup');
    if (dialog) {
        dialog.style.display = 'none';
        document.body.style.overflow = '';
        
        // Clear form
        document.getElementById('newDestinationName').value = '';
        document.getElementById('newDestinationAddress').value = '';
        document.getElementById('newDestinationType').value = 'home';
    }
}

// Save New Destination
function saveNewDestination() {
    const name = document.getElementById('newDestinationName').value.trim();
    const address = document.getElementById('newDestinationAddress').value.trim();
    const type = document.getElementById('newDestinationType').value;
    
    if (!name || !address) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    // Save to localStorage (in a real app, this would be saved to a database)
    const destinations = JSON.parse(localStorage.getItem('k3k3_destinations') || '[]');
    destinations.push({ name, address, type, id: Date.now() });
    localStorage.setItem('k3k3_destinations', JSON.stringify(destinations));
    
    showNotification('Destination saved successfully!', 'success');
    closeAddDestinationDialog();
}

// Handle Location Input
async function handleLocationInput(type) {
    const input = document.getElementById(type === 'pickup' ? 'pickupInput' : 'destinationInput');
    const suggestions = document.getElementById(type === 'pickup' ? 'pickupSuggestions' : 'destinationSuggestions');
    
    if (input.value.length < 2) {
        suggestions.style.display = 'none';
        return;
    }
    
    // Search locations using backend API (remove mock data)
    try {
        const response = await fetch('/api/locations/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('k3k3_token')}`
            },
            body: JSON.stringify({ query: input.value })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayLocationSuggestions(data.locations, type);
        } else {
            console.error('Location search failed');
        }
    } catch (error) {
        console.error('Location search error:', error);
        // Fallback to empty suggestions
        displayLocationSuggestions([], type);
    }
}

// Display Location Suggestions
function displayLocationSuggestions(locations, type) {
    const suggestions = document.getElementById(type === 'pickup' ? 'pickupSuggestions' : 'destinationSuggestions');
    
    if (locations.length === 0) {
        suggestions.style.display = 'none';
        return;
    }
    
    suggestions.innerHTML = locations.map(loc => `
        <div class="suggestion-item" onclick="selectSuggestion('${loc}', '${type}')">
            <i class="fas fa-map-marker-alt"></i>
            <span>${loc}</span>
        </div>
    `).join('');
    
    suggestions.style.display = 'block';
}

// Select Suggestion
function selectSuggestion(location, type) {
    const input = document.getElementById(type === 'pickup' ? 'pickupInput' : 'destinationInput');
    input.value = location;
    hideLocationSuggestions(type);
}

// Show Location Suggestions
function showLocationSuggestions(type) {
    const input = document.getElementById(type === 'pickup' ? 'pickupInput' : 'destinationInput');
    if (input.value.length >= 2) {
        handleLocationInput(type);
    }
}

// Hide Location Suggestions
function hideLocationSuggestions(type) {
    setTimeout(() => {
        const suggestions = document.getElementById(type === 'pickup' ? 'pickupSuggestions' : 'destinationSuggestions');
        suggestions.style.display = 'none';
    }, 200);
}

// Get Current Location for Pickup
function getCurrentLocationForPickup() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    showNotification('Getting your location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            // In a real app, you would reverse geocode this to get the address
            const pickupInput = document.getElementById('pickupInput');
            pickupInput.value = 'Current Location';
            
            showNotification('Location found!', 'success');
        },
        (error) => {
            showNotification('Unable to get your location', 'error');
        }
    );
}

// Open Location Picker
function openLocationPicker(type) {
    const popup = document.getElementById('locationPickerPopup');
    if (popup) {
        popup.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Close Location Picker
function closeLocationPicker() {
    const popup = document.getElementById('locationPickerPopup');
    if (popup) {
        popup.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Select Location
function selectLocation(location, type) {
    const input = document.getElementById(type === 'pickup' ? 'pickupInput' : 'destinationInput');
    input.value = location;
    closeLocationPicker();
}

// Handle Search Keypress
function handleSearchKeypress(event) {
    if (event.key === 'Enter') {
        executeSearch();
    }
}

// Execute Search
function executeSearch() {
    const searchInput = document.getElementById('locationSearchInput');
    const query = searchInput.value.trim();
    
    if (!query) {
        showNotification('Please enter a location to search', 'error');
        return;
    }
    
    showNotification(`Searching for "${query}"...`, 'info');
    // Implement search functionality
}

// Select Seats
function selectSeats(num) {
    selectedSeats = num;
    
    // Update UI
    const seatOptions = document.querySelectorAll('.seat-option');
    seatOptions.forEach(option => {
        option.classList.remove('selected');
        if (parseInt(option.dataset.seats) === num) {
            option.classList.add('selected');
        }
    });
    
    showNotification(`${num} seat${num > 1 ? 's' : ''} selected`, 'success');
}

// Request Ride
async function requestRide() {
    const pickup = document.getElementById('pickupInput').value.trim();
    const destination = document.getElementById('destinationInput').value.trim();
    
    if (!pickup || !destination) {
        showNotification('Please enter pickup and destination', 'error');
        return;
    }
    
    if (selectedSeats === 0) {
        showNotification('Please select number of seats', 'error');
        return;
    }
    
    // Create ride request for backend
    const rideRequest = {
        pickup: pickup,
        destination: destination,
        seats: selectedSeats,
        passengerId: JSON.parse(localStorage.getItem('k3k3_user')).id,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Show loading state
        const requestBtn = document.querySelector('button[onclick="requestRide()"]');
        if (requestBtn) {
            requestBtn.disabled = true;
            requestBtn.textContent = 'Requesting...';
        }
        
        // Send ride request to backend
        const response = await fetch('/api/rides/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('k3k3_token')}`
            },
            body: JSON.stringify(rideRequest)
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Ride request submitted successfully!', 'success');
            
            // Store active ride
            localStorage.setItem('k3k3_active_ride', JSON.stringify(data.ride));
            
            // Redirect to ride status after delay
            setTimeout(() => {
                window.location.href = '#ride-status';
                showSection('ride-status');
            }, 2000);
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Failed to request ride', 'error');
        }
    } catch (error) {
        console.error('Ride request error:', error);
        showNotification('Network error. Please try again.', 'error');
    } finally {
        // Restore button state
        const requestBtn = document.querySelector('button[onclick="requestRide()"]');
        if (requestBtn) {
            requestBtn.disabled = false;
            requestBtn.textContent = 'Request Ride';
        }
    }
}

// Show Ride Confirmation Modal
function showRideConfirmationModal(rideData) {
    // Create modal HTML
    const modalHTML = `
        <div class="ride-confirmation-modal" id="rideConfirmationModal">
            <div class="confirmation-content">
                <div class="confirmation-header">
                    <h3>Confirm Your Ride</h3>
                    <button class="close-modal" onclick="closeConfirmationModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="ride-details">
                    <div class="route-info">
                        <div class="route-point">
                            <div class="point-icon">
                                <i class="fas fa-circle"></i>
                            </div>
                            <div class="point-info">
                                <span class="point-label">Pickup</span>
                                <span class="point-address">${rideData.pickup}</span>
                            </div>
                        </div>
                        
                        <div class="route-line"></div>
                        
                        <div class="route-point">
                            <div class="point-icon">
                                <i class="fas fa-map-marker-alt"></i>
                            </div>
                            <div class="point-info">
                                <span class="point-label">Destination</span>
                                <span class="point-address">${rideData.destination}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ride-summary">
                        <div class="summary-item">
                            <span class="label">Seats</span>
                            <span class="value">${rideData.seats} ${rideData.seats === 1 ? 'seat' : 'seats'}</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">Estimated Fare</span>
                            <span class="value">₵${rideData.fare}</span>
                        </div>
                        <div class="summary-item payment-selection">
                            <span class="label">Payment Method</span>
                            <div class="payment-options">
                                <label class="payment-option">
                                    <input type="radio" name="payment" value="cash" checked>
                                    <span class="payment-radio"></span>
                                    <div class="payment-info">
                                        <span class="payment-name">Cash</span>
                                        <span class="payment-detail">Pay driver directly</span>
                                    </div>
                                </label>
                                <label class="payment-option">
                                    <input type="radio" name="payment" value="mobile_money">
                                    <span class="payment-radio"></span>
                                    <div class="payment-info">
                                        <span class="payment-name">Mobile Money</span>
                                        <span class="payment-detail">MTN, Vodafone, AirtelTigo</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="confirmation-actions">
                    <button class="cancel-btn" onclick="closeConfirmationModal()">Cancel</button>
                    <button class="confirm-btn" onclick="confirmRide()">Confirm Ride</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add modal styles
    const modalStyles = `
        <style>
            .ride-confirmation-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: flex-end;
                justify-content: center;
                animation: fadeInModal 0.3s ease;
            }
            
            @keyframes fadeInModal {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .confirmation-content {
                background: white;
                border-radius: 24px 24px 0 0;
                width: 100%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                transform: translateY(100%);
                animation: slideUpModal 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            
            @keyframes slideUpModal {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            
            .confirmation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 24px 24px 16px;
                border-bottom: 1px solid #f3f4f6;
            }
            
            .confirmation-header h3 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #000;
            }
            
            .close-modal {
                width: 32px;
                height: 32px;
                border: none;
                background: #f3f4f6;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }
            
            .close-modal:hover {
                background: #e5e7eb;
            }
            
            .ride-details {
                padding: 24px;
            }
            
            .route-info {
                margin-bottom: 24px;
            }
            
            .route-point {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-bottom: 8px;
            }
            
            .point-icon {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            
            .point-icon i:first-child {
                color: #10b981;
                font-size: 12px;
            }
            
            .point-icon i:last-child {
                color: #ef4444;
                font-size: 16px;
            }
            
            .point-info {
                flex: 1;
            }
            
            .point-label {
                font-size: 12px;
                color: #6b7280;
                display: block;
                margin-bottom: 4px;
            }
            
            .point-address {
                font-size: 16px;
                font-weight: 500;
                color: #000;
                display: block;
            }
            
            .route-line {
                width: 2px;
                height: 20px;
                background: #e5e7eb;
                margin-left: 11px;
                margin-bottom: 8px;
            }
            
            .ride-summary {
                background: #f9fafb;
                border-radius: 12px;
                padding: 16px;
            }
            
            .summary-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
            }
            
            .summary-item:not(:last-child) {
                border-bottom: 1px solid #e5e7eb;
            }
            
            .summary-item .label {
                font-size: 14px;
                color: #6b7280;
            }
            
            .summary-item .value {
                font-size: 14px;
                font-weight: 600;
                color: #000;
            }
            
            .summary-item.payment-selection {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            }
            
            .payment-options {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .payment-option {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .payment-option:hover {
                border-color: #d1d5db;
                background: #f9fafb;
            }
            
            .payment-option input[type="radio"] {
                display: none;
            }
            
            .payment-radio {
                width: 20px;
                height: 20px;
                border: 2px solid #d1d5db;
                border-radius: 50%;
                position: relative;
                transition: all 0.3s ease;
            }
            
            .payment-option input[type="radio"]:checked + .payment-radio {
                border-color: #FFD60A;
                background: #FFD60A;
            }
            
            .payment-option input[type="radio"]:checked + .payment-radio::after {
                content: '';
                width: 8px;
                height: 8px;
                background: #000;
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .payment-option input[type="radio"]:checked ~ .payment-info {
                color: #000;
            }
            
            .payment-info {
                flex: 1;
            }
            
            .payment-name {
                font-size: 14px;
                font-weight: 600;
                color: #000;
                display: block;
                margin-bottom: 2px;
            }
            
            .payment-detail {
                font-size: 12px;
                color: #6b7280;
            }
            
            .confirmation-actions {
                display: flex;
                gap: 12px;
                padding: 24px;
                border-top: 1px solid #f3f4f6;
            }
            
            .cancel-btn, .confirm-btn {
                flex: 1;
                padding: 16px;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .cancel-btn {
                background: #f3f4f6;
                color: #6b7280;
            }
            
            .cancel-btn:hover {
                background: #e5e7eb;
            }
            
            .confirm-btn {
                background: #000;
                color: white;
            }
            
            .confirm-btn:hover {
                background: #333;
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', modalStyles);
}

// Close Confirmation Modal
function closeConfirmationModal() {
    const modal = document.getElementById('rideConfirmationModal');
    if (modal) {
        modal.remove();
    }
}

// Confirm Ride
function confirmRide() {
    // Get selected payment method
    const selectedPayment = document.querySelector('input[name="payment"]:checked');
    const paymentMethod = selectedPayment ? selectedPayment.value : 'cash';
    
    // Get ride data and add payment method
    const rideData = JSON.parse(localStorage.getItem('k3k3_pending_ride'));
    rideData.paymentMethod = paymentMethod;
    
    // Save updated ride data
    localStorage.setItem('k3k3_pending_ride', JSON.stringify(rideData));
    
    closeConfirmationModal();
    startRideSearch();
}

// Start Ride Search with Dotted Loading
function startRideSearch() {
    const rideData = JSON.parse(localStorage.getItem('k3k3_pending_ride'));
    
    // Update ride status
    rideData.status = 'searching';
    localStorage.setItem('k3k3_current_ride', JSON.stringify(rideData));
    
    // Update dashboard status
    updateRideStatus(rideData);
    
    // Show dotted loading modal
    showRideSearchModal();
    
    // Enable share trip button
    const shareTripBtn = document.getElementById('shareTripBtn');
    if (shareTripBtn) {
        shareTripBtn.disabled = false;
    }
    
    // Simulate driver finding after delay
    setTimeout(() => {
        // Close search modal
        closeRideSearchModal();
        
        // Show searching for rider interface instead of driver details
        showSearchingForRiderInterface();
        
        // Update status display
        updateRideStatus(rideData);
        
        // Show simple notification without driver details
        showNotification('Searching for rider...', 'info');
        
        // Update request button
        const requestBtn = document.getElementById('requestBtn');
        requestBtn.disabled = false;
        requestBtn.innerHTML = '<i class="fas fa-check"></i> <span>Ride Active</span>';
        
    }, 3000);
}

// Show Ride Search Modal with Dotted Loading
function showRideSearchModal() {
    const modalHTML = `
        <div class="ride-search-modal" id="rideSearchModal">
            <div class="search-content">
                <div class="search-animation">
                    <div class="dotted-circle">
                        <div class="dot dot-1"></div>
                        <div class="dot dot-2"></div>
                        <div class="dot dot-3"></div>
                        <div class="dot dot-4"></div>
                        <div class="dot dot-5"></div>
                        <div class="dot dot-6"></div>
                        <div class="dot dot-7"></div>
                        <div class="dot dot-8"></div>
                    </div>
                    <div class="search-text">
                        <h3>Looking for riders</h3>
                        <p>Finding the best driver for you...</p>
                    </div>
                </div>
                
                <div class="search-tips">
                    <div class="tip-item">
                        <i class="fas fa-check-circle"></i>
                        <span>We're finding nearby available drivers</span>
                    </div>
                    <div class="tip-item">
                        <i class="fas fa-clock"></i>
                        <span>This usually takes less than 30 seconds</span>
                    </div>
                    <div class="tip-item">
                        <i class="fas fa-shield-alt"></i>
                        <span>All drivers are verified and rated</span>
                    </div>
                </div>
                
                <button class="cancel-search-btn" onclick="cancelRideSearch()">Cancel Search</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add search modal styles
    const searchStyles = `
        <style>
            .ride-search-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeInSearch 0.3s ease;
            }
            
            @keyframes fadeInSearch {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .search-content {
                background: white;
                border-radius: 24px;
                padding: 40px;
                width: 90%;
                max-width: 400px;
                text-align: center;
                animation: scaleInSearch 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            @keyframes scaleInSearch {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            
            .search-animation {
                margin-bottom: 32px;
            }
            
            .dotted-circle {
                width: 120px;
                height: 120px;
                margin: 0 auto 24px;
                position: relative;
                animation: rotateCircle 2s linear infinite;
            }
            
            @keyframes rotateCircle {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .dot {
                width: 12px;
                height: 12px;
                background: #FFD60A;
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform-origin: -60px center;
            }
            
            .dot-1 { transform: translate(-50%, -50%) rotate(0deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite; }
            .dot-2 { transform: translate(-50%, -50%) rotate(45deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite 0.2s; }
            .dot-3 { transform: translate(-50%, -50%) rotate(90deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite 0.4s; }
            .dot-4 { transform: translate(-50%, -50%) rotate(135deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite 0.6s; }
            .dot-5 { transform: translate(-50%, -50%) rotate(180deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite 0.8s; }
            .dot-6 { transform: translate(-50%, -50%) rotate(225deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite 1s; }
            .dot-7 { transform: translate(-50%, -50%) rotate(270deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite 1.2s; }
            .dot-8 { transform: translate(-50%, -50%) rotate(315deg) translateX(60px); animation: dotPulse 1.5s ease-in-out infinite 1.4s; }
            
            @keyframes dotPulse {
                0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(60px) scale(0.8); }
                50% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(60px) scale(1.2); }
            }
            
            .search-text h3 {
                margin: 0 0 8px;
                font-size: 24px;
                font-weight: 600;
                color: #000;
            }
            
            .search-text p {
                margin: 0;
                font-size: 16px;
                color: #6b7280;
            }
            
            .search-tips {
                margin-bottom: 32px;
            }
            
            .tip-item {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                text-align: left;
                font-size: 14px;
                color: #6b7280;
            }
            
            .tip-item i {
                color: #10b981;
                font-size: 16px;
                flex-shrink: 0;
            }
            
            .cancel-search-btn {
                width: 100%;
                padding: 16px;
                background: #f3f4f6;
                color: #6b7280;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .cancel-search-btn:hover {
                background: #e5e7eb;
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', searchStyles);
}

// Show Searching for Rider Interface
function showSearchingForRiderInterface() {
    const interfaceHTML = `
        <div class="searching-rider-interface" id="searchingRiderInterface">
            <div class="searching-content">
                <div class="searching-animation">
                    <div class="searching-circle">
                        <div class="search-dot dot-1"></div>
                        <div class="search-dot dot-2"></div>
                        <div class="search-dot dot-3"></div>
                        <div class="search-dot dot-4"></div>
                        <div class="search-dot dot-5"></div>
                        <div class="search-dot dot-6"></div>
                    </div>
                    <div class="searching-text">
                        <h3>Searching for rider</h3>
                        <p>Finding the best match for your trip...</p>
                    </div>
                </div>
                
                <div class="searching-status">
                    <div class="status-item">
                        <div class="status-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="status-info">
                            <span class="status-label">Pickup</span>
                            <span class="status-value">Ready</span>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">
                            <i class="fas fa-flag-checkered"></i>
                        </div>
                        <div class="status-info">
                            <span class="status-label">Destination</span>
                            <span class="status-value">Confirmed</span>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">
                            <i class="fas fa-search"></i>
                        </div>
                        <div class="status-info">
                            <span class="status-label">Rider</span>
                            <span class="status-value searching">Searching...</span>
                        </div>
                    </div>
                </div>
                
                <div class="searching-tips">
                    <div class="tip-item">
                        <i class="fas fa-clock"></i>
                        <span>This usually takes less than 30 seconds</span>
                    </div>
                    <div class="tip-item">
                        <i class="fas fa-shield-alt"></i>
                        <span>All riders are verified and safe</span>
                    </div>
                </div>
                
                <button class="cancel-searching-btn" onclick="cancelRiderSearch()">Cancel Search</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', interfaceHTML);
    
    // Add searching interface styles
    const searchingStyles = `
        <style>
            .searching-rider-interface {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10002;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeInSearching 0.3s ease;
            }
            
            @keyframes fadeInSearching {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .searching-content {
                background: white;
                border-radius: 24px;
                padding: 40px;
                width: 90%;
                max-width: 450px;
                text-align: center;
                animation: scaleInSearching 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            @keyframes scaleInSearching {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            
            .searching-animation {
                margin-bottom: 32px;
            }
            
            .searching-circle {
                width: 100px;
                height: 100px;
                margin: 0 auto 24px;
                position: relative;
                animation: rotateSearching 3s linear infinite;
            }
            
            @keyframes rotateSearching {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .search-dot {
                width: 10px;
                height: 10px;
                background: #FFD60A;
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform-origin: -50px center;
            }
            
            .search-dot.dot-1 { transform: translate(-50%, -50%) rotate(0deg) translateX(50px); animation: searchPulse 2s ease-in-out infinite; }
            .search-dot.dot-2 { transform: translate(-50%, -50%) rotate(60deg) translateX(50px); animation: searchPulse 2s ease-in-out infinite 0.3s; }
            .search-dot.dot-3 { transform: translate(-50%, -50%) rotate(120deg) translateX(50px); animation: searchPulse 2s ease-in-out infinite 0.6s; }
            .search-dot.dot-4 { transform: translate(-50%, -50%) rotate(180deg) translateX(50px); animation: searchPulse 2s ease-in-out infinite 0.9s; }
            .search-dot.dot-5 { transform: translate(-50%, -50%) rotate(240deg) translateX(50px); animation: searchPulse 2s ease-in-out infinite 1.2s; }
            .search-dot.dot-6 { transform: translate(-50%, -50%) rotate(300deg) translateX(50px); animation: searchPulse 2s ease-in-out infinite 1.5s; }
            
            @keyframes searchPulse {
                0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(50px) scale(0.8); }
                50% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--rotation)) translateX(50px) scale(1.3); }
            }
            
            .searching-text h3 {
                margin: 0 0 8px;
                font-size: 22px;
                font-weight: 600;
                color: #000;
            }
            
            .searching-text p {
                margin: 0;
                font-size: 14px;
                color: #6b7280;
            }
            
            .searching-status {
                margin-bottom: 24px;
                text-align: left;
            }
            
            .searching-status .status-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 12px 0;
                border-bottom: 1px solid #f3f4f6;
            }
            
            .searching-status .status-item:last-child {
                border-bottom: none;
            }
            
            .status-icon {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            
            .status-icon i {
                font-size: 14px;
            }
            
            .searching-status .status-item:nth-child(1) .status-icon {
                background: #10b981;
                color: white;
            }
            
            .searching-status .status-item:nth-child(2) .status-icon {
                background: #3b82f6;
                color: white;
            }
            
            .searching-status .status-item:nth-child(3) .status-icon {
                background: #f59e0b;
                color: white;
            }
            
            .status-info {
                flex: 1;
            }
            
            .status-label {
                font-size: 12px;
                color: #6b7280;
                display: block;
                margin-bottom: 2px;
            }
            
            .status-value {
                font-size: 14px;
                font-weight: 600;
                color: #000;
            }
            
            .status-value.searching {
                color: #f59e0b;
            }
            
            .searching-tips {
                margin-bottom: 24px;
                text-align: left;
            }
            
            .searching-tips .tip-item {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 8px;
                font-size: 13px;
                color: #6b7280;
            }
            
            .searching-tips .tip-item i {
                color: #10b981;
                font-size: 14px;
                flex-shrink: 0;
            }
            
            .cancel-searching-btn {
                width: 100%;
                padding: 14px;
                background: #f3f4f6;
                color: #6b7280;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .cancel-searching-btn:hover {
                background: #e5e7eb;
            }
        </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', searchingStyles);
}

// Close Searching Rider Interface
function closeSearchingRiderInterface() {
    const interface = document.getElementById('searchingRiderInterface');
    if (interface) {
        interface.remove();
    }
}

// Cancel Rider Search
function cancelRiderSearch() {
    closeSearchingRiderInterface();
    
    // Clear ride data
    localStorage.removeItem('k3k3_current_ride');
    localStorage.removeItem('k3k3_pending_ride');
    
    // Reset status
    updateRideStatus({
        pickup: '',
        destination: '',
        status: 'no_ride',
        driverInfo: { name: 'No active ride' }
    });
    
    // Reset button
    const requestBtn = document.getElementById('requestBtn');
    requestBtn.disabled = false;
    requestBtn.innerHTML = '<i class="fas fa-search"></i> <span>Request Ride</span>';
    
    // Show notification
    showNotification('Rider search cancelled', 'info');
}

// Close Ride Search Modal
function closeRideSearchModal() {
    const modal = document.getElementById('rideSearchModal');
    if (modal) {
        modal.remove();
    }
}

// Cancel Ride Search
function cancelRideSearch() {
    closeRideSearchModal();
    
    // Clear ride data
    localStorage.removeItem('k3k3_current_ride');
    localStorage.removeItem('k3k3_pending_ride');
    
    // Reset status
    updateRideStatus({
        pickup: '',
        destination: '',
        status: 'no_ride',
        driverInfo: { name: 'No active ride' }
    });
    
    // Reset button
    const requestBtn = document.getElementById('requestBtn');
    requestBtn.disabled = false;
    requestBtn.innerHTML = '<i class="fas fa-search"></i> <span>Request Ride</span>';
    
    // Show notification
    showNotification('Ride search cancelled', 'info');
}

// Update Ride Status on Dashboard
function updateRideStatus(rideData) {
    const currentRideElement = document.getElementById('currentRide');
    const driverStatusElement = document.getElementById('driverStatus');
    const estimatedTimeElement = document.getElementById('estimatedTime');
    
    if (currentRideElement) {
        currentRideElement.textContent = `${rideData.pickup} → ${rideData.destination}`;
    }
    
    if (driverStatusElement) {
        if (rideData.status === 'searching') {
            // Show loading animation instead of text
            driverStatusElement.innerHTML = `
                <div class="driver-loading">
                    <div class="loading-dots">
                        <div class="loading-dot dot-1"></div>
                        <div class="loading-dot dot-2"></div>
                        <div class="loading-dot dot-3"></div>
                    </div>
                    <span class="loading-text">Searching for driver</span>
                </div>
            `;
            driverStatusElement.style.color = '#f59e0b';
        } else if (rideData.status === 'driver_found') {
            driverStatusElement.textContent = 'Driver on the way';
            driverStatusElement.style.color = '#10b981';
        } else if (rideData.status === 'arrived') {
            driverStatusElement.textContent = 'Driver has arrived';
            driverStatusElement.style.color = '#3b82f6';
        } else if (rideData.status === 'in_progress') {
            driverStatusElement.textContent = 'Ride in progress';
            driverStatusElement.style.color = '#8b5cf6';
        } else {
            driverStatusElement.textContent = rideData.status || 'No active ride';
            driverStatusElement.style.color = '#6b7280';
        }
    }
    
    if (estimatedTimeElement) {
        if (rideData.estimatedArrival) {
            estimatedTimeElement.textContent = rideData.estimatedArrival;
        } else if (rideData.status === 'searching') {
            estimatedTimeElement.innerHTML = `
                <div class="time-loading">
                    <div class="time-dots">
                        <div class="time-dot dot-1"></div>
                        <div class="time-dot dot-2"></div>
                        <div class="time-dot dot-3"></div>
                    </div>
                </div>
            `;
        } else {
            estimatedTimeElement.textContent = '--';
        }
    }
}

// Show Confirmation Modal
function showConfirmationModal() {
    // Load ride data
    const rideData = JSON.parse(localStorage.getItem('k3k3_pending_ride'));
    
    if (!rideData) {
        showNotification('No ride data found', 'error');
        return;
    }
    
    // Populate modal with ride details
    document.getElementById('confirmPickup').textContent = rideData.pickup;
    document.getElementById('confirmDestination').textContent = rideData.destination;
    document.getElementById('confirmSeats').textContent = rideData.seats;
    document.getElementById('confirmFare').textContent = `₵${rideData.fare.toFixed(2)}`;
    
    // Calculate distance and time
    const distance = Math.random() * 5 + 2; // 2-7 km
    const time = Math.round(distance * 4); // ~4 mins per km
    
    document.getElementById('confirmDistance').textContent = `${distance.toFixed(1)} km`;
    document.getElementById('confirmTime').textContent = `${time} mins`;
    
    // Update fare breakdown
    updateFareBreakdown(rideData.fare);
    
    // Show modal
    const modal = document.getElementById('confirmationModal');
    modal.style.display = 'flex';
    
    // Add swipe functionality
    addSwipeToClose(modal);
    
    console.log('✅ Confirmation modal shown');
}

// Add swipe down to close functionality
function addSwipeToClose(modal) {
    const modalContent = modal.querySelector('.modal-content');
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    const handleStart = (e) => {
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        isDragging = true;
        modalContent.style.transition = 'none';
    };
    
    const handleMove = (e) => {
        if (!isDragging) return;
        
        currentY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const deltaY = currentY - startY;
        
        if (deltaY > 0) { // Only allow downward swipe
            modalContent.style.transform = `translateY(${deltaY}px)`;
            
            // Add opacity based on swipe distance
            const opacity = Math.max(0, 1 - (deltaY / 300));
            modalContent.style.opacity = opacity;
        }
    };
    
    const handleEnd = () => {
        if (!isDragging) return;
        
        isDragging = false;
        const deltaY = currentY - startY;
        
        modalContent.style.transition = 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        
        if (deltaY > 100) { // If swiped down enough, close modal
            modalContent.style.transform = 'translateY(100%)';
            modalContent.style.opacity = '0';
            
            setTimeout(() => {
                closeConfirmation();
                modalContent.style.transform = '';
                modalContent.style.opacity = '';
            }, 500);
        } else { // Otherwise, snap back
            modalContent.style.transform = 'translateY(0)';
            modalContent.style.opacity = '1';
        }
    };
    
    // Mouse events
    modalContent.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    // Touch events
    modalContent.addEventListener('touchstart', handleStart);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
}

// Close Confirmation Modal
function closeConfirmation() {
    const modal = document.getElementById('confirmationModal');
    modal.style.display = 'none';
    
    // Clear any applied promo
    document.getElementById('promoDiscount').style.display = 'none';
    document.getElementById('promoCode').disabled = false;
    document.getElementById('promoCode').value = '';
    
    // Reset payment selection
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('active');
    });
    document.querySelector('.payment-option').classList.add('active');
    
    console.log('🔙 Confirmation modal closed');
}

// Select Payment Method
function selectPayment(method) {
    // Update UI
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
    
    // Update radio button
    document.querySelector(`input[value="${method}"]`).checked = true;
    
    console.log('💳 Payment method selected:', method);
}

// Apply Promo Code
function applyPromo() {
    const promoInput = document.getElementById('promoCode');
    const promoCode = promoInput.value.trim().toUpperCase();
    
    if (!promoCode) {
        showNotification('Please enter a promo code', 'warning');
        return;
    }
    
    // Simulate promo code validation
    const validPromos = {
        'K3K310': 2.00,
        'FIRST10': 3.00,
        'STUDENT5': 1.50,
        'WEEKEND20': 4.00
    };
    
    if (validPromos[promoCode]) {
        const discount = validPromos[promoCode];
        
        // Update UI
        document.getElementById('promoDiscount').style.display = 'flex';
        document.getElementById('discountText').textContent = `₵${discount.toFixed(2)} discount applied!`;
        
        // Update fare breakdown
        const rideData = JSON.parse(localStorage.getItem('k3k3_pending_ride'));
        updateFareBreakdown(rideData.fare, discount);
        
        // Disable promo input
        promoInput.disabled = true;
        event.target.disabled = true;
        event.target.textContent = 'Applied';
        
        showNotification('Promo code applied successfully!', 'success');
        console.log('🎫 Promo code applied:', promoCode, 'Discount:', discount);
        
    } else {
        showNotification('Invalid promo code', 'error');
        console.log('❌ Invalid promo code:', promoCode);
    }
}

// Update Fare Breakdown
function updateFareBreakdown(baseFare, discount = 0) {
    const baseAmount = 10.00;
    const distanceFare = baseFare - baseAmount;
    const totalFare = baseFare - discount;
    
    document.getElementById('baseFare').textContent = `₵${baseAmount.toFixed(2)}`;
    document.getElementById('distanceFare').textContent = `₵${distanceFare.toFixed(2)}`;
    document.getElementById('confirmFare').textContent = `₵${baseFare.toFixed(2)}`;
    document.getElementById('totalFare').textContent = `₵${totalFare.toFixed(2)}`;
    
    // Show/hide discount row
    if (discount > 0) {
        document.getElementById('discountRow').style.display = 'flex';
        document.getElementById('discountAmount').textContent = `-₵${discount.toFixed(2)}`;
    } else {
        document.getElementById('discountRow').style.display = 'none';
    }
}

// Confirm Ride from Modal
function confirmRide() {
    console.log('✅ Confirming ride...');
    
    // Show loading overlay
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    // Get ride data
    const rideData = JSON.parse(localStorage.getItem('k3k3_pending_ride'));
    
    if (!rideData) {
        showNotification('No ride data found', 'error');
        return;
    }
    
    // Calculate final fare with discount
    const discountRow = document.getElementById('discountRow');
    let finalFare = rideData.fare;
    let discountAmount = 0;
    let promoCode = '';
    
    if (discountRow.style.display !== 'none') {
        const discountText = document.getElementById('discountAmount').textContent;
        discountAmount = parseFloat(discountText.replace('-₵', ''));
        finalFare = rideData.fare - discountAmount;
        promoCode = document.getElementById('promoCode').value.trim().toUpperCase();
    }
    
    // Get selected payment method
    const selectedPayment = document.querySelector('input[name="payment"]:checked').value;
    
    // Generate transaction IDs
    const rideId = generateRideId();
    const transactionId = generateTransactionId();
    
    // Prepare confirmed ride data with payment details (no driver info)
    const confirmedRide = {
        ...rideData,
        paymentMethod: selectedPayment,
        paymentStatus: selectedPayment === 'mobile-money' ? 'pending' : 'pending',
        originalFare: rideData.fare,
        discountAmount: discountAmount,
        finalFare: finalFare,
        promoCode: promoCode,
        status: 'searching',
        id: rideId,
        transactionId: transactionId,
        timestamp: new Date().toISOString(),
        paymentDetails: {
            method: selectedPayment,
            status: 'pending',
            transactionId: transactionId,
            amount: finalFare,
            currency: 'GHS',
            discountApplied: discountAmount > 0,
            discountCode: promoCode,
            originalAmount: rideData.fare,
            finalAmount: finalFare
        },
        driverInfo: {
            name: 'Searching...',
            phone: '',
            rating: 0,
            vehicle: '',
            plate: '',
            avatar: ''
        }
    };
    
    // Save confirmed ride data
    localStorage.setItem('k3k3_current_ride', JSON.stringify(confirmedRide));
    
    // Close confirmation modal
    closeConfirmation();
    
    // Simulate driver search
    setTimeout(() => {
        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';
        
        // Update ride status to searching (not driver found)
        confirmedRide.status = 'searching';
        confirmedRide.driverFoundAt = new Date().toISOString();
        localStorage.setItem('k3k3_current_ride', JSON.stringify(confirmedRide));
        
        // Show searching for rider interface instead of floating widget
        showSearchingForRiderInterface();
        
        // Update status display
        updateRideStatus(confirmedRide);
        
        // Show simple notification without driver details
        showNotification('Searching for rider...', 'info');
        
        // Update request button
        const requestBtn = document.getElementById('requestBtn');
        requestBtn.disabled = false;
        requestBtn.innerHTML = '<i class="fas fa-check"></i> <span>Ride Active</span>';
        
    }, 3000);
}

// Show Floating Ride Widget
function showFloatingRideWidget() {
    const widget = document.getElementById('floatingRideWidget');
    const currentRide = JSON.parse(localStorage.getItem('k3k3_current_ride'));
    
    if (!currentRide) {
        console.error('No current ride found');
        return;
    }
    
    // Update widget with current ride data
    updateFloatingWidget(currentRide);
    
    // Show widget with animation
    widget.style.display = 'block';
    
    // Disable "Request Ride" button during ride
    const requestRideBtn = document.querySelector('button[onclick="requestRide()"]');
    if (requestRideBtn) {
        requestRideBtn.disabled = true;
        requestRideBtn.textContent = 'Ride in Progress';
        requestRideBtn.style.background = '#9ca3af';
    }
    
    console.log('✅ Floating ride widget shown');
}

// Update Floating Widget with Ride Data
function updateFloatingWidget(rideData) {
    // Update driver info
    const driverName = document.querySelector('.driver-details h4');
    const driverVehicle = document.querySelector('.driver-details p');
    const driverRating = document.querySelector('.rating');
    const driverAvatar = document.querySelector('.driver-avatar');
    
    if (driverName) driverName.textContent = rideData.driverInfo.name;
    if (driverVehicle) driverVehicle.textContent = `${rideData.driverInfo.vehicle} • ${rideData.driverInfo.plate}`;
    if (driverRating) driverRating.textContent = `⭐ ${rideData.driverInfo.rating}`;
    if (driverAvatar) driverAvatar.src = rideData.driverInfo.avatar;
    
    // Update status and ETA based on ride status
    updateWidgetStatus(rideData.status);
}

// Update Widget Status and ETA
function updateWidgetStatus(status) {
    const etaTime = document.getElementById('widgetEta');
    const etaStatus = document.getElementById('widgetStatus');
    const minimizedStatus = document.getElementById('minimizedStatus');
    const minimizedEta = document.getElementById('minimizedEta');
    
    switch(status) {
        case 'driver_found':
            if (etaTime) etaTime.textContent = '5 mins';
            if (etaStatus) etaStatus.textContent = 'Arriving';
            if (minimizedStatus) minimizedStatus.textContent = 'Driver arriving';
            if (minimizedEta) minimizedEta.textContent = '5 mins';
            break;
        case 'arriving':
            if (etaTime) etaTime.textContent = '2 mins';
            if (etaStatus) etaStatus.textContent = 'Arriving';
            if (minimizedStatus) minimizedStatus.textContent = 'Driver arriving';
            if (minimizedEta) minimizedEta.textContent = '2 mins';
            break;
        case 'in_progress':
            if (etaTime) etaTime.textContent = '12 mins';
            if (etaStatus) etaStatus.textContent = 'En route';
            if (minimizedStatus) minimizedStatus.textContent = 'In ride';
            if (minimizedEta) minimizedEta.textContent = '12 mins';
            break;
        case 'completed':
            if (etaTime) etaTime.textContent = 'Completed';
            if (etaStatus) etaStatus.textContent = 'Thank you!';
            if (minimizedStatus) minimizedStatus.textContent = 'Ride completed';
            if (minimizedEta) minimizedEta.textContent = '';
            break;
    }
}

// Start Ride Progress Simulation
function startRideProgressSimulation() {
    const statusSequence = [
        { status: 'arriving', delay: 5000 },
        { status: 'in_progress', delay: 15000 },
        { status: 'completed', delay: 20000 }
    ];
    
    let currentIndex = 0;
    
    function nextStatus() {
        if (currentIndex < statusSequence.length) {
            const { status, delay } = statusSequence[currentIndex];
            
            setTimeout(() => {
                const currentRide = JSON.parse(localStorage.getItem('k3k3_current_ride'));
                if (currentRide) {
                    currentRide.status = status;
                    localStorage.setItem('k3k3_current_ride', JSON.stringify(currentRide));
                    updateWidgetStatus(status);
                    
                    // Show notifications for key status changes
                    if (status === 'arriving') {
                        showNotification('Driver has arrived! Please meet at pickup point', 'info');
                    } else if (status === 'in_progress') {
                        showNotification('Ride started! Enjoy your trip with K3K3', 'success');
                    } else if (status === 'completed') {
                        handleRideCompletion();
                    }
                }
                
                currentIndex++;
                if (currentIndex < statusSequence.length) {
                    nextStatus();
                }
            }, delay);
        }
    }
    
    nextStatus();
}

// Handle Ride Completion
function handleRideCompletion() {
    const currentRide = JSON.parse(localStorage.getItem('k3k3_current_ride'));
    
    if (currentRide) {
        // Process payment
        const paymentReceipt = processPayment(
            currentRide.id,
            currentRide.paymentMethod,
            currentRide.finalFare
        );
        
        // Show completion notification
        showNotification(`Ride completed! Payment processed via ${currentRide.paymentMethod === 'mobile-money' ? 'Mobile Money' : 'Cash'}`, 'success');
        
        // Update widget to completed state
        updateWidgetStatus('completed');
        
        // Hide widget after 5 seconds
        setTimeout(() => {
            hideFloatingRideWidget();
        }, 5000);
    }
}

// Hide Floating Ride Widget
function hideFloatingRideWidget() {
    const widget = document.getElementById('floatingRideWidget');
    const minimizedWidget = document.getElementById('minimizedRideWidget');
    
    // Hide both widgets
    widget.style.display = 'none';
    minimizedWidget.style.display = 'none';
    
    // Re-enable "Request Ride" button
    const requestRideBtn = document.querySelector('button[onclick="requestRide()"]');
    if (requestRideBtn) {
        requestRideBtn.disabled = false;
        requestRideBtn.textContent = 'Request Ride';
        requestRideBtn.style.background = '';
    }
    
    // Clear current ride
    localStorage.removeItem('k3k3_current_ride');
    
    console.log('✅ Floating ride widget hidden');
}

// Widget Control Functions
function minimizeRideWidget() {
    const widget = document.getElementById('floatingRideWidget');
    const minimizedWidget = document.getElementById('minimizedRideWidget');
    
    widget.style.display = 'none';
    minimizedWidget.style.display = 'block';
}

function restoreRideWidget() {
    const widget = document.getElementById('floatingRideWidget');
    const minimizedWidget = document.getElementById('minimizedRideWidget');
    
    minimizedWidget.style.display = 'none';
    widget.style.display = 'block';
}

function expandRideWidget() {
    showNotification('Detailed ride view coming soon!', 'info');
}

function contactDriver() {
    showNotification('Calling driver...', 'info');
    // In a real app, this would initiate a phone call
}

function messageDriver() {
    showNotification('Opening chat with driver...', 'info');
    // In a real app, this would open a chat interface
}

function cancelRide() {
    if (confirm('Are you sure you want to cancel this ride?')) {
        showNotification('Ride cancelled', 'error');
        hideFloatingRideWidget();
    }
}

// Share Trip for Safety Functionality
function shareTripForSafety() {
    const currentRide = JSON.parse(localStorage.getItem('k3k3_current_ride'));
    
    if (!currentRide) {
        showNotification('No active trip to share', 'error');
        return;
    }
    
    // Generate shareable trip link
    const shareLink = generateTripShareLink(currentRide);
    
    // Create share modal dynamically
    createShareTripModal(currentRide, shareLink);
    
    // Show the modal
    const modal = document.getElementById('shareTripModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }
}

// Create Share Trip Modal Dynamically
function createShareTripModal(rideData, shareLink) {
    // Check if modal already exists
    if (!document.getElementById('shareTripModal')) {
        const modalHTML = `
            <div class="share-trip-modal" id="shareTripModal" style="display: none;">
                <div class="share-modal-overlay" onclick="closeShareTripModal()"></div>
                <div class="share-modal-content">
                    <div class="share-modal-header">
                        <h3>Share Trip for Safety</h3>
                        <button class="share-modal-close" onclick="closeShareTripModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="share-modal-body">
                        <div class="trip-info-summary">
                            <div class="trip-route">
                                <div class="route-point">
                                    <i class="fas fa-map-marker-alt pickup-icon"></i>
                                    <span id="sharePickup">${rideData.pickup || 'Loading pickup...'}</span>
                                </div>
                                <div class="route-line"></div>
                                <div class="route-point">
                                    <i class="fas fa-flag-checkered destination-icon"></i>
                                    <span id="shareDestination">${rideData.destination || 'Loading destination...'}</span>
                                </div>
                            </div>
                            
                            <div class="driver-info-share">
                                <img id="shareDriverAvatar" src="${rideData.driverInfo?.avatar || 'https://picsum.photos/seed/driver-kwame/40/40.jpg'}" alt="Driver">
                                <div class="driver-details-share">
                                    <div class="driver-name-share" id="shareDriverName">${rideData.driverInfo?.name || 'Kwame Asante'}</div>
                                    <div class="driver-vehicle-share" id="shareDriverVehicle">${rideData.driverInfo?.vehicle || 'Toyota Corolla'} • ${rideData.driverInfo?.plate || 'GT-1234-56'}</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="share-options">
                            <h4>Share via:</h4>
                            <div class="share-buttons">
                                <button class="share-option-btn whatsapp" onclick="shareViaWhatsApp('${shareLink}')">
                                    <i class="fab fa-whatsapp"></i>
                                    <span>WhatsApp</span>
                                </button>
                                <button class="share-option-btn sms" onclick="shareViaSMS('${shareLink}')">
                                    <i class="fas fa-sms"></i>
                                    <span>SMS</span>
                                </button>
                                <button class="share-option-btn email" onclick="shareViaEmail('${shareLink}')">
                                    <i class="fas fa-envelope"></i>
                                    <span>Email</span>
                                </button>
                                <button class="share-option-btn copy" onclick="copyShareLink('${shareLink}')">
                                    <i class="fas fa-copy"></i>
                                    <span>Copy Link</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="share-info">
                            <div class="info-item">
                                <i class="fas fa-shield-alt"></i>
                                <span>Your trusted contacts can track your trip in real-time</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-clock"></i>
                                <span>Trip link expires 2 hours after completion</span>
                            </div>
                            <div class="info-item">
                                <i class="fas fa-lock"></i>
                                <span>Only share with people you trust</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add CSS styles
        addShareModalStyles();
    }
}

// Generate Trip Share Link
function generateTripShareLink(rideData) {
    const baseUrl = window.location.origin;
    const rideId = rideData.id || generateRideId();
    const timestamp = Date.now();
    
    // Create shareable link with ride details
    const shareData = {
        rideId: rideId,
        pickup: rideData.pickup,
        destination: rideData.destination,
        driverName: rideData.driverInfo?.name || 'Kwame Asante',
        driverVehicle: rideData.driverInfo?.vehicle || 'Toyota Corolla',
        driverPlate: rideData.driverInfo?.plate || 'GT-1234-56',
        status: rideData.status || 'driver_found',
        timestamp: timestamp,
        expiresAt: timestamp + (2 * 60 * 60 * 1000) // 2 hours
    };
    
    // Encode share data
    const encodedData = btoa(JSON.stringify(shareData));
    return `${baseUrl}/share-trip.html?data=${encodedData}`;
}

// Add Share Modal Styles
function addShareModalStyles() {
    if (!document.getElementById('shareModalStyles')) {
        const styles = `
            <style id="shareModalStyles">
                .share-trip-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                }
                
                .share-trip-modal.show {
                    display: flex;
                    animation: fadeInShareModal 0.3s ease;
                }
                
                @keyframes fadeInShareModal {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .share-modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }
                
                .share-modal-content {
                    position: relative;
                    background: white;
                    border-radius: 16px;
                    max-width: 400px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                    animation: slideUpShareModal 0.3s ease;
                }
                
                @keyframes slideUpShareModal {
                    from {
                        transform: translateY(50px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                .share-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .share-modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #000;
                }
                
                .share-modal-close {
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: #f3f4f6;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .share-modal-close:hover {
                    background: #e5e7eb;
                }
                
                .share-modal-body {
                    padding: 20px;
                }
                
                .trip-info-summary {
                    margin-bottom: 20px;
                }
                
                .trip-route {
                    margin-bottom: 16px;
                }
                
                .route-point {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                }
                
                .route-point i {
                    color: #FFD60A;
                    font-size: 16px;
                }
                
                .route-line {
                    width: 2px;
                    height: 20px;
                    background: #e5e7eb;
                    margin-left: 8px;
                    margin-bottom: 8px;
                }
                
                .driver-info-share {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .driver-info-share img {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                
                .driver-details-share {
                    flex: 1;
                }
                
                .driver-name-share {
                    font-weight: 600;
                    color: #000;
                    margin-bottom: 2px;
                }
                
                .driver-vehicle-share {
                    font-size: 12px;
                    color: #6b7280;
                }
                
                .share-options h4 {
                    margin: 0 0 16px 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #000;
                }
                
                .share-buttons {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                
                .share-option-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 16px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .share-option-btn:hover {
                    border-color: #FFD60A;
                    background: rgba(255, 214, 10, 0.05);
                }
                
                .share-option-btn i {
                    font-size: 20px;
                }
                
                .share-option-btn.whatsapp { color: #25D366; }
                .share-option-btn.sms { color: #007BFF; }
                .share-option-btn.email { color: #EA4335; }
                .share-option-btn.copy { color: #6B7280; }
                
                .share-option-btn span {
                    font-size: 12px;
                    font-weight: 500;
                    color: #374151;
                }
                
                .share-info {
                    border-top: 1px solid #e5e7eb;
                    padding-top: 16px;
                }
                
                .info-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                    font-size: 12px;
                    color: #6b7280;
                }
                
                .info-item i {
                    color: #FFD60A;
                }
                
                @media (max-width: 480px) {
                    .share-buttons {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
}

// Close Share Trip Modal
function closeShareTripModal() {
    const modal = document.getElementById('shareTripModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// Share via WhatsApp
function shareViaWhatsApp(shareLink) {
    const message = `🚗 K3K3 Trip Share\n\nTrack my live trip status:\n${shareLink}\n\nStay safe with K3K3! 🛡️\n\n📞 K3K3 Emergency: +233 50 484 2974`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    showNotification('Opening WhatsApp...', 'info');
}

// Share via SMS
function shareViaSMS(shareLink) {
    const message = `🚗 K3K3 Trip Share - Track my live trip: ${shareLink} - Stay safe with K3K3! 🛡️\n\n📞 K3K3 Emergency: +233 50 484 2974`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
    showNotification('Opening SMS app...', 'info');
}

// Share via Email
function shareViaEmail(shareLink) {
    const subject = '🚗 K3K3 Trip Share - Track My Live Trip';
    const body = `Hi,\n\nI'm sharing my K3K3 trip with you for safety.\n\nTrack my live trip status: ${shareLink}\n\nStay safe with K3K3! 🛡️\n\n📞 K3K3 Emergency: +233 50 484 2974\n\nBest regards`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    showNotification('Opening email app...', 'info');
}

// Copy Share Link
function copyShareLink(shareLink) {
    navigator.clipboard.writeText(shareLink).then(() => {
        showNotification('Trip link copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Trip link copied to clipboard!', 'success');
    });
}

// Generate Transaction ID
function generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `TXN_${timestamp}_${random}`.toUpperCase();
}

// Process Payment (called when ride is completed)
function processPayment(rideId, paymentMethod, amount) {
    const currentRide = JSON.parse(localStorage.getItem('k3k3_current_ride'));
    
    if (!currentRide || currentRide.id !== rideId) {
        console.error('Ride not found for payment processing');
        return null;
    }
    
    // Generate payment receipt
    const receipt = {
        receiptId: generateReceiptId(),
        rideId: rideId,
        transactionId: currentRide.transactionId,
        paymentMethod: paymentMethod,
        amount: amount,
        currency: 'GHS',
        originalAmount: currentRide.originalFare,
        discountAmount: currentRide.discountAmount,
        promoCode: currentRide.promoCode,
        paymentStatus: 'completed',
        paymentTime: new Date().toISOString(),
        paymentDetails: {
            method: paymentMethod,
            provider: paymentMethod === 'mobile-money' ? getMobileMoneyProvider() : 'cash',
            transactionRef: currentRide.transactionId,
            processedAt: new Date().toISOString(),
            receiptGenerated: true
        }
    };
    
    // Update ride with payment completion
    currentRide.paymentStatus = 'completed';
    currentRide.paymentDetails = {
        ...currentRide.paymentDetails,
        status: 'completed',
        completedAt: new Date().toISOString(),
        receipt: receipt
    };
    
    // Save updated ride data
    localStorage.setItem('k3k3_current_ride', JSON.stringify(currentRide));
    
    // Add to ride history with payment receipt
    addToRideHistory(currentRide);
    
    console.log('💳 Payment processed:', receipt);
    return receipt;
}

// Generate Receipt ID
function generateReceiptId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `RCP_${timestamp}_${random}`.toUpperCase();
}

// Get Mobile Money Provider (simulated)
function getMobileMoneyProvider() {
    const providers = ['MTN Mobile Money', 'Vodafone Cash', 'AirtelTigo Money'];
    return providers[Math.floor(Math.random() * providers.length)];
}

// Add to Ride History with Payment Receipt
function addToRideHistory(completedRide) {
    // Get existing ride history
    let rideHistory = JSON.parse(localStorage.getItem('k3k3_ride_history') || '[]');
    
    // Prepare history entry with full payment details
    const historyEntry = {
        id: completedRide.id,
        pickup: completedRide.pickup,
        destination: completedRide.destination,
        seats: completedRide.seats,
        originalFare: completedRide.originalFare,
        discountAmount: completedRide.discountAmount,
        finalFare: completedRide.finalFare,
        promoCode: completedRide.promoCode,
        paymentMethod: completedRide.paymentMethod,
        paymentStatus: completedRide.paymentStatus,
        transactionId: completedRide.transactionId,
        receiptId: completedRide.paymentDetails.receipt?.receiptId || generateReceiptId(),
        completedAt: new Date().toISOString(),
        rideDate: new Date().toLocaleDateString(),
        rideTime: new Date().toLocaleTimeString(),
        duration: completedRide.duration || '15 mins',
        distance: completedRide.distance || '3.2 km',
        driverName: completedRide.driverName || 'Kwame Asante',
        driverPhone: completedRide.driverPhone || '+233 24 123 4567',
        vehicleType: completedRide.vehicleType || 'Sedan',
        vehiclePlate: completedRide.vehiclePlate || 'GT-1234-56',
        rating: null,
        paymentReceipt: completedRide.paymentDetails.receipt || {
            receiptId: generateReceiptId(),
            transactionId: completedRide.transactionId,
            amount: completedRide.finalFare,
            method: completedRide.paymentMethod,
            status: 'completed',
            processedAt: new Date().toISOString()
        }
    };
    
    // Add to beginning of history (most recent first)
    rideHistory.unshift(historyEntry);
    
    // Keep only last 50 rides
    if (rideHistory.length > 50) {
        rideHistory = rideHistory.slice(0, 50);
    }
    
    // Save updated history
    localStorage.setItem('k3k3_ride_history', JSON.stringify(rideHistory));
    
    console.log('📝 Added to ride history with payment receipt:', historyEntry);
}

// Check if Ride is in Progress
function isRideInProgress() {
    // Check if there's an active ride
    const currentRide = localStorage.getItem('k3k3_current_ride');
    return currentRide !== null;
}

// Select Seats
function selectSeats(seats) {
    const seatElement = document.querySelector(`[data-seats="${seats}"]`);
    const allSeatElements = document.querySelectorAll('.seat-option');
    
    // Remove selected class from all seats
    allSeatElements.forEach(element => {
        element.classList.remove('selected');
    });
    
    // Add selected class to clicked seat
    seatElement.classList.add('selected');
    
    // Update selected seats
    selectedSeats = seats;
    
    showNotification(`${seats} seat${seats > 1 ? 's' : ''} selected`);
}

// Generate Ride ID
function generateRideId() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `K3R-${dateStr}${randomStr}`;
}

// Calculate Estimated Fare
function calculateEstimatedFare(pickup, destination) {
    // Simple fare calculation based on distance (in real app, this would use Google Maps API)
    const baseFare = 10.00;
    const distanceRate = 2.50; // per km
    
    // Simulate distance calculation (in real app, use actual distance)
    const estimatedDistance = Math.random() * 10 + 2; // 2-12 km
    const estimatedFare = baseFare + (estimatedDistance * distanceRate);
    
    return Math.round(estimatedFare * 100) / 100; // Round to 2 decimal places
}

// Update Ride Status
function updateRideStatus() {
    const currentRideEl = document.getElementById('currentRide');
    const driverStatusEl = document.getElementById('driverStatus');
    const estimatedTimeEl = document.getElementById('estimatedTime');
    const shareTripBtn = document.getElementById('shareTripBtn');
    
    if (currentRideStatus === 'searching') {
        currentRideEl.textContent = 'Searching for driver...';
        driverStatusEl.textContent = 'Finding available driver';
        estimatedTimeEl.textContent = '--';
        shareTripBtn.disabled = true;
    } else if (currentRideStatus === 'found') {
        currentRideEl.textContent = 'Driver on the way';
        driverStatusEl.textContent = 'Driver arriving in 5 mins';
        estimatedTimeEl.textContent = '5 mins';
        shareTripBtn.disabled = false;
    }
}

// Share Trip Details
function shareTripDetails() {
    if (currentRideStatus !== 'found') {
        showNotification('No active ride to share', 'error');
        return;
    }
    
    const shareData = {
        title: 'K3K3 Ride',
        text: 'I\'m on a K3K3 ride! Track my location.',
        url: window.location.href
    };
    
    if (navigator.share) {
        navigator.share(shareData);
    } else {
        // Fallback - copy to clipboard
        const text = `I'm on a K3K3 ride! Track my location: ${window.location.href}`;
        navigator.clipboard.writeText(text);
        showNotification('Trip details copied to clipboard!', 'success');
    }
}

// Load User Profile
function loadUserProfile() {
    const user = JSON.parse(localStorage.getItem('k3k3_user') || '{}');
    
    // Update UI with user data
    const userNameEl = document.querySelector('.menu-user-name');
    const userPhoneEl = document.querySelector('.menu-user-phone');
    
    if (userNameEl && user.name) {
        userNameEl.textContent = user.name;
    }
    
    if (userPhoneEl && user.phone) {
        userPhoneEl.textContent = user.phone;
    }
}

// Load User Data
function loadUserData() {
    // Load user preferences, recent destinations, etc.
    const destinations = JSON.parse(localStorage.getItem('k3k3_destinations') || '[]');
    console.log('Loaded destinations:', destinations);
}

// Initialize Map
function initializeMap() {
    // Initialize map placeholder
    console.log('Map initialized');
}

// Check Active Ride
function checkActiveRide() {
    // Check if user has an active ride
    const activeRide = localStorage.getItem('k3k3_active_ride');
    
    if (activeRide) {
        currentRideStatus = JSON.parse(activeRide).status;
        updateRideStatus();
    }
}

// Check Ride Status
function checkRideStatus() {
    // Periodic check for ride status updates
    setInterval(() => {
        if (currentRideStatus) {
            // Update ride status
            updateRideStatus();
        }
    }, 5000);
}

// Show Notification — Professional Stacking Toast
function showNotification(message, type = 'info') {
    const iconMap = {
        success:  { svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>', color: '#10B981', bg: '#ECFDF5', border: '#10B981' },
        error:    { svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', color: '#EF4444', bg: '#FEF2F2', border: '#EF4444' },
        warning:  { svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', color: '#F59E0B', bg: '#FFFBEB', border: '#F59E0B' },
        info:     { svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>', color: '#3B82F6', bg: '#EFF6FF', border: '#3B82F6' },
    };
    const cfg = iconMap[type] || iconMap.info;

    // Container for stacking toasts
    let container = document.getElementById('k3k3-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'k3k3-toast-container';
        container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99997;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.style.cssText = `
        background:#fff; border-radius:12px; padding:14px 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06);
        border-left: 3.5px solid ${cfg.border};
        display:flex; align-items:center; gap:12px; min-width:280px; max-width:360px;
        font-family:'Inter','Segoe UI',sans-serif; pointer-events:all;
        animation: k3k3ToastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
    `;
    el.innerHTML = `
        <div style="width:34px;height:34px;border-radius:50%;background:${cfg.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${cfg.color}">${cfg.svg}</div>
        <span style="font-size:13.5px;font-weight:500;color:#1F2937;line-height:1.45;flex:1;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#9CA3AF;padding:2px;flex-shrink:0;display:flex;align-items:center;" title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <style>
            @keyframes k3k3ToastIn { from{opacity:0;transform:translateX(30px) scale(0.95)} to{opacity:1;transform:translateX(0) scale(1)} }
            @keyframes k3k3ToastOut { from{opacity:1;transform:translateX(0) scale(1)} to{opacity:0;transform:translateX(30px) scale(0.95)} }
        </style>
    `;
    container.appendChild(el);

    // Auto dismiss
    setTimeout(() => {
        el.style.animation = 'k3k3ToastOut 0.3s ease forwards';
        setTimeout(() => { if (el.parentElement) el.remove(); }, 320);
    }, 3800);
}

// Get Notification Icon (kept for backward compat)
function getNotificationIcon(type) {
    const icons = { 'success': 'check-circle', 'error': 'exclamation-circle', 'info': 'info-circle', 'warning': 'exclamation-triangle' };
    return icons[type] || 'info-circle';
}

// Check Location Permission on Dashboard Load
function checkLocationPermissionOnLoad() {
    // Check if location permission has been asked before
    const locationPermission = localStorage.getItem('k3k3_location_permission');
    
    console.log('Location permission check:', locationPermission); // Debug log
    
    if (!locationPermission || locationPermission === 'not_asked' || locationPermission === null) {
        // Show permission dialog after a short delay
        setTimeout(() => {
            console.log('Showing GPS permission dialog...'); // Debug log
            showGPSPermissionDialog();
        }, 1500); // Show after 1.5 seconds
    } else if (locationPermission === 'always') {
        // Enable location tracking if always allowed
        console.log('Enabling location tracking...'); // Debug log
        enableLocationTracking();
    } else {
        console.log('Location permission already handled:', locationPermission);
    }
}

// Show GPS Permission Dialog — Professional Toast
function showGPSPermissionDialog() {
    // Remove any existing GPS toast
    const existing = document.getElementById('k3k3-gps-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'k3k3-gps-toast';
    toast.innerHTML = `
        <div id="k3k3-gps-toast-inner" style="
            position: fixed; bottom: 32px; right: 32px; z-index: 99998;
            background: #ffffff; border-radius: 16px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.07);
            padding: 20px 22px; min-width: 320px; max-width: 380px;
            border-left: 4px solid #3B82F6;
            animation: k3k3ToastSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
            font-family: 'Inter', 'Segoe UI', sans-serif;
        ">
            <div style="display:flex; align-items:flex-start; gap:14px;">
                <div style="
                    width:44px; height:44px; border-radius:50%; flex-shrink:0;
                    background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
                    display:flex; align-items:center; justify-content:center;
                ">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                        <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
                    </svg>
                </div>
                <div style="flex:1; min-width:0;">
                    <p style="margin:0 0 3px; font-weight:700; font-size:15px; color:#111827;">Enable Location Access</p>
                    <p style="margin:0 0 16px; font-size:13px; color:#6B7280; line-height:1.5;">
                        K3K3 uses your location to find nearby rides, set your pickup point, and improve your experience.
                    </p>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button onclick="handleGPSPermission('always')" style="
                            width:100%; padding:11px 0; border:none; border-radius:10px; cursor:pointer;
                            background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
                            color:#fff; font-weight:600; font-size:13px;
                            box-shadow: 0 2px 8px rgba(59,130,246,0.3);
                            display:flex; align-items:center; justify-content:center; gap:8px;
                            transition: opacity 0.2s;
                        " onmouseover="this.style.opacity=0.88" onmouseout="this.style.opacity=1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                            Allow While Using App
                        </button>
                        <button onclick="handleGPSPermission('once')" style="
                            width:100%; padding:11px 0; border: 1.5px solid #BFDBFE; border-radius:10px; cursor:pointer;
                            background: #EFF6FF; color:#2563EB; font-weight:600; font-size:13px;
                            display:flex; align-items:center; justify-content:center; gap:8px;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#DBEAFE'" onmouseout="this.style.background='#EFF6FF'">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Allow Once — This Ride Only
                        </button>
                        <button onclick="handleGPSPermission('denied')" style="
                            width:100%; padding:9px 0; border:none; border-radius:10px; cursor:pointer;
                            background: transparent; color:#9CA3AF; font-size:12px; font-weight:500;
                            transition: color 0.2s;
                        " onmouseover="this.style.color='#6B7280'" onmouseout="this.style.color='#9CA3AF'">
                            Not Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <style>
            @keyframes k3k3ToastSlideIn {
                from { opacity:0; transform: translateY(20px) scale(0.95); }
                to   { opacity:1; transform: translateY(0) scale(1); }
            }
            @keyframes k3k3ToastSlideOut {
                from { opacity:1; transform: translateY(0) scale(1); }
                to   { opacity:0; transform: translateY(20px) scale(0.95); }
            }
        </style>
    `;
    document.body.appendChild(toast);

    // Also keep backward-compat with HTML dialog if it exists
    const dialog = document.getElementById('gpsPermissionDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

// GPS Permission Handler
function handleGPSPermission(permission) {
    if (permission === 'denied') {
        showNotification('Location access denied. Some features may be limited.', 'warning');
        // Save denied preference
        localStorage.setItem('k3k3_location_permission', 'denied');
    } else if (permission === 'once' || permission === 'always') {
        // Request actual browser GPS permission
        if (navigator.geolocation) {
            showNotification('Requesting location access...', 'info');
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Success - location granted
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    
                    if (permission === 'always') {
                        // Save preference and enable continuous tracking
                        localStorage.setItem('k3k3_location_permission', 'always');
                        enableLocationTracking();
                        showNotification('📍 Location access granted - Always tracking', 'success');
                    } else {
                        // Save once preference
                        localStorage.setItem('k3k3_location_permission', 'once');
                        showNotification('📍 Location access granted - This ride only', 'success');
                    }
                    
                    // Update pickup input
                    const pickupInput = document.getElementById('pickupInput');
                    if (pickupInput) {
                        pickupInput.value = 'Current Location';
                    }
                },
                (error) => {
                    // Handle GPS errors
                    let errorMessage = 'Location access failed.';
                    
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = '🚫 Location access denied. Please enable location in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = '🚫 Location information unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage = '🚫 Location request timed out.';
                            break;
                        default:
                            errorMessage = '🚫 Unknown location error occurred.';
                    }
                    
                    showNotification(errorMessage, 'error');
                    localStorage.setItem('k3k3_location_permission', 'denied');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        } else {
            showNotification('Geolocation is not supported by your browser', 'error');
            localStorage.setItem('k3k3_location_permission', 'denied');
        }
    }
    
    closeGPSPermissionDialog();
}

// Close GPS Permission Toast
function closeGPSPermissionDialog() {
    const toast = document.getElementById('k3k3-gps-toast');
    if (toast) {
        const inner = toast.querySelector('#k3k3-gps-toast-inner');
        if (inner) inner.style.animation = 'k3k3ToastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 320);
    }
    // Also hide old HTML dialog if present
    const dialog = document.getElementById('gpsPermissionDialog');
    if (dialog) {
        dialog.style.display = 'none';
        dialog.classList.remove('show');
    }
}

// Enable Location Tracking
function enableLocationTracking() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            console.log('Location tracking enabled:', userLocation);
            showNotification('📍 Location tracking enabled', 'success');
            
            // Update pickup input if it's empty
            const pickupInput = document.getElementById('pickupInput');
            if (pickupInput && !pickupInput.value) {
                pickupInput.value = 'Current Location';
            }
        },
        (error) => {
            console.error('Location tracking error:', error);
            showNotification('🚫 Location tracking failed', 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // 1 minute
        }
    );
    
    // Store watch ID for later cleanup
    localStorage.setItem('k3k3_location_watch_id', watchId);
}

// Track Driver Application
function trackApplication() {
    // Redirect to driver application page
    window.location.href = '../rider/apply-to-ride.html';
}

// Request Location Permission Manually
function requestLocationPermission() {
    // Clear existing permission to trigger dialog again
    localStorage.removeItem('k3k3_location_permission');
    
    // Show permission dialog
    showGPSPermissionDialog();
    
    showNotification('Location permission dialog opened', 'info');
}

// Debug function to test GPS dialog
function testGPSDialog() {
    console.log('Testing GPS dialog...');
    showGPSPermissionDialog();
}

// Export functions for global access
window.toggleMainMenu = toggleMainMenu;
window.showSection = showSection;
window.goToProfile = goToProfile;
window.showPaymentMethods = showPaymentMethods;
window.showNotifications = showNotifications;
window.showSupport = showSupport;
window.showSettings = showSettings;
window.handleLogout = handleLogout;
window.toggleDestinationDropdown = toggleDestinationDropdown;
window.requestLocationPermission = requestLocationPermission;
window.showGPSPermissionDialog = showGPSPermissionDialog;
window.testGPSDialog = testGPSDialog;
window.selectQuickDestination = selectQuickDestination;
window.showAddDestinationDialog = showAddDestinationDialog;
window.trackApplication = trackApplication;
window.closeAddDestinationDialog = closeAddDestinationDialog;
window.saveNewDestination = saveNewDestination;
window.handleLocationInput = handleLocationInput;
window.selectSuggestion = selectSuggestion;
window.showLocationSuggestions = showLocationSuggestions;
window.hideLocationSuggestions = hideLocationSuggestions;
window.getCurrentLocationForPickup = getCurrentLocationForPickup;
window.openLocationPicker = openLocationPicker;
window.closeLocationPicker = closeLocationPicker;
window.selectLocation = selectLocation;
window.handleSearchKeypress = handleSearchKeypress;
window.executeSearch = executeSearch;
window.selectSeats = selectSeats;
window.requestRide = requestRide;
window.shareTripDetails = shareTripDetails;
window.handleGPSPermission = handleGPSPermission;
window.confirmLogout = confirmLogout;
window.cancelLogout = cancelLogout;
window.showLogoutConfirmationToast = showLogoutConfirmationToast;
