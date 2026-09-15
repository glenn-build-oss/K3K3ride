/**
 * K3K3 Backend — Authentication Routes
 * 
 * All OTP-based authentication endpoints for:
 *   - Passenger (login + signup via phone OTP)
 *   - Rider (login + signup via phone OTP)
 *   - Admin (email/password + phone OTP 2FA)
 * 
 * No database — uses in-memory stores for OTPs and basic user tracking.
 * Database integration will be added later.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { normalizePhone, maskPhone } = require('../utils/phone');
const { generateOTP } = require('../services/otp.service');
const { sendSMS, sendOTP: moolreSendOTP, checkSMSBalance, checkSenderIdStatus } = require('../services/moolre.service');
const { sendAdminOTP } = require('../services/email.service');
const { findUserByPhone, findAllUsersByPhone, findUserByEmail, createUser, updateUser, updateUserLastLogin, storeOTP: dbStoreOTP, verifyOTP: dbVerifyOTP, getRiderApplicationStatus } = require('../services/supabase.service');

const JWT_SECRET = process.env.JWT_SECRET || 'k3k3_dev_secret';
const JWT_EXPIRY = '24h';

// Track pending 2FA sessions for admin
const pending2FA = new Map();

// ─── Helper: Generate JWT ───
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user.email,
      phone: user.phone,
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// ─── Helper: Find or create user by phone ───
async function findOrCreateUser(phone, role, extraData = {}) {
  // Check if user exists by phone
  let user = await findUserByPhone(phone, role);
  
  if (user) {
    // If user exists and extraData has name info that was missing or updated, persist it!
    const updates = {};
    const providedFirstName = extraData.firstName || (extraData.fullName ? extraData.fullName.split(' ')[0] : '');
    const providedLastName = extraData.lastName || (extraData.fullName ? extraData.fullName.split(' ').slice(1).join(' ') : '');
    const providedFullName = extraData.fullName || (providedFirstName ? `${providedFirstName} ${providedLastName}`.trim() : '');

    if (providedFirstName && (!user.first_name || user.first_name.trim() === '')) {
      updates.first_name = providedFirstName;
    }
    if (providedLastName && (!user.last_name || user.last_name.trim() === '')) {
      updates.last_name = providedLastName;
    }
    if (providedFullName && (!user.full_name || user.full_name.trim() === '')) {
      updates.full_name = providedFullName;
    } else if (!user.full_name && (updates.first_name || user.first_name)) {
      updates.full_name = `${updates.first_name || user.first_name || ''} ${updates.last_name || user.last_name || ''}`.trim();
    }
    if (extraData.email && (!user.email || user.email.trim() === '')) {
      updates.email = extraData.email;
    }

    if (Object.keys(updates).length > 0) {
      const updatedUser = await updateUser(user.id, updates);
      if (updatedUser) user = updatedUser;
    }

    return { user, isNew: false };
  }

  // Create new user
  const firstName = extraData.firstName || (extraData.fullName ? extraData.fullName.split(' ')[0] : '');
  const lastName = extraData.lastName || (extraData.fullName ? extraData.fullName.split(' ').slice(1).join(' ') : '');
  const fullName = extraData.fullName || (firstName ? `${firstName} ${lastName}`.trim() : '');

  const newUser = await createUser({
    phone,
    role,
    firstName: firstName || null,
    lastName: lastName || null,
    fullName: fullName || null,
    email: extraData.email || null,
    status: role === 'rider' ? 'pending' : 'active'
  });

  if (newUser && newUser.error) {
    return { user: null, error: newUser.error, existingRole: newUser.existingRole };
  }

  if (newUser) {
    console.log(`[Auth] Created new ${role}: ${phone} (ID: ${newUser.id})`);
    return { user: newUser, isNew: true };
  }

  return { user: null, isNew: false };
}

// ═══════════════════════════════════════════
//  PASSENGER ENDPOINTS
// ═══════════════════════════════════════════

/**
 * POST /api/auth/passenger/send-otp
 * Send OTP to passenger's phone number for login.
 */
