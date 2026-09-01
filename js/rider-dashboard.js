// K3K3 Rider Dashboard - Professional JavaScript

// Global Variables
window.riderDashboard = window.riderDashboard || {};
window.riderDashboard.isOnline = false;
window.riderDashboard.currentLocation = null;
window.riderDashboard.locationInterval = null;
window.riderDashboard.earningsData = {
    today: 0, // Will be loaded from database
    trips: 0, // Will be loaded from database
    tips: 0, // Will be loaded from database
    bonus: 0.00
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check if user just logged in and needs location permission
    const requestLocationFlag = sessionStorage.getItem('requestLocationPermission');
    
    if (requestLocationFlag === 'true') {
        // Clear the flag
        sessionStorage.removeItem('requestLocationPermission');
        
        // Show login-specific location permission request
        showNotification('Welcome to K3K3! To receive ride requests, please enable location access.', 'info');
        
        // Request location permission after a short delay
        setTimeout(() => {
            requestLocationPermission();
        }, 1000);
    } else {
        // Regular dashboard open - check if permission already granted
        const permissionStatus = localStorage.getItem('k3k3_location_permission');
        if (!permissionStatus || permissionStatus !== 'granted') {
            // Request permission if not granted
            requestLocationPermission();
        } else {
            // Start tracking if already granted
            startLocationTracking();
        }
    }
    
    initializeRiderDashboard();
    setupEventListeners();
    loadRiderProfile();
    initializeEarnings();
});

// Request Location Permission
function requestLocationPermission() {
    if ('geolocation' in navigator) {
        // Check if permission was already granted
        const permissionStatus = localStorage.getItem('k3k3_location_permission');
        if (permissionStatus === 'granted') {
            // Permission already granted, start tracking
            startLocationTracking();
            return;
        }
        
        if (permissionStatus === 'denied') {
            // Permission was denied, show helpful message
            showNotification('Location access is needed to receive ride requests. Please enable location in your browser settings.', 'warning');
            return;
        }
        
        // Show notification asking for location permission
        showNotification('Welcome! K3K3 needs location access to help you find rides and provide accurate pickup directions.', 'info');
        
        // Request location permission
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Permission granted
                showNotification('Location access granted! You can now receive ride requests.', 'success');
                localStorage.setItem('k3k3_location_permission', 'granted');
                startLocationTracking();
            },
            (error) => {
                // Permission denied or error
                let errorMessage = 'Location access helps us find rides for you. ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Please enable location in your browser settings.';
                        localStorage.setItem('k3k3_location_permission', 'denied');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out. Please try again.';
                        break;
                    default:
                        errorMessage += 'An unknown error occurred.';
                        break;
                }
                showNotification(errorMessage, 'warning');
                localStorage.setItem('k3k3_location_permission', 'denied');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        showNotification('Geolocation is not supported by your browser. Please use a modern browser.', 'error');
    }
}

// Initialize Rider Dashboard
function initializeRiderDashboard() {
    console.log('K3K3 Rider Dashboard Initialized');
    
    // For demo purposes, skip authentication check
    // In production, uncomment the authentication check below
    /*
    // Check if user is logged in as rider
    const user = localStorage.getItem('k3k3_rider');
    if (!user) {
        window.location.href = '../index.html';
        return;
    }
    */
    
    // Load rider data
    loadRiderData();
    
    // Initialize location tracking
    initializeLocationTracking();
    
    // Load earnings data
    loadEarningsData();
    
    // Load recent activity
    loadRecentActivity();
}

// Hamburger Menu Functions
function toggleMainMenu() {
    const menu = document.getElementById('mainMenu');
    const overlay = document.getElementById('mainMenuOverlay');
    
    menu.classList.toggle('show');
    overlay.classList.toggle('show');
}

function closeMainMenu() {
    const menu = document.getElementById('mainMenu');
    const overlay = document.getElementById('mainMenuOverlay');
    
    menu.classList.remove('show');
    overlay.classList.remove('show');
}

// User Menu Functions
function toggleUserMenu() {
    const dropdown = document.getElementById('userMenuDropdown');
    dropdown.classList.toggle('show');
    
    // Close when clicking outside
    document.addEventListener('click', function closeUserMenu(e) {
        if (!e.target.closest('.user-menu') && !e.target.closest('.user-menu-dropdown')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeUserMenu);
        }
    });
}

// Navigation Functions
function goToHome() {
    closeMainMenu();
    window.location.reload();
}

function findRides() {
    closeMainMenu();
    showNotification('Finding available passengers...', 'info');
    // TODO: Implement passenger finding logic
}

function viewEarnings() {
    closeMainMenu();
    showNotification('Opening earnings details...', 'info');
    // TODO: Implement earnings view
}

function viewHistory() {
    closeMainMenu();
    showNotification('Loading trip history...', 'info');
    // TODO: Implement trip history
}

// Navigation Functions for Account Pages
function navigateToProfile() {
    closeMainMenu();
    showNotification('Opening Profile...', 'info');
    // Navigate to profile page
    setTimeout(() => {
        window.location.href = 'profile.html';
    }, 500);
}

function navigateToWallet() {
    closeMainMenu();
    showNotification('Opening Wallet...', 'info');
    // Navigate to wallet page
    setTimeout(() => {
        window.location.href = 'wallet.html';
    }, 500);
}

function navigateToSettings() {
    closeMainMenu();
    showNotification('Opening Settings...', 'info');
    // Navigate to settings page
    setTimeout(() => {
        window.location.href = 'settings.html';
    }, 500);
}

function navigateToSupport() {
    closeMainMenu();
    showNotification('Opening Support...', 'info');
    // Navigate to support page
    setTimeout(() => {
        window.location.href = 'support.html';
    }, 500);
}

function viewProfile() {
    navigateToProfile();
}

function viewWallet() {
    navigateToWallet();
}

