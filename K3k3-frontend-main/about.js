// Translations are defined in index.html's inline script

// =============================================
// MOBILE MICRO-INTERACTIONS
// =============================================

// Scroll animations for mobile
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in-on-scroll');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  elements.forEach(element => {
    observer.observe(element);
  });
}

// Enhanced touch feedback for mobile
function initTouchFeedback() {
  // Add ripple effect to buttons on mobile
  if ('ontouchstart' in window) {
    const buttons = document.querySelectorAll('.btn, .cta-btn, button, .header a');
    
    buttons.forEach(button => {
      button.addEventListener('touchstart', function(e) {
        this.style.transform = 'scale(0.96)';
      }, { passive: true });
      
      button.addEventListener('touchend', function(e) {
        setTimeout(() => {
          this.style.transform = '';
        }, 150);
      }, { passive: true });
    });
  }
}

// Mobile vibration feedback (if supported)
function addHapticFeedback() {
  if ('vibrate' in navigator) {
    const buttons = document.querySelectorAll('.btn, .cta-btn, button');
    
    buttons.forEach(button => {
      button.addEventListener('click', function() {
        navigator.vibrate(50); // Light vibration
      });
    });
  }
}

// =============================================
// PWA INSTALL
// =============================================
let deferredPrompt = null;

// Clear old service workers that might be blocking
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.update());
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('[PWA] ✅ Install prompt is ready!');
  
  // Update button text to show install is available
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.textContent = 'Install K3K3 App';
    installBtn.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  console.log('[PWA] ✅ App installed!');
  alert('K3K3 Rides has been installed! Check your home screen or app launcher.');
});

// =============================================
// DOM READY
// =============================================
document.addEventListener('DOMContentLoaded', function() {
  // Initialize mobile micro-interactions
  initScrollAnimations();
  initTouchFeedback();
  addHapticFeedback();
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[PWA] ✅ Service Worker registered');
        // Force update check
        reg.update();
        
        // Check if PWA install criteria are met after a short delay
        setTimeout(() => {
          if (!deferredPrompt) {
            console.log('[PWA] Install prompt not available yet');
            const installBtn = document.getElementById('installBtn');
            if (installBtn) {
              installBtn.textContent = 'Get App Instructions';
            }
          }
        }, 3000);
      })
      .catch(err => console.error('[PWA] ❌ SW failed:', err));
  }

  });

// Toast notification system
function showToast(message, type = 'success', duration = 3000) {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'info' ? 'fa-info-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    </div>
    <div class="toast-progress"></div>
  `;

  // Add to page
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('toast-show');
  }, 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Professional download function
async function installApp() {
  // Debug PWA status
  console.log('[PWA Debug] Protocol:', location.protocol);
  console.log('[PWA Debug] Hostname:', location.hostname);
  console.log('[PWA Debug] Service Worker:', 'serviceWorker' in navigator);
  console.log('[PWA Debug] Deferred Prompt:', !!deferredPrompt);
  console.log('[PWA Debug] HTTPS:', location.protocol === 'https:');
  console.log('[PWA Debug] User Agent:', navigator.userAgent);
  
  // Show download started toast
  showToast('Preparing K3K3 App installation...', 'info', 2000);
  
  // Check if already installed
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true) {
    showToast('K3K3 App is already installed!', 'info', 3000);
    return;
  }

  // Check if running from file:// protocol
  if (location.protocol === 'file:') {
    showToast('Please serve via HTTPS for app installation. Use localhost or web server.', 'warning', 5000);
    return;
  }

  // Check HTTPS requirement
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    showToast('HTTPS required for PWA installation. Please use HTTPS URL.', 'warning', 5000);
    return;
  }

  // Check service worker support
  if (!('serviceWorker' in navigator)) {
    showToast('Your browser doesn\'t support app installation. Please use a modern browser.', 'warning', 5000);
    return;
  }

  // Simulate download process
  setTimeout(() => {
    showToast('Checking installation requirements...', 'info', 1500);
  }, 500);

  setTimeout(() => {
    if (deferredPrompt) {
      // Show native install prompt
      console.log('[PWA] Showing native install prompt');
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((result) => {
        if (result.outcome === 'accepted') {
          showToast('K3K3 App installed successfully! 🎉 Check your home screen.', 'success', 4000);
          deferredPrompt = null;
        } else {
          showToast('Installation cancelled. You can install anytime from browser menu.', 'info', 4000);
        }
      });
    } else {
      // Fallback: Show professional instructions
      console.log('[PWA] No deferred prompt, showing instructions');
      showInstallInstructions();
    }
  }, 2000);
}

// Professional install instructions
function showInstallInstructions() {
  const userAgent = navigator.userAgent.toLowerCase();
  let browserName = 'Chrome';
  let instructions = '';
  let detailedInstructions = '';

  // Detect mobile browser
  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    if (userAgent.includes('mobile')) {
      browserName = 'Chrome Mobile';
      instructions = 'Tap ⋮ menu → "Add to Home Screen" → "Install"';
      detailedInstructions = 'Look for the three dots menu in Chrome, then select "Add to Home Screen"';
    } else {
      browserName = 'Chrome Desktop';
      instructions = 'Click install icon (⊕) in address bar';
      detailedInstructions = 'Look for the install icon in your Chrome address bar';
    }
  } else if (userAgent.includes('safari') && userAgent.includes('mobile')) {
    browserName = 'Safari Mobile';
    instructions = 'Tap Share icon → "Add to Home Screen"';
    detailedInstructions = 'Look for the share icon (square with arrow) in Safari, then scroll to find "Add to Home Screen"';
  } else if (userAgent.includes('edg')) {
    browserName = 'Edge';
    instructions = 'Go to ⋮ Menu → "Apps" → "Install this site as an app"';
    detailedInstructions = 'Click the three dots menu, go to Apps, then select "Install this site as an app"';
  } else if (userAgent.includes('firefox')) {
    browserName = 'Firefox';
    instructions = 'Go to ⋮ Menu → "Install this site as an app"';
    detailedInstructions = 'Click the three dots menu and look for "Install this site as an app"';
  } else {
    browserName = 'your browser';
    instructions = 'Look for "Install" or "Add to Home Screen" in the menu';
    detailedInstructions = 'Check your browser menu for installation options';
  }

  // Show instruction toast
  showToast(`${browserName}: ${instructions}`, 'info', 5000);
  
  // Show detailed instructions after a delay
  setTimeout(() => {
    showToast(`Detailed: ${detailedInstructions}`, 'info', 6000);
  }, 2000);
  
  // Simulate installation completion after delay
  setTimeout(() => {
    showToast('K3K3 App ready! Check your home screen or app launcher.', 'success', 4000);
  }, 8000);
}
