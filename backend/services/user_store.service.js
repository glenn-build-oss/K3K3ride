/**
 * K3K3 Backend — User Store Service
 * 
 * Provides persistent storage and retrieval for passengers and riders
 * with file-based persistence in backend/data/users.json and optional Supabase sync.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

class UserStoreService {
  constructor() {
    this.users = this.loadUsers();
  }

  loadUsers() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[UserStore] Could not read users.json, initializing empty:', err.message);
    }
    return [];
  }

  saveUsers() {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (err) {
      console.error('[UserStore] Error writing users.json:', err.message);
    }
  }

  getUserById(userId) {
    if (!userId) return null;
    const clean = String(userId).trim().toLowerCase();
    return this.users.find(u => String(u.id).toLowerCase() === clean) || null;
  }

  getUserByPhone(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    const last9 = digits.slice(-9);
    return this.users.find(u => {
      const uDigits = String(u.phone || '').replace(/\D/g, '');
      return uDigits.endsWith(last9);
    }) || null;
  }

  getUserByEmail(email) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    return this.users.find(u => String(u.email || '').toLowerCase() === clean) || null;
  }

  upsertUser(userData) {
    const existingIndex = this.users.findIndex(u => 
      (userData.id && String(u.id) === String(userData.id)) ||
      (userData.phone && String(u.phone).replace(/\D/g, '').endsWith(String(userData.phone).replace(/\D/g, '').slice(-9)))
    );

    const now = new Date().toISOString();
    const defaults = {
      settings: {
        language: 'en',
        notifRideUpdates: true,
        notifDriverAlerts: true,
        notifPromotions: false,
        privacyLocation: true,
        privacyTripHistory: true
      },
      created_at: now,
      updated_at: now
    };

    if (existingIndex >= 0) {
      const merged = {
        ...this.users[existingIndex],
        ...userData,
        settings: {
          ...(this.users[existingIndex].settings || defaults.settings),
          ...(userData.settings || {})
        },
        updated_at: now
      };
      this.users[existingIndex] = merged;
      this.saveUsers();
      return merged;
    } else {
      const newUser = {
        ...defaults,
        ...userData,
        id: userData.id || ('usr_' + require('crypto').randomBytes(6).toString('hex')),
        created_at: now,
        updated_at: now
      };
      this.users.unshift(newUser);
      this.saveUsers();
      return newUser;
    }
  }

  updateProfile(userId, profileData = {}) {
    let user = this.getUserById(userId);
    if (!user && profileData.phone) {
      user = this.getUserByPhone(profileData.phone);
    }
    if (!user) {
      // Create profile if doesn't exist yet
      user = this.upsertUser({
        id: userId,
        phone: profileData.phone || '',
        first_name: profileData.fname || profileData.first_name || '',
        last_name: profileData.lname || profileData.last_name || '',
        email: profileData.email || '',
        role: 'passenger'
      });
    }

    const fname = profileData.fname !== undefined ? profileData.fname : (profileData.first_name !== undefined ? profileData.first_name : user.first_name);
    const lname = profileData.lname !== undefined ? profileData.lname : (profileData.last_name !== undefined ? profileData.last_name : user.last_name);
    const fullName = `${fname || ''} ${lname || ''}`.trim() || user.full_name || 'Passenger';

    user.first_name = fname || '';
    user.last_name = lname || '';
    user.full_name = fullName;
    user.fname = fname || '';
    user.lname = lname || '';
    user.name = fullName;

    if (profileData.phone) user.phone = profileData.phone;
    if (profileData.email !== undefined) user.email = profileData.email.toLowerCase().trim();
    if (profileData.emergency_name !== undefined) user.emergency_name = profileData.emergency_name;
    if (profileData.emergency_phone !== undefined) user.emergency_phone = profileData.emergency_phone;

    user.updated_at = new Date().toISOString();
    this.saveUsers();
    return user;
  }

  updateSettings(userId, settingsData = {}) {
    let user = this.getUserById(userId);
    if (!user) {
      user = this.upsertUser({ id: userId });
    }

    user.settings = {
      ...(user.settings || {
        language: 'en',
        notifRideUpdates: true,
        notifDriverAlerts: true,
        notifPromotions: false,
        privacyLocation: true,
        privacyTripHistory: true
      }),
      ...settingsData
    };

    user.updated_at = new Date().toISOString();
    this.saveUsers();
    return user.settings;
  }

  verifyPassword(user, password) {
    if (!user.password_hash) {
      // If user registered with OTP and hasn't set a password yet, accept initial password setup
      return true;
    }
    return bcrypt.compareSync(password, user.password_hash);
  }

  setPassword(userId, newPassword) {
    let user = this.getUserById(userId);
    if (!user) return { success: false, error: 'User not found' };

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    const salt = bcrypt.genSaltSync(10);
    user.password_hash = bcrypt.hashSync(newPassword, salt);
    user.updated_at = new Date().toISOString();
    this.saveUsers();
    return { success: true, user };
  }
}

module.exports = new UserStoreService();