function viewMap() {
    showNotification('Opening map view...', 'info');
    // TODO: Implement map view
}

function showSettings() {
    navigateToSettings();
}

function showSupport() {
    navigateToSupport();
}

function showNotifications() {
    showNotification('Opening notifications...', 'info');
    // TODO: Implement notifications
}

function handleLogout() {
    closeMainMenu();
    
    if (confirm('Are you sure you want to logout?')) {
        // Clear all rider session data
        localStorage.removeItem('k3k3_rider');
        localStorage.removeItem('k3k3_rider_token');
        localStorage.removeItem('riderSession');
        sessionStorage.removeItem('riderSession');
        
        showNotification('Logging out...', 'info');
        
        // Redirect to rider login page
        setTimeout(() => {
            window.location.href = 'rider-login.html';
        }, 1500);
    }
}

// Online Status Toggle
function toggleOnlineStatus() {
    const checkbox = document.getElementById('onlineStatus');
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    const toggleIndicator = document.querySelector('.toggle-indicator');
    
    window.riderDashboard.isOnline = checkbox.checked;
    
    if (window.riderDashboard.isOnline) {
        // Going Online
        updateToggleIndicator('ON');
        
        // Clear any existing notifications first
        clearAllNotifications();
        
        // Show online notification first
        showNotification('You are now online and ready to receive trip requests!', 'success');
        
        // Show location notification after first one disappears (3 seconds)
        setTimeout(() => {
            showNotification('Location sharing activated', 'info');
        }, 3500);
        
        // Show backend notification after second one disappears (4 seconds)
        setTimeout(() => {
            showNotification('Your location is now visible to passengers', 'success');
        }, 8000);
        
        // Update location status
        updateLocationStatus(true);
        
        // Start location tracking
        if (window.riderDashboard.currentLocation) {
            startContinuousLocationTracking();
            setTimeout(() => {
                sendLocationToBackend();
            }, 2000);
        } else {
            // Request location if not available
            setTimeout(() => {
                requestLocationPermission();
            }, 1000);
        }
        
        // Update UI
        updateOnlineStatusUI(true);
        
        // Start receiving ride requests
        setTimeout(() => {
            startReceivingRides();
        }, 4000);
    } else {
        // Going Offline
        updateToggleIndicator('OFF');
        
        // Clear any existing notifications first
        clearAllNotifications();
        
        // Show offline notification first
        showNotification('You are now offline. You won\'t receive trip requests.', 'info');
        
        // Show location stopped notification after first one (4 seconds)
        setTimeout(() => {
            showNotification('Location sharing stopped', 'warning');
        }, 4500);
        
        // Update location status
        updateLocationStatus(false);
        
        // Stop location tracking
        stopLocationTracking();
        
        // Update UI
        updateOnlineStatusUI(false);
        
        // Stop receiving ride requests
        setTimeout(() => {
            stopReceivingRides();
        }, 2000);
    }
    
    // Save preference
    localStorage.setItem('k3k3_rider_online', window.riderDashboard.isOnline);
}

// Update Toggle Indicator
function updateToggleIndicator(status) {
    const toggleIndicator = document.querySelector('.toggle-indicator');
    if (toggleIndicator) {
        toggleIndicator.textContent = status;
    }
}

// Clear All Notifications
function clearAllNotifications() {
    const existingNotifications = document.querySelectorAll('.k3k3-notification');
    existingNotifications.forEach(notif => {
        if (notif.parentNode) {
            notif.remove();
        }
    });
}

// Update Online Status UI
function updateOnlineStatusUI(isOnline) {
    const statusLocation = document.getElementById('statusLocation');
    const locationIndicator = document.getElementById('locationIndicator');
    const locationStatusText = document.getElementById('locationStatusText');
    const toggleLocation = document.getElementById('toggleLocation');
    
    if (isOnline) {
        // Online UI updates
        if (statusLocation && window.riderDashboard.currentLocation) {
            statusLocation.textContent = `Lat: ${window.riderDashboard.currentLocation.lat.toFixed(6)}, Lng: ${window.riderDashboard.currentLocation.lng.toFixed(6)}`;
        }
        
        if (locationIndicator) {
            locationIndicator.classList.remove('offline');
            locationIndicator.classList.add('online');
        }
        
        if (locationStatusText) {
            locationStatusText.textContent = 'GPS Active';
        }
        
        if (toggleLocation) {
            toggleLocation.innerHTML = '<i class="fas fa-location-arrow"></i><span>Stop Location Sharing</span>';
            toggleLocation.classList.remove('primary');
        }
    } else {
        // Offline UI updates
        if (statusLocation) {
            statusLocation.textContent = 'Offline';
        }
        
        if (locationIndicator) {
            locationIndicator.classList.remove('online');
            locationIndicator.classList.add('offline');
        }
        
        if (locationStatusText) {
            locationStatusText.textContent = 'GPS Off';
        }
        
        if (toggleLocation) {
            toggleLocation.innerHTML = '<i class="fas fa-location-arrow"></i><span>Start Location Sharing</span>';
            toggleLocation.classList.add('primary');
        }
    }
}

// Update Location Status
function updateLocationStatus(isActive) {
    const locationIndicator = document.getElementById('locationIndicator');
    const locationStatusText = document.getElementById('locationStatusText');
    
    if (isActive) {
        if (locationIndicator) {
            locationIndicator.classList.remove('offline');
            locationIndicator.classList.add('online');
        }
        if (locationStatusText) {
            locationStatusText.textContent = 'GPS Active';
        }
    } else {
        if (locationIndicator) {
            locationIndicator.classList.remove('online');
            locationIndicator.classList.add('offline');
        }
        if (locationStatusText) {
            locationStatusText.textContent = 'GPS Off';
        }
    }
}

