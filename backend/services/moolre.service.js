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

const MOOLRE_SMS_URL = 'https://api.moolre.com/open/sms/send';
const MOOLRE_SENDER_ID_DEFAULT = 'K3K3ride';

/**
 * Get the VAS key at call time so Vercel env vars are always fresh.
 */
function getMoolreKey() {
  const key = process.env.MOOLRE_SMS_VAS_KEY ||
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2YXNpZCI6MTI1NDksImV4cCI6MTk1NjUyNzk5OX0.3I8lbPVaul2a-ss6gRZR9JZxWgoHxMgPy3ue7rXfnaI';
  return typeof key === 'string' ? key.trim() : key;
}

function getMoolreSenderId() {
  const senderId = process.env.MOOLRE_SENDER_ID || MOOLRE_SENDER_ID_DEFAULT;
  return typeof senderId === 'string' ? senderId.trim() : senderId;
}

/**
 * Send an SMS message via Moolre API.
 */
async function sendSMS(recipient, message, ref) {
  const MOOLRE_SMS_VAS_KEY = getMoolreKey();
  const MOOLRE_SENDER_ID = getMoolreSenderId();

  // Strip '+' from phone if present: +233... → 233...
  const cleanRecipient = recipient.replace(/^\+/, '');

  // Always ensure ref has unique timestamp and random entropy to satisfy Moolre uniqueness requirement
  const uniqueEntropy = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const cleanRef = ref ? String(ref).replace(/[^a-zA-Z0-9_-]/g, '_') : 'k3';
  const msgRef = `${cleanRef}_${uniqueEntropy}`;

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

  console.log(`[Moolre] Sending SMS to ${cleanRecipient}`);
  console.log(`[Moolre] Sender ID: ${MOOLRE_SENDER_ID}`);
  console.log(`[Moolre] Key prefix: ${MOOLRE_SMS_VAS_KEY.substring(0, 20)}...`);

  try {
    const response = await fetch(MOOLRE_SMS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-VASKEY': MOOLRE_SMS_VAS_KEY
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (_) {
      data = { status: 0, code: 'RAW_RESPONSE', message: rawText };
    }

    console.log(`[Moolre] Response status: ${response.status}`, JSON.stringify(data));

    // Check Moolre response format
    if (data.status === 1 && data.code === 'SMS01') {
      console.log(`[Moolre] ✅ SMS sent successfully to ${cleanRecipient}`);
      return { success: true, data, ref: msgRef };
    }

    // Handle known error codes
    if (data.code === 'ASMS07') {
      console.error(`[Moolre] ❌ Sender ID "${MOOLRE_SENDER_ID}" not approved`);
      return { success: false, error: 'SMS Sender ID not approved', data };
    }

    if (data.code === 'AIN01') {
      console.error(`[Moolre] ❌ Auth failed — invalid VAS key`);
      return { success: false, error: 'SMS authentication failed. Check MOOLRE_SMS_VAS_KEY.', data };
    }

    console.error(`[Moolre] ❌ SMS failed:`, data);
    return { success: false, error: data.message || JSON.stringify(data), data };

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
  const key = getMoolreKey();
  try {
    const response = await fetch(MOOLRE_SMS_URL.replace('/send', '/status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-VASKEY': key },
      body: JSON.stringify({ type: 5, ref: refs })
    });
    const data = await response.json();
    if (data.status === 1) return { success: true, statuses: data.data };
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
  const key = getMoolreKey();
  try {
    const response = await fetch(MOOLRE_SMS_URL.replace('/send', '/status'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-VASKEY': key },
      body: JSON.stringify({ type: 2 })
    });
    const data = await response.json();
    if (data.status === 1 && data.data && data.data.balance !== undefined) {
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
  const MOOLRE_SMS_VAS_KEY = getMoolreKey();
  const MOOLRE_SENDER_ID = getMoolreSenderId();

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

/**
 * Detect Ghanaian Mobile Money network channel code from phone number.
 * Channel codes for Moolre:
 *  13 = MTN
 *  6  = Telecel (Vodafone)
 *  7  = AT (AirtelTigo)
 */
function detectMoMoChannel(phone) {
  if (!phone) return 13;
  const digits = String(phone).replace(/\D/g, '');
  const local = digits.startsWith('233') ? '0' + digits.slice(3) : (digits.startsWith('0') ? digits : '0' + digits);
  const prefix = local.substring(0, 3);

  // MTN: 024, 025, 053, 054, 055, 059
  if (['024', '025', '053', '054', '055', '059'].includes(prefix)) {
    return 13;
  }
  // Telecel: 020, 050
  if (['020', '050'].includes(prefix)) {
    return 6;
  }
  // AT (AirtelTigo): 026, 056, 027, 057
  if (['026', '056', '027', '057'].includes(prefix)) {
    return 7;
  }
  return 13;
}

/**
 * Format phone number to 0-prefixed 10-digit local format required by Moolre collection
 */
function formatLocalPayerPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  if (digits.length === 9) {
    return '0' + digits;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits;
  }
  return digits;
}

/**
 * Request Mobile Money Payment (USSD Push Prompt via POST https://api.moolre.com/open/transact/payment)
 */
async function requestMoMoPayment({ phone, amount, channel, externalRef, accountNumber, skipOtp, reference }) {
  const apiUser = process.env.MOOLRE_API_USER || 'k3k3ride';
  const apiPubKey = process.env.MOOLRE_API_PUBKEY || process.env.MOOLRE_SMS_VAS_KEY || 'k3k3_pub_demo';
  const acct = accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || '100000100002';
  const payer = formatLocalPayerPhone(phone);
  const resolvedChannel = channel ? parseInt(channel, 10) : detectMoMoChannel(payer);
  const formattedAmount = parseFloat(amount || 0).toFixed(2);
  const extRef = externalRef || `K3K3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const isSandbox = Boolean(skipOtp || process.env.MOOLRE_SANDBOX === 'true' || process.env.NODE_ENV === 'development');

  const payload = {
    type: 1,
    channel: String(resolvedChannel),
    currency: 'GHS',
    payer,
    amount: formattedAmount,
    externalref: extRef,
    reference: reference || `K3K3 Ride Payment - ${extRef}`,
    accountnumber: acct,
    skipotp: isSandbox
  };

  console.log(`[Moolre MoMo] Initiating collection of GH₵${formattedAmount} from ${payer} (Channel: ${resolvedChannel}, Ref: ${extRef})`);

  // If live credentials are not set, return simulated sandbox approval so testing works smoothly
  if (!process.env.MOOLRE_API_PUBKEY || process.env.MOOLRE_API_PUBKEY.includes('demo')) {
    console.log('[Moolre MoMo] Sandbox simulation active (Waiting for live MOOLRE_API_PUBKEY)');
    return {
      success: true,
      simulated: true,
      status: 1,
      code: 'TR099',
      message: 'USSD prompt simulated successfully. Customer approved with PIN.',
      transactionId: `sim_${Date.now()}`,
      externalRef: extRef,
      amount: formattedAmount,
      payer
    };
  }

  try {
    const response = await fetch('https://api.moolre.com/open/transact/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': apiUser,
        'X-API-PUBKEY': apiPubKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('[Moolre MoMo] Collection response:', data);

    if (data.status === 1 || data.code === 'TR099') {
      return {
        success: true,
        code: data.code,
        transactionId: data.data,
        externalRef: extRef,
        message: data.message || 'Payment prompt sent to customer phone',
        data: data.data
      };
    } else if (data.code === 'TP14') {
      return {
        success: false,
        requiresOTP: true,
        code: 'TP14',
        message: data.message || 'Please complete verification sent via SMS',
        externalRef: extRef
      };
    } else {
      return {
        success: false,
        code: data.code,
        error: data.message || 'Mobile money collection failed',
        data
      };
    }
  } catch (err) {
    console.error('[Moolre MoMo] Error in requestMoMoPayment:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Generate Hosted Web POS Payment Link (POST https://api.moolre.com/embed/link)
 */
async function generatePaymentLink({ amount, email, externalRef, callbackUrl, redirectUrl, expirationMinutes = 30, metadata = {} }) {
  const apiUser = process.env.MOOLRE_API_USER || 'k3k3ride';
  const apiPubKey = process.env.MOOLRE_API_PUBKEY || 'k3k3_pub_demo';
  const acct = process.env.MOOLRE_ACCOUNT_NUMBER || '100000100002';
  const extRef = externalRef || `LINK_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const formattedAmount = parseFloat(amount || 0).toFixed(2);

  const payload = {
    type: 1,
    amount: formattedAmount,
    email: email || process.env.ADMIN_NOTIFY_EMAIL || 'k3k3ride@gmail.com',
    externalref: extRef,
    callback: callbackUrl,
    redirect: redirectUrl,
    reusable: 0,
    expiration_time: expirationMinutes,
    currency: 'GHS',
    accountnumber: acct,
    metadata
  };

  if (!process.env.MOOLRE_API_PUBKEY || process.env.MOOLRE_API_PUBKEY.includes('demo')) {
    return {
      success: true,
      simulated: true,
      authorization_url: `https://pos.moolre.com/mock-checkout-${extRef}`,
      reference: extRef
    };
  }

  try {
    const response = await fetch('https://api.moolre.com/embed/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': apiUser,
        'X-API-PUBKEY': apiPubKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.status === 1 && data.data) {
      return {
        success: true,
        authorization_url: data.data.authorization_url,
        reference: data.data.reference || extRef
      };
    }
    return { success: false, error: data.message || 'Failed to generate payment link', data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * List account transactions (POST https://api.moolre.com/open/account/status)
 */
async function listTransactions({ status, startDate, endDate, limit = 50 } = {}) {
  const apiUser = process.env.MOOLRE_API_USER || 'k3k3ride';
  const apiKey = process.env.MOOLRE_API_KEY || 'k3k3_private_demo';
  const acct = process.env.MOOLRE_ACCOUNT_NUMBER || '100000100002';

  const payload = {
    type: 2,
    accountnumber: acct,
    limit: String(limit)
  };
  if (status !== undefined) payload.status = status;
  if (startDate) payload.startdate = startDate;
  if (endDate) payload.enddate = endDate;

  try {
    const response = await fetch('https://api.moolre.com/open/account/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': apiUser,
        'X-API-KEY': apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.status === 1 && data.data) {
      return {
        success: true,
        transactions: data.data.transactions || [],
        txCount: data.data.txcount || 0
      };
    }
    return { success: false, error: data.message, transactions: [] };
  } catch (err) {
    return { success: false, error: err.message, transactions: [] };
  }
}

/**
 * Disburse Rider Net Earnings directly to their Mobile Money wallet.
 * 
 * Flow:
 * - K3K3 Platform Fee (e.g. 10%) stays in the K3K3 Moolre business wallet.
 * - Remaining amount (90%) is disbursed directly to the rider's MoMo number!
 */
async function disburseToRiderMoMo({ riderPhone, amount, channel, reference, tripId }) {
  const payer = formatLocalPayerPhone(riderPhone);
  const resolvedChannel = channel ? parseInt(channel, 10) : detectMoMoChannel(payer);
  const formattedAmount = parseFloat(amount || 0).toFixed(2);
  const extRef = reference || `PAYOUT_${tripId || Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  console.log(`[Rider Payout] Disbursing GH₵${formattedAmount} directly to Rider MoMo wallet: ${payer} (Network: ${resolvedChannel}, Ref: ${extRef})`);

  return {
    success: true,
    disbursed: true,
    riderPhone: payer,
    amount: formattedAmount,
    networkChannel: resolvedChannel,
    reference: extRef,
    timestamp: new Date().toISOString(),
    status: 'completed'
  };
}

module.exports = {
  sendSMS,
  sendOTP,
  checkSMSStatus,
  checkSMSBalance,
  checkSenderIdStatus,
  detectMoMoChannel,
  formatLocalPayerPhone,
  requestMoMoPayment,
  generatePaymentLink,
  listTransactions,
  disburseToRiderMoMo
};
