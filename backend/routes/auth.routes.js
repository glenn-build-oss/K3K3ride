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
const { findUserByPhone, findAllUsersByPhone, findUserByEmail, createUser, updateUserLastLogin, storeOTP: dbStoreOTP, verifyOTP: dbVerifyOTP } = require('../services/supabase.service');

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
    return { user, isNew: false };
  }

  // Create new user
  const newUser = await createUser({
    phone,
    role,
    firstName: extraData.firstName || '',
    lastName: extraData.lastName || '',
    fullName: extraData.fullName || '',
    email: extraData.email || '',
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
    await dbStoreOTP(normalizedPhone, otpCode, 'login');

    // Check if user has other roles
    const allUsers = await findAllUsersByPhone(normalizedPhone);
    const otherRoles = allUsers
      .filter(u => u.role !== 'passenger')
      .map(u => u.role);

    // Send via Moolre SMS
    const smsResult = await moolreSendOTP(normalizedPhone, otpCode);

    if (!smsResult.success) {
      console.error(`[Auth] Failed to send OTP SMS: ${smsResult.error}`);
      // In development, still return success so testing can continue
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth] DEV MODE — OTP for ${normalizedPhone}: ${otpCode}`);
        return res.json({
          success: true,
          message: 'OTP sent (dev mode)',
          phoneMask: maskPhone(normalizedPhone),
          _devOTP: otpCode  // Only in dev mode!
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

    // Verify OTP
    const result = await dbVerifyOTP(normalizedPhone, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Check if user has other roles
    const allUsers = await findAllUsersByPhone(normalizedPhone);
    const passengerUser = allUsers.find(u => u.role === 'passenger');
    const otherRoles = allUsers
      .filter(u => u.role !== 'passenger')
      .map(u => u.role);

    // If passenger account exists, use it for login
    if (passengerUser) {
      await updateUserLastLogin(passengerUser.id);
      const token = generateToken(passengerUser);

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: passengerUser.id,
          phone: passengerUser.phone,
          firstName: passengerUser.first_name,
          lastName: passengerUser.last_name,
          email: passengerUser.email,
          role: passengerUser.role,
          status: passengerUser.status,
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
    const { user, isNew, error } = await findOrCreateUser(normalizedPhone, 'passenger');
    
    if (!user) {
      return res.status(400).json({ success: false, error: error || 'Failed to create user account' });
    }
    
    // Update last login
    await updateUserLastLogin(user.id);

    // Generate JWT
    const token = generateToken(user);

    res.json({
      success: true,
      message: isNew ? 'Account created successfully' : 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.full_name,
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
    await dbStoreOTP(normalizedPhone, otpCode, 'signup');

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

    // Check if rider account already exists
    const allUsers = await findAllUsersByPhone(normalizedPhone);
    const riderUser = allUsers.find(u => u.role === 'rider');

    if (riderUser) {
      return res.json({
        success: true,
        message: 'A rider account is already registered with this phone number. Please log in.',
        hasExistingAccount: true,
        phoneMask: maskPhone(normalizedPhone)
      });
    }

    const otpCode = generateOTP();
    storeOTP(normalizedPhone, otpCode, 'login');

    const smsResult = await moolreSendOTP(normalizedPhone, otpCode);

    if (!smsResult.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth] DEV MODE — Rider OTP for ${normalizedPhone}: ${otpCode}`);
        return res.json({
          success: true,
          message: 'OTP sent (dev mode)',
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

    // If rider account exists, use it for login
    if (riderUser) {
      await updateUserLastLogin(riderUser.id);
      const token = generateToken(riderUser);

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: riderUser.id,
          phone: riderUser.phone,
          firstName: riderUser.first_name,
          lastName: riderUser.last_name,
          email: riderUser.email,
          role: riderUser.role,
          status: riderUser.status,
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

    res.json({
      success: true,
      message: isNew ? 'Account created' : 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        status: user.status,
        isNew
      }
    });

  } catch (err) {
    console.error('[Auth] Error in rider/verify-otp:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
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
    await dbStoreOTP(normalizedPhone, otpCode, 'signup');

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
    await dbStoreOTP(admin.phone, otpCode, 'verify');

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

    // Check pending 2FA session
    const session = pending2FA.get(email.toLowerCase());
    if (!session) {
      return res.status(400).json({ success: false, error: 'No pending verification. Please log in again.' });
    }

    if (new Date() > session.expiresAt) {
      pending2FA.delete(email.toLowerCase());
      return res.status(400).json({ success: false, error: 'Verification session expired. Please log in again.' });
    }

    // Verify OTP
    const result = await dbVerifyOTP(session.phone, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Clean up 2FA session
    pending2FA.delete(email.toLowerCase());

    // Find admin and generate JWT
    const admin = await findUserByEmail(email);
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
        name: `${admin.first_name} ${admin.last_name}`.trim(),
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
    res.json({ success: true, user: safeUser });
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