// Send Location to Backend
function sendLocationToBackend() {
    if (!window.riderDashboard.currentLocation || !window.riderDashboard.isOnline) {
        return;
    }
    
    const locationData = {
        riderId: 'rider_123', // Would get from logged-in user
        latitude: window.riderDashboard.currentLocation.lat,
        longitude: window.riderDashboard.currentLocation.lng,
        accuracy: window.riderDashboard.currentLocation.accuracy,
        timestamp: window.riderDashboard.currentLocation.timestamp,
        status: 'online'
    };
    
    // Simulate backend API call
    console.log('Sending location to backend:', locationData);
    
    // In a real implementation, this would be:
    // fetch('/api/rider/location', {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': `Bearer ${token}`
    //     },
    //     body: JSON.stringify(locationData)
    // });
    
    // Show success notification for demo
    showNotification('Location shared with passengers', 'success');
}

// Refresh Location
function refreshLocation() {
    if (!window.riderDashboard.isOnline) {
        showNotification('Please go online first', 'warning');
        return;
    }
    
    showNotification('Refreshing location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            window.riderDashboard.currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };
            
            updateLocationDisplay();
            sendLocationToBackend();
            showNotification('Location refreshed successfully', 'success');
        },
        (error) => {
            console.error('Location refresh error:', error);
            showNotification('Failed to refresh location', 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Go Online Function
function goOnline() {
    const checkbox = document.getElementById('onlineStatus');
    checkbox.checked = true;
    toggleOnlineStatus();
}

// Update Earnings Period
function updateEarningsPeriod(period) {
    let earnings = 0;
    let periodText = '';
    
    switch(period) {
        case 'today':
            earnings = 185.50;
            periodText = 'Today\'s Earnings';
            break;
        case 'week':
            earnings = 1250.75;
            periodText = 'This Week\'s Earnings';
            break;
        case 'month':
            earnings = 5200.25;
            periodText = 'This Month\'s Earnings';
            break;
    }
    
    // Update earnings display
    const earningsAmount = document.querySelector('.earnings-amount');
    const earningsPeriod = document.querySelector('.earnings-period');
    
    if (earningsAmount) earningsAmount.textContent = `₵${earnings.toFixed(2)}`;
    if (earningsPeriod) earningsPeriod.textContent = periodText;
    
    showNotification(`Showing ${period.toLowerCase()} earnings`, 'info');
}

// Location Tracking
function initializeLocationTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                window.riderDashboard.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                localStorage.setItem('rider_current_location', JSON.stringify(window.riderDashboard.currentLocation));
                console.log('Rider location updated:', window.riderDashboard.currentLocation);
            },
            (error) => {
                console.error('Location error:', error);
                showNotification('Unable to get your location', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    }
}

function startLocationTracking() {
    if (window.riderDashboard.locationInterval) {
        clearInterval(window.riderDashboard.locationInterval);
    }
    
    window.riderDashboard.locationInterval = setInterval(() => {
        initializeLocationTracking();
    }, 30000); // Update every 30 seconds
}

function stopLocationTracking() {
    if (window.riderDashboard.locationInterval) {
        clearInterval(window.riderDashboard.locationInterval);
        window.riderDashboard.locationInterval = null;
    }
}

// Load Rider Data
function loadRiderData() {
    // Load from localStorage or use demo data
    const savedRider = localStorage.getItem('k3k3_rider');
    
    if (savedRider) {
        const riderData = JSON.parse(savedRider);
        updateRiderUI(riderData);
    } else {
        // Use demo data
        const demoRider = {
            name: 'John Rider',
            id: 'RDR-2024-001',
            rating: 4.8,
            totalTrips: 156,
            acceptanceRate: 98,
            avatar: 'JD'
        };
        
        updateRiderUI(demoRider);
    }
}

// Update Rider UI
function updateRiderUI(riderData) {
    // Update user name
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
        element.textContent = riderData.name.split(' ')[0]; // Show first name only
    });
    
    // Update avatar
    const avatarElements = document.querySelectorAll('.user-avatar');
    avatarElements.forEach(element => {
        element.textContent = riderData.avatar || riderData.name.split(' ').map(n => n[0]).join('').toUpperCase();
    });
    
    // Update stats if they exist
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 4) {
        statValues[0].textContent = riderData.totalTrips || '156';
        statValues[1].textContent = riderData.rating || '4.8';
    }
}

// Load Earnings Data
function loadEarningsData() {
    // Load from localStorage or use demo data
    const savedEarnings = localStorage.getItem('k3k3_rider_earnings');
    
    if (savedEarnings) {
        window.riderDashboard.earningsData = JSON.parse(savedEarnings);
    }
    
    updateEarningsUI();
}

// Update Earnings UI
function updateEarningsUI() {
    const earningsAmount = document.querySelector('.earnings-amount');
    if (earningsAmount) {
        earningsAmount.textContent = `₵${window.riderDashboard.earningsData.today.toFixed(2)}`;
    }
}

// Load Recent Activity
function loadRecentActivity() {
    // This would typically come from an API
    // For demo purposes, the activity is already in the HTML
}

// Setup Event Listeners
function setupEventListeners() {
    // Close menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.main-menu') && !e.target.closest('.hamburger-menu')) {
            closeMainMenu();
        }
    });
    
    // Handle escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeMainMenu();
            const dropdown = document.getElementById('userMenuDropdown');
            dropdown.classList.remove('show');
        }
    });
    
    // Handle online status changes
    const onlineStatus = document.getElementById('onlineStatus');
    if (onlineStatus) {
        onlineStatus.addEventListener('change', toggleOnlineStatus);
    }
}

// Load Rider Profile
function loadRiderProfile() {
    // This would typically load from an API
    console.log('Rider profile loaded');
}

// Initialize Earnings
function initializeEarnings() {
    // This would typically load from an API
    console.log('Earnings initialized');
}

