// K3K3 Storage Utilities
// Helper functions for localStorage management

class StorageUtils {
    // Save data to localStorage
    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    // Get data from localStorage
    static get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    }

    // Remove data from localStorage
    static remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
    }

    // Clear all localStorage
    static clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }

    // Check if key exists
    static exists(key) {
        return localStorage.getItem(key) !== null;
    }

    // Get all keys
    static getAllKeys() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                keys.push(localStorage.key(i));
            }
            return keys;
        } catch (error) {
            console.error('Error getting localStorage keys:', error);
            return [];
        }
    }

    // Admin specific methods
    static saveAdminData(adminData, token) {
        this.set('adminToken', token);
        this.set('adminData', adminData);
    }

    static getAdminData() {
        return this.get('adminData');
    }

    static getAdminToken() {
        return this.get('adminToken');
    }

    static clearAdminData() {
        this.remove('adminToken');
        this.remove('adminData');
    }

    // Session management
    static isSessionValid() {
        const token = this.getAdminToken();
        return token && token !== null;
    }

    static logout() {
        this.clearAdminData();
        window.location.href = '../index.html';
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageUtils;
}
