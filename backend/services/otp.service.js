/**
 * K3K3 Backend — OTP Service (In-Memory)
 * 
 * Generates, stores, and verifies 6-digit OTP codes.
 * Uses crypto.randomInt for cryptographically secure random digits.
 * OTPs are stored in memory (Map) — will be replaced with database later.
 */

const crypto = require('crypto');

// In-memory OTP store: Map<phone, { code, purpose, expiresAt, used }>
const otpStore = new Map();

// Config from env
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH) || 6;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;

/**
 * Generate a cryptographically random 6-digit OTP code.
 * @returns {string} 6-digit code, e.g. "482913"
 */
function generateOTP() {
  // Generate each digit using crypto.randomInt (0-9)
  let code = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

/**
 * Store an OTP for a phone number.
 * Invalidates any previous unused OTP for the same phone.
 * 
 * @param {string} phone - Normalized phone (+233XXXXXXXXX)
 * @param {string} code - The 6-digit OTP
 * @param {string} purpose - 'login' | 'signup' | 'verify'
 * @returns {object} { code, expiresAt }
 */
function storeOTP(phone, code, purpose = 'login') {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  otpStore.set(phone, {
    code,
    purpose,
    expiresAt,
    used: false,
    createdAt: new Date()
  });

  console.log(`[OTP] Stored for ${phone}: ${code} (expires: ${expiresAt.toISOString()}, purpose: ${purpose})`);

  return { code, expiresAt };
}

/**
 * Verify an OTP code for a phone number.
 * 
 * @param {string} phone - Normalized phone
 * @param {string} code - The OTP to verify
 * @returns {object} { valid: boolean, error?: string }
 */
function verifyOTP(phone, code) {
  const entry = otpStore.get(phone);

  if (!entry) {
    return { valid: false, error: 'No OTP found. Please request a new code.' };
  }

  if (entry.used) {
    return { valid: false, error: 'This code has already been used. Please request a new one.' };
  }

  if (new Date() > entry.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, error: 'Code has expired. Please request a new one.' };
  }

  if (entry.code !== code) {
    return { valid: false, error: 'Invalid code. Please check and try again.' };
  }

  // Mark as used
  entry.used = true;
  otpStore.set(phone, entry);

  console.log(`[OTP] Verified successfully for ${phone}`);

  return { valid: true };
}

/**
 * Clean up expired OTPs from memory.
 * Called periodically to prevent memory leaks.
 */
function cleanupExpiredOTPs() {
  const now = new Date();
  let cleaned = 0;

  for (const [phone, entry] of otpStore.entries()) {
    // Remove if expired for more than 10 minutes or already used
    const expiredThreshold = new Date(entry.expiresAt.getTime() + 10 * 60 * 1000);
    if (now > expiredThreshold || entry.used) {
      otpStore.delete(phone);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[OTP] Cleaned up ${cleaned} expired/used entries. Active: ${otpStore.size}`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

/**
 * Get OTP stats (for admin/debugging).
 * @returns {object} { activeCount, entries }
 */
function getOTPStats() {
  const now = new Date();
  const entries = [];

  for (const [phone, entry] of otpStore.entries()) {
    entries.push({
      phone: phone.replace(/(\+233)\d{5}(\d{4})/, '$1*****$2'),
      purpose: entry.purpose,
      used: entry.used,
      expired: now > entry.expiresAt,
      createdAt: entry.createdAt
    });
  }

  return { activeCount: otpStore.size, entries };
}

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  cleanupExpiredOTPs,
  getOTPStats
};