// Show Notification (Passenger-style Helper Function)
function showNotification(message, type = 'info') {
    // Don't auto-clear notifications - let them stack or overlap naturally
    // This allows sequential notifications to appear one after another
    
    const notification = document.createElement('div');
    notification.className = `k3k3-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Style notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        margin-bottom: 10px;
    `;
    
    // Adjust position for stacking - check existing notifications
    const existingNotifications = document.querySelectorAll('.k3k3-notification');
    if (existingNotifications.length > 0) {
        const lastNotification = existingNotifications[existingNotifications.length - 1];
        const lastTop = parseInt(lastNotification.style.top) || 20;
        notification.style.top = `${lastTop + 80}px`; // Stack below previous notification
    }
    
    // Style notification content
    const notificationContent = notification.querySelector('.notification-content');
    notificationContent.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    
    // Style icon
    const icon = notification.querySelector('i');
    icon.style.cssText = `
        font-size: 18px;
        flex-shrink: 0;
    `;
    
    // Style message
    const messageSpan = notification.querySelector('span');
    messageSpan.style.cssText = `
        flex: 1;
        font-weight: 500;
    `;
    
    // Style close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.7;
        transition: opacity 0.2s;
    `;
    
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.opacity = '1';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.opacity = '0.7';
    });
    
    document.body.appendChild(notification);
    
    // Animate in with professional delay
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove with professional timing based on type
    let displayTime = 4000; // Default 4 seconds
    
    switch(type) {
        case 'success':
            displayTime = 3000; // 3 seconds for success
            break;
        case 'error':
            displayTime = 6000; // 6 seconds for errors (user needs more time)
            break;
        case 'warning':
            displayTime = 5000; // 5 seconds for warnings
            break;
        case 'info':
            displayTime = 4000; // 4 seconds for info
            break;
    }
    
    // Auto remove
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, displayTime);
}

// Helper functions for notification styling
function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function getNotificationColor(type) {
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    return colors[type] || '#3B82F6';
}

// Make functions globally available
window.toggleMainMenu = toggleMainMenu;
window.closeMainMenu = closeMainMenu;
window.toggleUserMenu = toggleUserMenu;
window.goToHome = goToHome;
window.findRides = findRides;
window.viewEarnings = viewEarnings;
window.viewHistory = viewHistory;
window.viewProfile = viewProfile;
window.viewWallet = viewWallet;
window.viewMap = viewMap;
window.showSettings = showSettings;
window.showSupport = showSupport;
window.showNotifications = showNotifications;
window.handleLogout = handleLogout;
window.toggleOnlineStatus = toggleOnlineStatus;
window.goOnline = goOnline;
window.updateEarningsPeriod = updateEarningsPeriod;

// Setup Event Listeners
function setupEventListeners() {
    // Handle online status toggle
    const onlineToggle = document.getElementById('onlineStatus');
    if (onlineToggle) {
        onlineToggle.addEventListener('change', toggleOnlineStatus);
    }
    
    // Handle escape key for dialogs
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeGPSDialog();
        }
    });
    
    // Handle location sharing toggle
    const locationBtn = document.getElementById('toggleLocation');
    if (locationBtn) {
        locationBtn.addEventListener('click', toggleLocationSharing);
    }
}

// Start Receiving Rides
function startReceivingRides() {
    console.log('Starting to receive ride requests...');
    // Simulate ride requests
    setTimeout(() => {
        if (window.riderDashboard.isOnline) {
            simulateRideRequest();
        }
    }, 10000);
}

// Stop Receiving Rides
function stopReceivingRides() {
    console.log('Stopping ride requests...');
}

// Simulate Ride Request
function simulateRideRequest() {
    showNotification('New ride request received!', 'info');
    
    // In a real app, this would show a ride request modal
    if (confirm('New ride request: Ho Central Market to HTU Campus. Accept?')) {
        acceptRide();
    }
}

// Accept Ride
function acceptRide() {
    showNotification('Ride accepted! Navigate to pickup location', 'success');
    
    // Update earnings
    window.riderDashboard.earningsData.trips++;
    window.riderDashboard.earningsData.today += 15.00;
    updateEarningsDisplay();
    
    // Add to activity
    addActivityItem('trip', 'Ride accepted - Ho Central Market to HTU');
}

// Initialize Location Tracking
function initializeLocationTracking() {
    // Check if user has previously granted permission
    const gpsPermission = localStorage.getItem('k3k3_rider_gps_permission');
    
    if (gpsPermission === 'always') {
        startLocationTracking();
    }
}

// Toggle Location Sharing
function toggleLocationSharing() {
    const btn = document.getElementById('toggleLocation');
    const statusText = document.getElementById('locationStatus');
    const indicator = document.getElementById('locationIndicator');
    const gpsStatus = document.getElementById('gpsStatus');
    
    if (!window.riderDashboard.currentLocation) {
        // Request GPS permission
        showGPSDialog();
        return;
    }
    
    if (window.riderDashboard.locationInterval) {
        // Stop location sharing
        clearInterval(window.riderDashboard.locationInterval);
        window.riderDashboard.locationInterval = null;
        
        btn.classList.remove('active');
        statusText.textContent = 'Start Location';
        indicator.classList.remove('online');
        gpsStatus.textContent = 'GPS Off';
        
        showNotification('Location sharing stopped', 'info');
    } else {
        // Start location sharing
        startLocationSharing();
        
        btn.classList.add('active');
        statusText.textContent = 'Stop Location';
        indicator.classList.add('online');
        gpsStatus.textContent = 'GPS Active';
        
        showNotification('Location sharing started', 'success');
    }
}

// Start Location Tracking
function startLocationTracking() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    // Check if permission was previously granted
    const permissionStatus = localStorage.getItem('k3k3_location_permission');
    if (permissionStatus === 'denied') {
        showNotification('Location permission was denied. Please enable location in your browser settings to receive ride requests.', 'warning');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            window.riderDashboard.currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };
            
            console.log('Location obtained:', window.riderDashboard.currentLocation);
            
            // Update location display on dashboard
            updateLocationDisplay();
            
            // Start continuous location tracking
            startContinuousLocationTracking();
            
            // Update map display
            updateMapDisplay();
        },
        (error) => {
            console.error('Location error:', error);
            let errorMessage = 'Unable to get your location. ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please enable location access.';
                    localStorage.setItem('k3k3_location_permission', 'denied');
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
                    break;
            }
            showNotification(errorMessage, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Start Continuous Location Tracking
function startContinuousLocationTracking() {
    if (window.riderDashboard.locationInterval) {
        clearInterval(window.riderDashboard.locationInterval);
    }
    
    // Update location every 30 seconds
    window.riderDashboard.locationInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                window.riderDashboard.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                
                // Update location display
                updateLocationDisplay();
                
                // Update map
                updateMapDisplay();
                
                // Send location to server (in real app)
                sendLocationToServer(window.riderDashboard.currentLocation);
                
                // Send to backend for passengers
                sendLocationToBackend();
            },
            (error) => {
                console.error('Continuous location error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 60000 // Accept location up to 1 minute old
            }
        );
    }, 30000); // Update every 30 seconds
}

// Update Location Display
function updateLocationDisplay() {
    if (window.riderDashboard.currentLocation) {
        // Update status location if it exists
        const statusLocation = document.getElementById('statusLocation');
        if (statusLocation) {
            statusLocation.textContent = `Lat: ${window.riderDashboard.currentLocation.lat.toFixed(6)}, Lng: ${window.riderDashboard.currentLocation.lng.toFixed(6)}`;
        }
        
        // Update coordinate display
        const latValue = document.getElementById('latValue');
        const lngValue = document.getElementById('lngValue');
        const accuracyValue = document.getElementById('accuracyValue');
        
        if (latValue) {
            latValue.textContent = window.riderDashboard.currentLocation.lat.toFixed(6);
        }
        
        if (lngValue) {
            lngValue.textContent = window.riderDashboard.currentLocation.lng.toFixed(6);
        }
        
        if (accuracyValue) {
            accuracyValue.textContent = `±${window.riderDashboard.currentLocation.accuracy.toFixed(0)}m`;
        }
        
        // Update map preview
        const mapPreview = document.getElementById('mapPreview');
        if (mapPreview) {
            mapPreview.innerHTML = `
                <div class="map-active">
                    <i class="fas fa-map-marker-alt" style="color: var(--k3k3-success); font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p style="margin: 0; color: var(--k3k3-gray-700); font-size: 0.875rem;">
                        Live location active<br>
                        <small style="color: var(--k3k3-gray-500);">
                            ${window.riderDashboard.currentLocation.lat.toFixed(4)}, ${window.riderDashboard.currentLocation.lng.toFixed(4)}
                        </small>
                    </p>
                </div>
            `;
        }
        
        console.log('Location updated:', window.riderDashboard.currentLocation);
    }
}

// Update Map Display
function updateMapDisplay() {
    // This would update a map component on the dashboard
    console.log('Map updated with location:', window.riderDashboard.currentLocation);
    
    // In a real implementation, this would:
    // 1. Update map center to current location
    // 2. Show rider position on map
    // 3. Update nearby ride requests
    // 4. Show pickup zones
    
    // For demo purposes, just log the action
    if (window.riderDashboard.currentLocation) {
        console.log(`Map centered at: ${window.riderDashboard.currentLocation.lat}, ${window.riderDashboard.currentLocation.lng}`);
        console.log('Searching for nearby ride requests...');
    }
}

// Send Location to Server
function sendLocationToServer(location) {
    // In a real app, this would send location to backend
    console.log('Sending location to server:', location);
    
    // This would typically:
    // 1. Send location to WebSocket connection
    // 2. Update rider availability in database
    // 3. Match rider with nearby requests
    // 4. Send notifications for new requests
    
    // For demo purposes, just simulate finding nearby requests
    if (Math.random() > 0.8) { // 20% chance of finding a request
        simulateNearbyRequest();
    }
}

// Simulate Nearby Request (for demo)
function simulateNearbyRequest() {
    if (window.riderDashboard.currentLocation && window.riderDashboard.isOnline) {
        // Generate a random nearby location
        const nearbyLat = window.riderDashboard.currentLocation.lat + (Math.random() - 0.5) * 0.01;
        const nearbyLng = window.riderDashboard.currentLocation.lng + (Math.random() - 0.5) * 0.01;
        
        console.log(`Nearby request at: ${nearbyLat}, ${nearbyLng}`);
        
        // Show professional ride request modal directly
        showRideRequestModal();
    }
}

// Show Professional Ride Request Modal
function showRideRequestModal() {
    const modal = document.getElementById('rideRequestModal');
    if (modal) {
        // Update modal with random ride data
        updateRideRequestData();
        
        // Show modal
        modal.classList.add('show');
        
        // Start countdown timer
        startRequestTimer();
        
        // Play notification sound (in real app)
        playNotificationSound();
    }
}

// Update Ride Request Data - Load from Database
async function updateRideRequestData() {
    try {
        // Load real ride requests from database
        const riderUser = JSON.parse(localStorage.getItem('driver_user') || '{}');
        if (!riderUser.id) {
            console.warn('No rider user found, using fallback data');
            loadFallbackRideData();
            return;
        }

        // Get available trips from main2.0 backend
        const response = await fetch('http://localhost:8810/api/v1/trips/');
        if (response.ok) {
            const trips = await response.json();
            
            // Filter trips that need riders (status = 'requested' and no rider assigned)
            const availableTrips = trips.filter(trip => 
                trip.status === 'requested' && !trip.rider_id
            );

            if (availableTrips.length > 0) {
                // Load real trip data
                loadRealTripData(availableTrips);
            } else {
                console.log('No available trips found');
                loadFallbackRideData();
            }
        } else {
            console.warn('Failed to load trips from database, using fallback');
            loadFallbackRideData();
        }
    } catch (error) {
        console.error('Error loading ride requests:', error);
        loadFallbackRideData();
    }
}

// Load real trip data from database
async function loadRealTripData(trips) {
    // Get passenger information for each trip
    const rideOptions = [];
    
    for (const trip of trips) {
        try {
            // Get passenger info from main2.0 backend
            const passengersResponse = await fetch('http://localhost:8810/api/v1/passengers/');
            if (passengersResponse.ok) {
                const passengers = await passengersResponse.json();
                const passenger = passengers.find(p => p.id === trip.passenger_id);
                
                if (passenger) {
                    // Get rider info from main2.0 backend
                    const ridersResponse = await fetch('http://localhost:8810/api/v1/riders/');
                    if (ridersResponse.ok) {
                        const riders = await ridersResponse.json();
                        const rider = riders.find(r => r.id === trip.rider_id);
                        
                        if (rider) {
                            // Calculate distance and time (simplified)
                            const distance = calculateDistance(
                                trip.pickup_lat, trip.pickup_lng,
                                trip.dest_lat, trip.dest_lng
                            );
                            const estimatedTime = Math.round(distance * 3); // Rough estimate: 3 mins per km
                            
                            rideOptions.push({
                                passengerName: user.name || 'Unknown Passenger',
                                passengerRating: '4.8', // Would come from passenger rating
                                pickupAddress: await getAddressFromCoords(trip.pickup_lat, trip.pickup_lng),
                                destinationAddress: await getAddressFromCoords(trip.dest_lat, trip.dest_lng),
                                distance: `${distance.toFixed(1)} km`,
                                estimatedTime: `${estimatedTime} mins`,
                                passengerCount: '1',
                                fare: trip.fare_estimate ? `₵${trip.fare_estimate.toFixed(2)}` : '₵45.00',
                                tripId: trip.id
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading trip details:', error);
        }
    }
    
    // Update ride request modal with real data
    updateRideRequestModal(rideOptions);
}

// Load fallback ride data when database is unavailable
function loadFallbackRideData() {
    const rideOptions = [
        {
            passengerName: 'Sarah Johnson',
            passengerRating: '4.8',
            pickupAddress: 'Accra Mall, Oxford Street',
            destinationAddress: 'Kotoka International Airport',
            distance: '8.5 km',
            estimatedTime: '25 mins',
            passengerCount: '1',
            fare: '₵45.00'
        },
        {
            passengerName: 'Kwame Asante',
            passengerRating: '4.9',
            pickupAddress: 'University of Ghana, Legon',
            destinationAddress: 'Makola Market',
            distance: '12.3 km',
            estimatedTime: '35 mins',
            passengerCount: '2',
            fare: '₵62.00'
        }
    ];
    
    updateRideRequestModal(rideOptions);
}

// Update ride request modal with data
function updateRideRequestModal(rideOptions) {
    // Update modal with ride options
    const pickupAddressEl = document.getElementById('pickupAddress');
    const destinationAddressEl = document.getElementById('destinationAddress');
    const passengerNameEl = document.getElementById('passengerName');
    const passengerRatingEl = document.getElementById('passengerRating');
    const rideDistanceEl = document.getElementById('rideDistance');
    const rideTimeEl = document.getElementById('rideTime');
    const passengerCountEl = document.getElementById('passengerCount');
    const rideFareEl = document.getElementById('rideFare');
    
    if (rideOptions.length > 0) {
        const ride = rideOptions[0]; // Use first available ride
        
        if (pickupAddressEl) pickupAddressEl.textContent = ride.pickupAddress;
        if (destinationAddressEl) destinationAddressEl.textContent = ride.destinationAddress;
        if (passengerNameEl) passengerNameEl.textContent = ride.passengerName;
        if (passengerRatingEl) passengerRatingEl.textContent = ride.passengerRating;
        if (rideDistanceEl) rideDistanceEl.textContent = ride.distance;
        if (rideTimeEl) rideTimeEl.textContent = ride.estimatedTime;
        if (passengerCountEl) passengerCountEl.textContent = ride.passengerCount;
        if (rideFareEl) rideFareEl.textContent = ride.fare;
        
        // Store trip ID for acceptance
        window.currentTripId = ride.tripId;
    }
}

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// Get address from coordinates using geocoding API
async function getAddressFromCoords(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
        if (response.ok) {
            const data = await response.json();
            return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
    } catch (error) {
        console.error('Error getting address:', error);
    }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

// Start Request Timer
function startRequestTimer() {
    let timeLeft = 30;
    const timerText = document.querySelector('.timer-text');
    const timerProgress = document.querySelector('.timer-progress');
    
    if (timerText && timerProgress) {
        const timerInterval = setInterval(() => {
            timeLeft--;
            timerText.textContent = timeLeft;
            
            // Update progress circle
            const offset = 100 - (timeLeft / 30) * 100;
            timerProgress.style.strokeDashoffset = offset;
            
            // Auto reject when time runs out
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                rejectRide();
            }
        }, 1000);
        
        // Store interval for cleanup
        window.riderDashboard.requestTimer = timerInterval;
    }
}

// Accept Ride
function acceptRide() {
    // Clear timer
    if (window.riderDashboard.requestTimer) {
        clearInterval(window.riderDashboard.requestTimer);
    }
    
    // Hide modal
    hideRideRequestModal();
    
    // Get current ride data
    const rideData = window.riderDashboard.currentRide;
    
    // Show success notification
    showNotification('Ride accepted! Navigate to pickup location', 'success');
    
    // Update earnings
    const fareAmount = parseFloat(rideData.fare.replace('₵', ''));
    window.riderDashboard.earningsData.trips++;
    window.riderDashboard.earningsData.today += fareAmount;
    updateEarningsDisplay();
    
    // Add to activity with proper ride details
    const activityDescription = `Ride accepted - ${rideData.pickupAddress.split(',')[0]} to ${rideData.destinationAddress.split(',')[0]}`;
    addActivityItem('trip', activityDescription);
    
    // In real app, this would:
    // 1. Send acceptance to backend
    // 2. Start navigation to pickup
    // 3. Update passenger status
    // 4. Start ride tracking
    console.log('Ride accepted:', rideData);
}

// Reject Ride
function rejectRide() {
    // Clear timer
    if (window.riderDashboard.requestTimer) {
        clearInterval(window.riderDashboard.requestTimer);
    }
    
    // Hide modal
    hideRideRequestModal();
    
    // Show notification
    showNotification('Ride request rejected', 'info');
    
    // In real app, this would:
    // 1. Send rejection to backend
    // 2. Update passenger status
    // 3. Make rider available for next request
}

// Hide Ride Request Modal
function hideRideRequestModal() {
    const modal = document.getElementById('rideRequestModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Play Notification Sound (placeholder)
function playNotificationSound() {
    // In real app, this would play a sound
    console.log('🔔 Ride request notification sound');
}

// Add Activity Item
function addActivityItem(type, description) {
    const activityList = document.getElementById('recentActivity');
    if (activityList) {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const icon = type === 'trip' ? '🚗' : type === 'earning' ? '💰' : '⭐';
        
        activityItem.innerHTML = `
            <div class="activity-icon">${icon}</div>
            <div class="activity-details">
                <div class="activity-title">${description}</div>
                <div class="activity-time">Just now</div>
            </div>
        `;
        
        // Add to top of list
        activityList.insertBefore(activityItem, activityList.firstChild);
        
        // Remove last item if too many
        const items = activityList.querySelectorAll('.activity-item');
        if (items.length > 10) {
            activityList.removeChild(items[items.length - 1]);
        }
    }
}

// Test Location Permission (for testing)
function testLocationPermission() {
    showNotification('Testing location permission request...', 'info');
    requestLocationPermission();
}

// Start Location Sharing
function startLocationSharing() {
    if (!window.riderDashboard.currentLocation) {
        showNotification('Please enable location first', 'error');
        return;
    }
    
    window.riderDashboard.locationInterval = setInterval(() => {
        // Update location periodically
        navigator.geolocation.getCurrentPosition(
            (position) => {
                window.riderDashboard.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                };
                
                // Update map
                updateMapDisplay();
                
                // Send location to server (in real app)
                sendLocationToServer(window.riderDashboard.currentLocation);
            },
            (error) => {
                console.error('Location update error:', error);
            }
        );
    }, 5000); // Update every 5 seconds
}

// Send Location to Server
function sendLocationToServer(location) {
    // In a real app, this would send the location to your server
    console.log('Sending location to server:', location);
}

// Update Map Display
function updateMapDisplay() {
    const mapDisplay = document.getElementById('mapDisplay');
    if (mapDisplay && window.riderDashboard.currentLocation) {
        mapDisplay.innerHTML = `
            <i class="fas fa-map-marked-alt"></i>
            <h3>Live Location Tracking</h3>
            <p>Lat: ${window.riderDashboard.currentLocation.lat.toFixed(6)}, Lng: ${window.riderDashboard.currentLocation.lng.toFixed(6)}</p>
            <small>Accuracy: ±${window.riderDashboard.currentLocation.accuracy.toFixed(0)}m</small>
        `;
    }
}

// Show GPS Dialog
function showGPSDialog() {
    const dialog = document.getElementById('riderGpsDialog');
    if (dialog) {
        dialog.classList.add('show');
    }
}

// Close GPS Dialog
function closeGPSDialog() {
    const dialog = document.getElementById('riderGpsDialog');
    if (dialog) {
        dialog.classList.remove('show');
    }
}

// Handle Rider GPS Permission
function handleRiderGPSPermission(permission) {
    if (permission === 'denied') {
        showNotification('Location permission denied', 'warning');
    } else {
        startLocationTracking();
        
        if (permission === 'always') {
            localStorage.setItem('k3k3_rider_gps_permission', 'always');
            showNotification('Location permission saved', 'success');
        }
        
        closeGPSDialog();
    }
}

// Load Rider Profile
function loadRiderProfile() {
    const rider = JSON.parse(localStorage.getItem('k3k3_rider') || '{}');
    
    // Update UI with rider data
    const riderIdEl = document.querySelector('.rider-id');
    const riderNameEl = document.querySelector('.rider-details h3');
    
    if (riderIdEl && rider.id) {
        riderIdEl.textContent = rider.id;
    }
    
    if (riderNameEl && rider.name) {
        riderNameEl.textContent = rider.name;
    }
    
    // Load online status
    const savedOnlineStatus = localStorage.getItem('k3k3_rider_online') === 'true';
    window.riderDashboard.isOnline = savedOnlineStatus;
    if (savedOnlineStatus) {
        const toggle = document.getElementById('onlineStatus');
        if (toggle) {
            toggle.checked = true;
            toggleOnlineStatus();
        }
    }
}

// Load Rider Data
function loadRiderData() {
    // Load rider statistics, preferences, etc.
    const stats = JSON.parse(localStorage.getItem('k3k3_rider_stats') || '{}');
    
    // Update statistics
    updateRiderStats(stats);
}

// Update Rider Stats
function updateRiderStats(stats) {
    const ratingEl = document.querySelector('.stat-value');
    const tripsEl = document.querySelectorAll('.stat-value')[1];
    const earningsEl = document.querySelectorAll('.stat-value')[2];
    
    if (ratingEl && stats.rating) {
        ratingEl.textContent = stats.rating;
    }
    
    if (tripsEl && stats.totalTrips) {
        tripsEl.textContent = stats.totalTrips;
    }
    
    if (earningsEl && stats.totalEarnings) {
        earningsEl.textContent = `₵${stats.totalEarnings}`;
    }
}

// Initialize Earnings
function initializeEarnings() {
    updateEarningsDisplay();
}

// Load Earnings Data
function loadEarningsData() {
    const savedEarnings = localStorage.getItem('k3k3_rider_earnings');
    if (savedEarnings) {
        window.riderDashboard.earningsData = JSON.parse(savedEarnings);
        updateEarningsDisplay();
    }
}

// Update Earnings Display
function updateEarningsDisplay() {
    const amountEl = document.querySelector('.earnings-amount');
    const tripEarningsEl = document.querySelectorAll('.earning-value')[0];
    const tipsEl = document.querySelectorAll('.earning-value')[1];
    const bonusEl = document.querySelectorAll('.earning-value')[2];
    
    if (amountEl) {
        amountEl.textContent = `₵${window.riderDashboard.earningsData.today.toFixed(2)}`;
    }
    
    if (tripEarningsEl) {
        const tripEarnings = window.riderDashboard.earningsData.today - window.riderDashboard.earningsData.tips - window.riderDashboard.earningsData.bonus;
        tripEarningsEl.textContent = `₵${tripEarnings.toFixed(2)}`;
    }
    
    if (tipsEl) {
        tipsEl.textContent = `₵${window.riderDashboard.earningsData.tips.toFixed(2)}`;
    }
    
    if (bonusEl) {
        bonusEl.textContent = `₵${window.riderDashboard.earningsData.bonus.toFixed(2)}`;
    }
    
    // Save to localStorage
    localStorage.setItem('k3k3_rider_earnings', JSON.stringify(window.riderDashboard.earningsData));
}

// Load Recent Activity
function loadRecentActivity() {
    const activities = [
        { type: 'trip', title: 'Completed ride - Airport to City', time: '2 hours ago' },
        { type: 'earning', title: 'Received tip - ₵5.00', time: '3 hours ago' },
        { type: 'rating', title: 'New rating - 5.0 stars', time: '5 hours ago' },
        { type: 'trip', title: 'Completed ride - Market to University', time: '6 hours ago' },
        { type: 'earning', title: 'Daily bonus - ₵10.00', time: '8 hours ago' }
    ];
    
    const activityList = document.querySelector('.activity-list');
    if (activityList) {
        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas fa-${getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }
}

// Get Activity Icon
function getActivityIcon(type) {
    const icons = {
        'trip': 'car',
        'earning': 'money-bill-wave',
        'rating': 'star'
    };
    
    return icons[type] || 'circle';
}

// Add Activity Item
function addActivityItem(type, title) {
    const activityList = document.querySelector('.activity-list');
    if (activityList) {
        const newActivity = document.createElement('div');
        newActivity.className = 'activity-item';
        newActivity.innerHTML = `
            <div class="activity-icon ${type}">
                <i class="fas fa-${getActivityIcon(type)}"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${title}</div>
                <div class="activity-time">Just now</div>
            </div>
        `;
        
        activityList.insertBefore(newActivity, activityList.firstChild);
        
        // Remove last item if too many
        const items = activityList.querySelectorAll('.activity-item');
        if (items.length > 10) {
            activityList.removeChild(items[items.length - 1]);
        }
    }
}

// Quick Actions
function startNewTrip() {
    if (!window.riderDashboard.isOnline) {
        showNotification('Please go online first to accept rides', 'warning');
        return;
    }
    
    showNotification('You are now available for new rides', 'success');
}

function viewEarnings() {
    showNotification('Opening detailed earnings report...', 'info');
    // Implement earnings modal or redirect
}

function viewSchedule() {
    showNotification('Opening schedule...', 'info');
    // Implement schedule modal or redirect
}

function viewProfile() {
    window.location.href = 'profile.html';
}

function applyToAdmin() {
    showNotification('Opening admin application...', 'info');
    // Implement admin application modal
}

function viewAnalytics() {
    showNotification('Opening rider analytics...', 'info');
    // Implement analytics modal or redirect
}

// Show Notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 350px;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Get Notification Color
function getNotificationColor(type) {
    const colors = {
        'success': '#10b981',
        'error': '#ef4444',
        'info': '#3b82f6',
        'warning': '#f59e0b'
    };
    
    return colors[type] || '#3b82f6';
}

// Get Notification Icon
function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'info': 'info-circle',
        'warning': 'exclamation-triangle'
    };
    
    return icons[type] || 'info-circle';
}

// Handle Logout
function handleLogout() {
    closeMainMenu();
    
    // Show professional confirmation
    if (confirm('Are you sure you want to logout?')) {
        // Get rider name for goodbye message
        const rider = JSON.parse(localStorage.getItem('k3k3_rider') || '{}');
        const riderName = rider.name || rider.firstName || 'Driver';
        
        // Clear rider session
        localStorage.removeItem('k3k3_rider');
        localStorage.removeItem('k3k3_rider_token');
        localStorage.removeItem('k3k3_rider_online');
        
        // Show professional logout notification
        showNotification(`Goodbye ${riderName}! You have been successfully logged out.`, 'info');
        
        // Redirect to login after delay
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1500);
    }
}

// Export functions for global access
window.toggleOnlineStatus = toggleOnlineStatus;
window.toggleLocationSharing = toggleLocationSharing;
window.handleRiderGPSPermission = handleRiderGPSPermission;
window.startNewTrip = startNewTrip;
window.viewEarnings = viewEarnings;
window.viewSchedule = viewSchedule;
window.viewProfile = viewProfile;
window.applyToAdmin = applyToAdmin;
window.viewAnalytics = viewAnalytics;
window.handleLogout = handleLogout;