router.post('/passenger/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // Normalize phone
    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Generate 6-digit OTP
    const otpCode = generateOTP();
    const storeResult = await dbStoreOTP(normalizedPhone, otpCode, 'login');
    if (storeResult && storeResult.error) {
      console.error(`[Auth] Database error storing OTP: ${storeResult.error}`);
      return res.status(500).json({ success: false, error: 'Failed to generate verification code. Please check server database.' });
    }

    // Check if user has other roles
    const allUsers = await findAllUsersByPhone(normalizedPhone);
    const otherRoles = allUsers
      .filter(u => u.role !== 'passenger')
      .map(u => u.role);

    // Send via Moolre SMS
    const smsResult = await moolreSendOTP(normalizedPhone, otpCode);

    if (!smsResult.success) {
      console.error(`[Auth] Failed to send OTP SMS to ${normalizedPhone}: ${smsResult.error}`);
      console.log(`[Auth] OTP for ${normalizedPhone}: ${otpCode} (SMS failed - check MOOLRE env vars in Vercel)`);
      // Return OTP in response so login can proceed while SMS is being configured
      return res.json({
        success: true,
        message: 'Verification code sent',
        phoneMask: maskPhone(normalizedPhone),
        _smsWarning: smsResult.error,
        _otp: otpCode  // shown on screen when SMS fails — remove once SMS is working
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      phoneMask: maskPhone(normalizedPhone)
    });

  } catch (err) {
    console.error('[Auth] Error in passenger/send-otp:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/passenger/verify-otp
 * Verify OTP and log in / create passenger account.
 */
router.post('/passenger/verify-otp', async (req, res) => {
  try {
    const { phone, otp, fullName, firstName, lastName } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP are required' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Verify OTP
    const result = await dbVerifyOTP(normalizedPhone, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const providedFullName = (fullName || '').trim();
    const providedFirstName = (firstName || (providedFullName ? providedFullName.split(' ')[0] : '')).trim();
    const providedLastName = (lastName || (providedFullName ? providedFullName.split(' ').slice(1).join(' ') : '')).trim();

    // Check if user has other roles or rider applications
    const allUsers = await findAllUsersByPhone(normalizedPhone);
    const riderUser = allUsers.find(u => u.role === 'rider');
    const passengerUser = allUsers.find(u => u.role === 'passenger');
    const appRecord = await getRiderApplicationStatus(normalizedPhone);
    const isApprovedRider = (riderUser && (riderUser.status === 'approved' || riderUser.status === 'active')) ||
                            (appRecord && appRecord.status === 'approved');

    // If phone belongs to an approved rider, prioritize their rider profile!
    if (isApprovedRider && riderUser) {
      await updateUserLastLogin(riderUser.id);
      const token = generateToken(riderUser);
      const computedFullName = riderUser.full_name || `${riderUser.first_name || ''} ${riderUser.last_name || ''}`.trim();
      return res.json({
        success: true,
        message: 'Login successful (Rider)',
        token,
        status: riderUser.status || 'approved',
        isRider: true,
        user: {
          id: riderUser.id,
          phone: riderUser.phone,
          firstName: riderUser.first_name,
          lastName: riderUser.last_name,
          fullName: computedFullName,
          email: riderUser.email,
          role: 'rider',
          role_type: 'rider',
          status: riderUser.status || 'approved',
          isNew: false
        }
      });
    }

    // If passenger account exists, use it for login
    if (passengerUser) {
      let activeUser = passengerUser;
      const updates = {};
      if (providedFirstName && (!passengerUser.first_name || passengerUser.first_name.trim() === '')) {
        updates.first_name = providedFirstName;
      }
      if (providedLastName && (!passengerUser.last_name || passengerUser.last_name.trim() === '')) {
        updates.last_name = providedLastName;
      }
      if (providedFullName && (!passengerUser.full_name || passengerUser.full_name.trim() === '')) {
        updates.full_name = providedFullName;
      } else if (!passengerUser.full_name && (updates.first_name || passengerUser.first_name)) {
        updates.full_name = `${updates.first_name || passengerUser.first_name || ''} ${updates.last_name || passengerUser.last_name || ''}`.trim();
      }

      if (Object.keys(updates).length > 0) {
        const updated = await updateUser(passengerUser.id, updates);
        if (updated) activeUser = updated;
      }

      await updateUserLastLogin(activeUser.id);
      const token = generateToken(activeUser);
      const computedFullName = activeUser.full_name || `${activeUser.first_name || ''} ${activeUser.last_name || ''}`.trim();

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: activeUser.id,
          phone: activeUser.phone,
          firstName: activeUser.first_name,
          lastName: activeUser.last_name,
          fullName: computedFullName,
          email: activeUser.email,
          role: activeUser.role,
          status: activeUser.status,
          isNew: false
        }
      });
    }

    // If phone exists as a rider, log them into their rider account seamlessly!
    if (riderUser) {
      await updateUserLastLogin(riderUser.id);
      const token = generateToken(riderUser);
      const computedFullName = riderUser.full_name || `${riderUser.first_name || ''} ${riderUser.last_name || ''}`.trim();
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        status: riderUser.status || 'approved',
        isRider: true,
        user: {
          id: riderUser.id,
          phone: riderUser.phone,
          firstName: riderUser.first_name,
          lastName: riderUser.last_name,
          fullName: computedFullName,
          email: riderUser.email,
          role: 'rider',
          status: riderUser.status || 'approved',
          isNew: false
        }
      });
    }

    // If phone exists with other role, show error
    if (otherRoles.length > 0) {
      return res.status(400).json({
        success: false,
        error: `This phone number is already registered as a ${otherRoles[0]}. Please use a different phone number or login with your existing account.`
      });
    }

    // Create new passenger account
    const { user, isNew, error } = await findOrCreateUser(normalizedPhone, 'passenger', {
      fullName: providedFullName,
      firstName: providedFirstName,
      lastName: providedLastName
    });
    
    if (!user) {
      return res.status(400).json({ success: false, error: error || 'Failed to create user account' });
    }
    
    // Update last login
    await updateUserLastLogin(user.id);

    // Generate JWT
    const token = generateToken(user);
    const computedFullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim();

    res.json({
      success: true,
      message: isNew ? 'Account created successfully' : 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: computedFullName,
        email: user.email,
        role: user.role,
        status: user.status,
        isNew
      }
    });

  } catch (err) {
    console.error('[Auth] Error in passenger/verify-otp:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/passenger/register
 * Register a new passenger + send OTP.
 */
router.post('/passenger/register', async (req, res) => {
  try {
    const { phone, fullName } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Pre-create user with name (will be finalized on OTP verify)
    const nameParts = fullName.trim().split(' ');
    await findOrCreateUser(normalizedPhone, 'passenger', {
      fullName: fullName.trim(),
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ')
    });

    // Generate OTP
    const otpCode = generateOTP();
    const storeResult = await dbStoreOTP(normalizedPhone, otpCode, 'signup');
    if (storeResult && storeResult.error) {
      console.error(`[Auth] Database error storing OTP: ${storeResult.error}`);
      return res.status(500).json({ success: false, error: 'Failed to generate verification code. Please check server database.' });
    }

    // Send via Moolre
    const smsResult = await moolreSendOTP(normalizedPhone, otpCode);

    if (!smsResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth] DEV MODE — OTP for ${normalizedPhone}: ${otpCode}`);
        return res.json({
          success: true,
          message: 'OTP sent for verification (dev mode)',
          phoneMask: maskPhone(normalizedPhone),
          _devOTP: otpCode
        });
      }
      return res.status(500).json({ success: false, error: 'Failed to send verification code. Please try again.' });
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      phoneMask: maskPhone(normalizedPhone)
    });

  } catch (err) {
    console.error('[Auth] Error in passenger/register:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/passenger/profile
 * Update passenger profile details.
 */
router.put('/passenger/profile', async (req, res) => {
  try {
    const { userId: bodyUserId, fname, lname, phone, email, emergency_name, emergency_phone } = req.body;
    
    // Extract userId from auth header or request body
    let targetUserId = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) targetUserId = decoded.id;
      } catch (err) {
        console.warn('[Auth] Token decode warning in PUT profile:', err.message);
      }
    }
    
    if (!targetUserId && bodyUserId) {
      targetUserId = bodyUserId;
    }
    
    if (!targetUserId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid authentication token' });
    }
    
    const updates = {
      first_name: fname || '',
      last_name: lname || '',
      full_name: `${fname || ''} ${lname || ''}`.trim(),
      email: email || ''
    };
    if (phone) updates.phone = phone;
    
    const result = await updateUser(targetUserId, updates);
    if (!result) {
      return res.status(500).json({ success: false, error: 'Failed to update profile in database' });
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: result.id,
        phone: result.phone,
        firstName: result.first_name,
        lastName: result.last_name,
        fullName: result.full_name,
        email: result.email,
        role: result.role,
        status: result.status,
        emergency_name: emergency_name || null,
        emergency_phone: emergency_phone || null
      }
    });
  } catch (err) {
    console.error('[Auth] Error in passenger/profile update:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════
//  RIDER ENDPOINTS
// ═══════════════════════════════════════════

/**
 * POST /api/auth/rider/send-otp
 * Send OTP to rider's phone for login.
 */
router.post('/rider/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const otpCode = generateOTP();
    const storeResult = await dbStoreOTP(normalizedPhone, otpCode, 'login');
    if (storeResult && storeResult.error) {
      console.error(`[Auth] Database error storing OTP: ${storeResult.error}`);
      return res.status(500).json({ success: false, error: 'Failed to generate verification code. Please check server database.' });
    }

    const smsResult = await moolreSendOTP(normalizedPhone, otpCode);

    if (!smsResult.success) {
      console.error(`[Auth] Failed to send rider OTP SMS to ${normalizedPhone}: ${smsResult.error}`);
      console.log(`[Auth] Rider OTP for ${normalizedPhone}: ${otpCode}`);
      return res.json({
        success: true,
        message: 'Verification code sent',
        phoneMask: maskPhone(normalizedPhone),
        _smsWarning: smsResult.error,
        _otp: otpCode,
        _devOTP: otpCode
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      phoneMask: maskPhone(normalizedPhone)
    });

  } catch (err) {
    console.error('[Auth] Error in rider/send-otp:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/rider/verify-otp
 * Verify OTP and log in rider.
 */
router.post('/rider/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP are required' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const result = await dbVerifyOTP(normalizedPhone, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Check if user has other roles
    const allUsers = await findAllUsersByPhone(normalizedPhone);
    const riderUser = allUsers.find(u => u.role === 'rider');
    const otherRoles = allUsers
      .filter(u => u.role !== 'rider')
      .map(u => u.role);

    // Check if application has been approved by admin
    const app = await getRiderApplicationStatus(normalizedPhone);

    // Check if account is suspended
    if (riderUser?.status === 'suspended' || app?.status === 'suspended') {
      return res.status(403).json({
        success: false,
        status: 'suspended',
        error: 'Your rider account has been suspended by administration. Please contact K3K3 support for assistance.'
      });
    }

    // If rider account exists, use it for login
    if (riderUser) {
      await updateUserLastLogin(riderUser.id);
      const token = generateToken(riderUser);
      const isAppPending = app && (app.status === 'pending' || app.status === 'pending_review' || app.status === 'under_review');
      const isApproved = !isAppPending && ((app && app.status === 'approved') || riderUser.status === 'approved');
      const riderStatus = isApproved ? 'approved' : 'pending';

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        status: riderStatus,
        user: {
          id: riderUser.id,
          phone: riderUser.phone,
          firstName: riderUser.first_name || app?.first_name || '',
          lastName: riderUser.last_name || app?.last_name || '',
          email: riderUser.email || app?.email || '',
          app_ref: app?.app_ref || app?.application_ref || null,
          applicationRef: app?.app_ref || app?.application_ref || null,
          role: riderUser.role,
          status: riderStatus,
          isNew: false
        }
      });
    }

    // If phone exists with other role, show error
    if (otherRoles.length > 0) {
      return res.status(400).json({
        success: false,
        error: `This phone number is already registered as a ${otherRoles[0]}. Please use a different phone number or login with your existing account.`
      });
    }

    // Create new rider account
    const { user, isNew, error } = await findOrCreateUser(normalizedPhone, 'rider');
    
    if (!user) {
      return res.status(400).json({ success: false, error: error || 'Failed to create user account' });
    }

    // Send application received SMS if new rider
    if (isNew) {
      const message = 'Your rider application has been received and is under review. We\'ll notify you by SMS once a decision has been made. Thank you for choosing K3K3ride.';
      await sendSMS(normalizedPhone, message);
    }
    
    // Update last login
    await updateUserLastLogin(user.id);
    
    const token = generateToken(user);
    const isApproved = (app && app.status === 'approved');
    const riderStatus = isApproved ? 'approved' : 'pending';

    res.json({
      success: true,
      message: isNew ? 'Account created' : 'Login successful',
      token,
      status: riderStatus,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.first_name || app?.first_name || '',
        lastName: user.last_name || app?.last_name || '',
        email: user.email || app?.email || '',
        app_ref: app?.app_ref || app?.application_ref || null,
        applicationRef: app?.app_ref || app?.application_ref || null,
        role: user.role,
        status: riderStatus,
        isNew
      }
    });

  } catch (err) {
    console.error('[Auth] Error in rider/verify-otp:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/rider/status
 * Check approval status of a rider by phone number
 */
router.get('/rider/status', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (_) {
      normalizedPhone = phone;
    }

    // Check application record
    const app = await getRiderApplicationStatus(normalizedPhone);
    const appStatus = app ? app.status : null;

    // Check user record
    const user = await findUserByPhone(normalizedPhone, 'rider');
    const userStatus = user ? user.status : null;

    const isSuspended = (appStatus === 'suspended') || (userStatus === 'suspended');
    if (isSuspended) {
      return res.json({
        success: true,
        status: 'suspended',
        isApproved: false,
        isSuspended: true,
        application_ref: app?.app_ref || (app?.id ? `APP-${app.id.substring(0, 8).toUpperCase()}` : null),
        app_ref: app?.app_ref || (app?.id ? `APP-${app.id.substring(0, 8).toUpperCase()}` : null),
        first_name: app?.first_name || user?.first_name || '',
        last_name: app?.last_name || user?.last_name || '',
        phone: normalizedPhone
      });
    }

    const isAppPending = appStatus === 'pending' || appStatus === 'pending_review' || appStatus === 'under_review';
    const isApproved = !isAppPending && ((appStatus === 'approved') || (!appStatus && (userStatus === 'active' || userStatus === 'approved')));
    const finalStatus = isApproved ? 'approved' : (appStatus || userStatus || 'pending');

    res.json({
      success: true,
      status: finalStatus,
      application_ref: app?.app_ref || (app?.id ? `APP-${app.id.substring(0, 8).toUpperCase()}` : null),
      app_ref: app?.app_ref || (app?.id ? `APP-${app.id.substring(0, 8).toUpperCase()}` : null),
      first_name: app?.first_name || user?.first_name || '',
      last_name: app?.last_name || user?.last_name || '',
      phone: normalizedPhone,
      admin_notes: app?.admin_notes || null
    });
  } catch (err) {
    console.error('[Auth] Error in rider/status:', err);
    res.status(500).json({ success: false, error: 'Failed to check status' });
  }
});

/**
 * POST /api/auth/rider/register
 * Register a new rider + send OTP.
 */
router.post('/rider/register', async (req, res) => {
  try {
    const { phone, firstName, lastName, email } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    if (!firstName) {
      return res.status(400).json({ success: false, error: 'First name is required' });
    }
    if (!lastName) {
      return res.status(400).json({ success: false, error: 'Last name is required' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Create rider with pending status
    await findOrCreateUser(normalizedPhone, 'rider', {
      firstName,
      lastName,
      email: email || ''
    });

    const otpCode = generateOTP();
    const storeResult = await dbStoreOTP(normalizedPhone, otpCode, 'signup');
    if (storeResult && storeResult.error) {
      console.error(`[Auth] Database error storing OTP: ${storeResult.error}`);
      return res.status(500).json({ success: false, error: 'Failed to generate verification code. Please check server database.' });
    }

    const smsResult = await moolreSendOTP(normalizedPhone, otpCode);

    if (!smsResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth] DEV MODE — Rider signup OTP for ${normalizedPhone}: ${otpCode}`);
        return res.json({
          success: true,
          message: 'OTP sent for verification (dev mode)',
          phoneMask: maskPhone(normalizedPhone),
          _devOTP: otpCode
        });
      }
      return res.status(500).json({ success: false, error: 'Failed to send verification code.' });
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      phoneMask: maskPhone(normalizedPhone)
    });

  } catch (err) {
    console.error('[Auth] Error in rider/register:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/rider/profile
 * Fetch comprehensive profile for a rider (from users + rider_applications).
 */
router.get('/rider/profile', async (req, res) => {
  try {
    const riderId = req.query.riderId || req.query.id;
    const phone = req.query.phone;

    let user = null;
    if (riderId && riderId !== 'undefined' && riderId !== '—') {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase.from('users').select('*').eq('id', riderId).single();
        if (data) user = data;
      } catch (_) {}
    }

    if (!user && phone) {
      let normalizedPhone = phone;
      try { normalizedPhone = normalizePhone(phone); } catch(_) {}
      user = await findUserByPhone(normalizedPhone, 'rider');
    }

    let app = null;
    const searchPhone = user?.phone || phone;
    if (searchPhone) {
      let normalized = searchPhone;
      try { normalized = normalizePhone(searchPhone); } catch(_) {}
      app = await getRiderApplicationStatus(normalized);
    }

    const fn = user?.first_name || app?.first_name || 'Rider';
    const ln = user?.last_name || app?.last_name || '';
    const full = user?.full_name || (fn ? `${fn} ${ln}`.trim() : (app?.full_name || 'K3K3 Rider'));

    res.json({
      success: true,
      profile: {
        id: user?.id || riderId || 'rider-demo',
        phone: user?.phone || app?.phone || phone || '',
        firstName: fn,
        lastName: ln,
        fullName: full,
        email: user?.email || app?.email || '',
        role: 'rider',
        status: user?.status || app?.status || 'approved',
        vehicleType: app?.vehicle_type || 'TVS King Deluxe Tricycle',
        licensePlate: app?.vehicle_plate || app?.reg_number || 'AS 4920-24',
        capacity: 3,
        station: app?.station || 'KNUST Main Gate',
        rating: 4.9,
        acceptanceRate: '98%',
        tripsCompleted: 84,
        emergencyName: app?.emergency_contact_name || user?.emergency_name || '',
        emergencyPhone: app?.emergency_contact_phone || user?.emergency_phone || '',
        joinedDate: user?.created_at || app?.created_at || new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[Auth] Error fetching rider profile:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/auth/rider/profile
 * Update rider profile (users table + rider_applications).
 */
router.put('/rider/profile', async (req, res) => {
  try {
    const {
      riderId, userId,
      firstName, lastName, fname, lname,
      email, phone,
      licensePlate, vehiclePlate,
      station,
      emergencyName, emergencyPhone,
      emergency_name, emergency_phone
    } = req.body;

    const targetId = riderId || userId;
    const fn = (firstName || fname || '').trim();
    const ln = (lastName || lname || '').trim();
    const full = [fn, ln].filter(Boolean).join(' ');

    const updates = {};
    if (fn) updates.first_name = fn;
    if (ln) updates.last_name = ln;
    if (full) updates.full_name = full;
    if (email) updates.email = email.toLowerCase().trim();
    if (phone) updates.phone = phone.trim();

    let updatedUser = null;
    if (targetId && targetId !== 'rider-demo' && targetId !== '—') {
      try {
        updatedUser = await updateUser(targetId, updates);
      } catch (err) {
        console.warn('[Auth] Could not update user in supabase:', err.message);
      }
    }

    const effectivePhone = phone || updatedUser?.phone;
    if (effectivePhone) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const appUpdates = {};
        if (fn) appUpdates.first_name = fn;
        if (ln) appUpdates.last_name = ln;
        if (email) appUpdates.email = email.toLowerCase().trim();
        const plate = licensePlate || vehiclePlate;
        if (plate) appUpdates.vehicle_plate = plate.trim();
        if (station) appUpdates.station = station.trim();
        const emName = emergencyName || emergency_name;
        if (emName) appUpdates.emergency_contact_name = emName.trim();
        const emPhone = emergencyPhone || emergency_phone;
        if (emPhone) appUpdates.emergency_contact_phone = emPhone.trim();

        await supabase
          .from('rider_applications')
          .update(appUpdates)
          .eq('phone', effectivePhone);
      } catch (e) {
        console.warn('[Auth] Could not update rider_applications table:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Rider profile updated successfully',
      profile: {
        id: targetId || updatedUser?.id || 'rider-demo',
        firstName: fn || updatedUser?.first_name || 'Rider',
        lastName: ln || updatedUser?.last_name || '',
        fullName: full || updatedUser?.full_name || 'Rider',
        email: email || updatedUser?.email || '',
        phone: effectivePhone || '',
        licensePlate: licensePlate || vehiclePlate || 'AS 4920-24',
        station: station || 'KNUST Main Gate',
        emergencyName: emergencyName || emergency_name || '',
        emergencyPhone: emergencyPhone || emergency_phone || ''
      }
    });
  } catch (err) {
    console.error('[Auth] Error updating rider profile:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// ═══════════════════════════════════════════
//  ADMIN ENDPOINTS
// ═══════════════════════════════════════════

/**
 * POST /api/auth/admin/login
 * Step 1: Verify email/password → send OTP for 2FA.
 */
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Find admin user
    const admin = await findUserByEmail(email);
    if (!admin || admin.role !== 'admin') {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate OTP for 2FA
    const otpCode = generateOTP();
    const storeResult = await dbStoreOTP(admin.phone, otpCode, 'verify');
    if (storeResult && storeResult.error) {
      console.error(`[Auth] Database error storing OTP: ${storeResult.error}`);
      return res.status(500).json({ success: false, error: 'Failed to generate verification code. Please check server database.' });
    }

    // Store pending 2FA session
    pending2FA.set(email.toLowerCase(), {
      phone: admin.phone,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 min
    });

    // Send OTP via Moolre SMS
    const smsResult = await moolreSendOTP(admin.phone, otpCode);

    // Send OTP via Email — use ADMIN_NOTIFY_EMAIL (the real inbox), NOT admin.email
    // admin.email is the login username (admin@k3k3.com) which has no mail server.
    const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_USER || 'k3k3ride@gmail.com';
    const emailResult = await sendAdminOTP(notifyEmail, otpCode);
    console.log(`[Auth] Admin OTP sent to ${notifyEmail} (admin login: ${admin.email})`);


    if (!smsResult.success && !emailResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth] DEV MODE — Admin 2FA OTP for ${admin.phone}: ${otpCode}`);
        return res.json({
          success: true,
          requires2FA: true,
          message: 'Verification code sent to your registered phone and email',
          phoneMask: maskPhone(admin.phone),
          _devOTP: otpCode
        });
      }
      return res.status(500).json({ success: false, error: 'Failed to send 2FA code.' });
    }

    res.json({
      success: true,
      requires2FA: true,
      message: 'Verification code sent to your registered phone and email',
      phoneMask: maskPhone(admin.phone)
    });

  } catch (err) {
    console.error('[Auth] Error in admin/login:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/admin/verify-otp
 * Step 2: Verify 2FA OTP → return admin JWT.
 */
router.post('/admin/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Check pending 2FA session
    let session = pending2FA.get(cleanEmail);
    let admin = null;

    // Resilient fallback: If session memory was cleared (e.g. server restart), look up admin in Supabase
    if (!session) {
      admin = await findUserByEmail(cleanEmail);
      if (admin && admin.role === 'admin' && admin.phone) {
        session = {
          phone: admin.phone,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        };
        console.log(`[Auth] Recovered 2FA session from database for admin ${cleanEmail}`);
      }
    }

    if (!session) {
      return res.status(400).json({ success: false, error: 'No pending verification. Please log in again.' });
    }

    if (new Date() > session.expiresAt) {
      pending2FA.delete(cleanEmail);
      return res.status(400).json({ success: false, error: 'Verification session expired. Please log in again.' });
    }

    // Verify OTP code
    const result = await dbVerifyOTP(session.phone, cleanOtp);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error || 'Invalid code. Please try again.' });
    }

    // Clean up 2FA session
    pending2FA.delete(cleanEmail);

    // Find admin and generate JWT
    if (!admin) {
      admin = await findUserByEmail(cleanEmail);
    }
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Admin not found' });
    }
    
    // Update last login
    await updateUserLastLogin(admin.id);
    
    const token = generateToken(admin);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        name: `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Admin',
        role: admin.role
      }
    });

  } catch (err) {
    console.error('[Auth] Error in admin/verify-otp:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// ═══════════════════════════════════════════
//  UTILITY ENDPOINTS
// ═══════════════════════════════════════════

/**
 * GET /api/auth/users/:id
 * Fetch a user profile by ID (for passenger dashboard).
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { updateUser } = require('../services/supabase.service');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'User not found' });
    // Strip password_hash before sending
    const { password_hash, ...safeUser } = data;
    safeUser.fname = safeUser.first_name || '';
    safeUser.lname = safeUser.last_name || '';
    safeUser.name = safeUser.full_name || `${safeUser.first_name || ''} ${safeUser.last_name || ''}`.trim();
    res.json({ success: true, user: safeUser, ...safeUser });
  } catch (err) {
    console.error('[Auth] Error fetching user:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

/**
 * PATCH /api/auth/users/:id
 * Update user profile (name, email, phone) — called by passenger dashboard Save Profile.
 */
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, fname, lname } = req.body;

    const updates = {};
    const fn = first_name || fname;
    const ln = last_name || lname;
    if (fn !== undefined) updates.first_name = fn;
    if (ln !== undefined) updates.last_name = ln;
    if (fn !== undefined || ln !== undefined) {
      updates.full_name = [fn || '', ln || ''].filter(Boolean).join(' ') || null;
    }
    if (email !== undefined) updates.email = email.toLowerCase();
    if (phone !== undefined) updates.phone = phone;

    const { updateUser } = require('../services/supabase.service');
    const updated = await updateUser(id, updates);
    if (!updated) return res.status(404).json({ success: false, error: 'User not found or update failed' });

    const { password_hash, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('[Auth] Error updating user:', err);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * GET /api/auth/health
 * Health check + Moolre SMS balance.
 */
router.get('/health', async (req, res) => {
  const balance = await checkSMSBalance();
  const senderStatus = await checkSenderIdStatus();

  res.json({
    status: 'ok',
    service: 'K3K3 Auth API',
    timestamp: new Date().toISOString(),
    moolre: {
      smsBalance: balance.success ? balance.balance : 'unavailable',
      senderIdStatus: senderStatus.success ? senderStatus.approval : 'unavailable',
      senderId: process.env.MOOLRE_SENDER_ID,
      baseUrl: process.env.MOOLRE_BASE_URL
    }
  });
});


module.exports = router;
