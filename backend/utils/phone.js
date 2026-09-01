/**
 * K3K3 Backend — Phone Number Normalization
 * 
 * All Ghana phone numbers are normalized to +233XXXXXXXXX format.
 * Accepts: "024 123 4567", "0241234567", "+233241234567", "233241234567"
 * Output:  "+233241234567"
 */

/**
 * Normalize a Ghana phone number to +233XXXXXXXXX format.
 * @param {string} phone - Raw phone input
 * @returns {string} Normalized phone number
 * @throws {Error} If phone number is invalid
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required');
  }

  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle different formats
  if (digits.startsWith('233') && digits.length >= 12) {
    // Already has country code: 233241234567
    digits = digits.substring(0, 12);
  } else if (digits.startsWith('0') && digits.length >= 10) {
    // Local format: 0241234567 → 233241234567
    digits = '233' + digits.substring(1);
  } else if (digits.length >= 9 && digits.length <= 10 && !digits.startsWith('0') && !digits.startsWith('233')) {
    // No prefix: 241234567 → 233241234567
    digits = '233' + digits;
  } else {
    throw new Error('Invalid Ghana phone number format. Expected: 024 123 4567 or 0241234567');
  }

  // Validate final format: must be exactly 12 digits (233 + 9 digits)
  if (digits.length !== 12) {
    throw new Error('Invalid phone number length. Ghana numbers should be 10 digits (e.g. 024 123 4567)');
  }

  // Validate Ghana mobile prefixes (02X, 03X, 05X)
  const localPart = digits.substring(3); // 241234567
  const prefix = localPart.substring(0, 2);
  const validPrefixes = ['20', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '50', '53', '54', '55', '56', '57', '58', '59'];

  if (!validPrefixes.includes(prefix)) {
    throw new Error(`Invalid Ghana mobile number prefix: 0${prefix}. Expected a valid mobile prefix.`);
  }

  return '+' + digits;
}

/**
 * Format phone for display: +233 24 123 4567
 * @param {string} phone - Normalized +233XXXXXXXXX format
 * @returns {string} Display-formatted phone
 */
function formatPhoneDisplay(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('233')) {
    const local = digits.substring(3);
    return `+233 ${local.substring(0, 2)} ${local.substring(2, 5)} ${local.substring(5)}`;
  }
  return phone;
}

/**
 * Mask phone for privacy: +233 ** *** **67
 * @param {string} phone - Normalized phone
 * @returns {string} Masked phone
 */
function maskPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    const last4 = digits.slice(-4);
    return `****${last4}`;
  }
  return '****';
}

module.exports = { normalizePhone, formatPhoneDisplay, maskPhone };
