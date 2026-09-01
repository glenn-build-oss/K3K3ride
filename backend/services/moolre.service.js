/**
 * K3K3 Backend — Moolre SMS Service
 * 
 * Integrates with Moolre SMS API to send OTP verification codes.
 * API Docs: https://docs.moolre.com
 * 
 * Endpoints used:
 *   POST /open/sms/send     — Send SMS (requires X-API-VASKEY)
 *   POST /open/sms/status   — Check delivery status
 *   POST /open/sms/status   — Check SMS credit balance (type: 2)
 */

const MOOLRE_SMS_URL = process.env.MOOLRE_SMS_URL || 'https://api.moolre.com/open/sms/send';
const MOOLRE_SMS_VAS_KEY = process.env.MOOLRE_SMS_VAS_KEY;
const MOOLRE_SENDER_ID = process.env.MOOLRE_SENDER_ID || 'K3K3ride';

/**
 * Send an SMS message via Moolre API.
 * 
 * @param {string} recipient - Phone number in format 233XXXXXXXXX (no +)
 * @param {string} message - SMS text content (max 160 chars recommended)
 * @param {string} [ref] - Optional unique reference for tracking delivery
 * @returns {Promise<object>} { success, data, error }
 */
async function sendSMS(recipient, message, ref) {
  if (!MOOLRE_SMS_VAS_KEY) {
    console.error('[Moolre] ERROR: MOOLRE_SMS_VAS_KEY not set in .env');
    return { success: false, error: 'SMS service not configured. Missing VAS key.' };
  }

  // Strip '+' from phone if present: +233... → 233...
  const cleanRecipient = recipient.replace(/^\+/, '');

  // Generate ref if not provided
  const msgRef = ref || `otp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    type: 1,
    senderid: MOOLRE_SENDER_ID,
    messages: [
      {
        recipient: cleanRecipient,
        message: message,
        ref: msgRef
      }
    ]
  };

  console.log(`[Moolre] Sending SMS to ${cleanRecipient} via ${MOOLRE_SMS_URL}`);
  console.log(`[Moolre] Sender ID: ${MOOLRE_SENDER_ID}`);
  console.log(`[Moolre] Message: ${message}`);
  console.log(`[Moolre] Ref: ${msgRef}`);

  try {
    const response = await fetch(MOOLRE_SMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': MOOLRE_SMS_VAS_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log(`[Moolre] Response:`, JSON.stringify(data, null, 2));

    // Check Moolre response format
    if (data.status === 1 && data.code === 'SMS01') {
      console.log(`[Moolre] ✅ SMS sent successfully to ${cleanRecipient}`);
      return { success: true, data, ref: msgRef };
    }

    // Handle known error codes
    if (data.code === 'ASMS07') {
      console.error(`[Moolre] ❌ Sender ID "${MOOLRE_SENDER_ID}" is not approved`);
      return { success: false, error: 'SMS Sender ID not approved. Contact admin.', data };
    }

    if (data.code === 'AIN01') {
      console.error(`[Moolre] ❌ Authentication failed — invalid VAS key`);
      return { success: false, error: 'SMS authentication failed. Check API key.', data };
    }

    // Generic failure
    console.error(`[Moolre] ❌ SMS failed:`, data.message || 'Unknown error');
    return { success: false, error: data.message || 'Failed to send SMS', data };

  } catch (err) {
    console.error(`[Moolre] ❌ Network error:`, err.message);
    return { success: false, error: `SMS service unavailable: ${err.message}` };
  }
}

/**
 * Send an OTP verification SMS.
 * Constructs the standard K3K3 OTP message format.
 * 
 * @param {string} phone - Normalized phone (+233XXXXXXXXX)
 * @param {string} otpCode - The 6-digit OTP
 * @returns {Promise<object>} { success, ref, error }
 */
async function sendOTP(phone, otpCode) {
  const message = `K3K3: Your verification code is ${otpCode}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 5} minutes. Do not share this code.`;
  return sendSMS(phone, message);
}

/**
 * Check SMS delivery status.
 * 
 * @param {string[]} refs - Array of message references to check
 * @returns {Promise<object>} { success, statuses }
 */
async function checkSMSStatus(refs) {
  if (!MOOLRE_SMS_VAS_KEY) {
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const response = await fetch(`${MOOLRE_SMS_URL.replace('/send', '/status')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': MOOLRE_SMS_VAS_KEY
      },
      body: JSON.stringify({
        type: 5,
        ref: refs
      })
    });

    const data = await response.json();

    if (data.status === 1) {
      return { success: true, statuses: data.data };
    }

    return { success: false, error: data.message, data };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check SMS credit balance.
 * 
 * @returns {Promise<object>} { success, balance }
 */
async function checkSMSBalance() {
  if (!MOOLRE_SMS_VAS_KEY) {
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const response = await fetch(`${MOOLRE_SMS_URL.replace('/send', '/status')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': MOOLRE_SMS_VAS_KEY
      },
      body: JSON.stringify({ type: 2 })
    });

    const data = await response.json();

    if (data.status === 1 && data.data && data.data.balance !== undefined) {
      console.log(`[Moolre] SMS Balance: ${data.data.balance} credits`);
      return { success: true, balance: data.data.balance };
    }

    return { success: false, error: data.message, data };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check Sender ID approval status.
 * 
 * @param {string} senderId - Sender ID to check
 * @returns {Promise<object>} { success, approval }
 */
async function checkSenderIdStatus(senderId) {
  if (!MOOLRE_SMS_VAS_KEY) {
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const response = await fetch(`${MOOLRE_SMS_URL.replace('/send', '/status')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': MOOLRE_SMS_VAS_KEY
      },
      body: JSON.stringify({
        type: 1,
        senderid: senderId || MOOLRE_SENDER_ID
      })
    });

    const data = await response.json();

    if (data.status === 1 && data.data) {
      console.log(`[Moolre] Sender ID "${data.data.senderid}" — ${data.data.approval}`);
      return { success: true, ...data.data };
    }

    return { success: false, error: data.message, data };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendSMS,
  sendOTP,
  checkSMSStatus,
  checkSMSBalance,
  checkSenderIdStatus
};
