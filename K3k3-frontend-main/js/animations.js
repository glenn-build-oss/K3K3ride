// K3K3 MVP Animations JavaScript

// Animation Utilities
class K3K3Animations {
    constructor() {
        this.observers = new Map();
        this.init();
    }

    init() {
        this.setupIntersectionObserver();
        this.setupCountUpAnimations();
        this.setupParallaxEffects();
        this.setupHoverEffects();
    }

    // Intersection Observer for scroll animations
    setupIntersectionObserver() {
        const options = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        this.observers.set('scroll', new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateElement(entry.target);
                }
            });
        }, options));

        // Observe elements with animation classes
        const animatedElements = document.querySelectorAll('.animate-on-scroll, .feature-card, .stat-item');
        animatedElements.forEach(element => {
            this.observers.get('scroll').observe(element);
        });
    }

    // Animate individual element
    animateElement(element) {
        element.classList.add('animated');
        
        // Add specific animation based on element class
        if (element.classList.contains('fade-in-up')) {
            this.fadeInUp(element);
        } else if (element.classList.contains('fade-in-left')) {
            this.fadeInLeft(element);
        } else if (element.classList.contains('fade-in-right')) {
            this.fadeInRight(element);
        } else if (element.classList.contains('scale-in')) {
            this.scaleIn(element);
        } else {
            this.fadeIn(element);
        }
    }

    // Fade In Animation
    fadeIn(element, duration = 600) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 100);
    }

    // Fade In Up Animation
    fadeInUp(element, duration = 600) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(40px)';
        
        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 100);
    }

    // Fade In Left Animation
    fadeInLeft(element, duration = 600) {
        element.style.opacity = '0';
        element.style.transform = 'translateX(-40px)';
        
        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        }, 100);
    }

    // Fade In Right Animation
    fadeInRight(element, duration = 600) {
        element.style.opacity = '0';
        element.style.transform = 'translateX(40px)';
        
        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        }, 100);
    }

    // Scale In Animation
    scaleIn(element, duration = 600) {
        element.style.opacity = '0';
        element.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
        }, 100);
    }

    // Count Up Animation
    setupCountUpAnimations() {
        const countElements = document.querySelectorAll('[data-count]');
        
        countElements.forEach(element => {
            const target = parseFloat(element.getAttribute('data-count'));
            const duration = 2000;
            const isDecimal = target % 1 !== 0;
            
            this.animateCount(element, target, duration, isDecimal);
        });
    }

    animateCount(element, target, duration, isDecimal = false) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const updateCount = () => {
            current += increment;
            
            if (current < target) {
                if (isDecimal) {
                    element.textContent = current.toFixed(1);
                } else {
                    element.textContent = Math.floor(current).toLocaleString();
                }
                requestAnimationFrame(updateCount);
            } else {
                if (isDecimal) {
                    element.textContent = target.toFixed(1);
                } else {
                    element.textContent = target.toLocaleString();
                }
            }
        };
        
        // Start animation when element is in viewport
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateCount();
                    observer.unobserve(element);
                }
            });
        });
        
        observer.observe(element);
    }

    // Parallax Effects
    setupParallaxEffects() {
        const parallaxElements = document.querySelectorAll('.parallax');
        
        if (parallaxElements.length === 0) return;
        
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach(element => {
                const speed = element.getAttribute('data-speed') || 0.5;
                const yPos = -(scrolled * speed);
                
                element.style.transform = `translateY(${yPos}px)`;
            });
        });
    }

    // Hover Effects
    setupHoverEffects() {
        // Button hover effects
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            this.setupButtonHover(button);
        });

        // Card hover effects
        const cards = document.querySelectorAll('.feature-card, .stat-item');
        cards.forEach(card => {
            this.setupCardHover(card);
        });
    }

    setupButtonHover(button) {
        button.addEventListener('mouseenter', (e) => {
            this.createButtonRipple(e, button);
        });
    }

    setupCardHover(card) {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px) scale(1.02)';
            card.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
            card.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
    }

    // Button Ripple Effect
    createButtonRipple(e, button) {
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        `;

        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    // Loading Animation
    showLoading(element, message = 'Loading...') {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: 8px;
        `;
        
        element.style.position = 'relative';
        element.appendChild(loadingOverlay);
    }

    hideLoading(element) {
        const loadingOverlay = element.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    // Progress Animation
    animateProgress(element, target, duration = 1000) {
        element.style.width = '0%';
        
        setTimeout(() => {
            element.style.transition = `width ${duration}ms ease`;
            element.style.width = `${target}%`;
        }, 100);
    }

    // Typing Animation
    typeText(element, text, speed = 50) {
        let index = 0;
        element.textContent = '';
        
        const typeChar = () => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(typeChar, speed);
            }
        };
        
        typeChar();
    }

    // Shake Animation (for errors)
    shake(element) {
        element.style.animation = 'shake 0.5s';
        
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    // Pulse Animation
    pulse(element, duration = 2000) {
        element.style.animation = `pulse ${duration}ms infinite`;
    }

    // Stop Pulse
    stopPulse(element) {
        element.style.animation = '';
    }
}

// CSS Animations
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .loading-spinner {
        text-align: center;
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #000;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
    }
    
    .loading-text {
        color: #666;
        font-weight: 500;
    }
    
    .animated {
        opacity: 1;
        transform: none;
    }
`;

document.head.appendChild(style);

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.K3K3Animations = new K3K3Animations();
});

// Export for global access
window.K3K3Animations = K3K3Animations;
