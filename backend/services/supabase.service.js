/**
 * K3K3 Backend — Supabase Database Service
 * 
 * Handles all database operations using Supabase client.
 * Replaces in-memory storage with persistent database.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase] ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — check Vercel env vars');
  // Do NOT process.exit() — that kills the serverless function silently
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Throws a clean error if Supabase isn't configured
function requireSupabase() {
  if (!supabase) throw new Error('Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.');
  return supabase;
}

// ─── USER OPERATIONS ───

/**
 * Find user by phone number
 */
async function findUserByPhone(phone, role) {
  if (!phone) return null;
  const rawDigits = String(phone).replace(/\D/g, '');
  const last9 = rawDigits.slice(-9);
  const possiblePhones = [
    phone,
    `+233${last9}`,
    `233${last9}`,
    `0${last9}`
  ].filter(Boolean);
  const uniquePhones = [...new Set(possiblePhones)];

  let query = requireSupabase()
    .from('users')
    .select('*')
    .in('phone', uniquePhones);

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query.limit(1);

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] Error finding user by phone:', error);
  }

  return (data && data.length > 0) ? data[0] : null;
}

/**
 * Find all users by phone number (for checking multiple roles)
 */
async function findAllUsersByPhone(phone) {
  const { data, error } = await requireSupabase()
    .from('users')
    .select('*')
    .eq('phone', phone);

  if (error) {
    console.error('[Supabase] Error finding users by phone:', error);
    return [];
  }

  return data || [];
}

/**
 * Find user by email (for admin)
 */
async function findUserByEmail(email) {
  const { data, error } = await requireSupabase()
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] Error finding user by email:', error);
  }

  return data || null;
}

/**
 * Create a new user
 */
async function createUser(userData) {
  // Check if phone exists with different role
  const { data: existingUsers } = await requireSupabase()
    .from('users')
    .select('*')
    .eq('phone', userData.phone);

  if (existingUsers && existingUsers.length > 0) {
    const existingRole = existingUsers[0].role;
    if (existingRole !== userData.role) {
      return {
        error: `This phone number is already registered as a ${existingRole}. Please use a different phone number or login with your existing account.`,
        existingRole: existingRole
      };
    }
  }

  const { data, error } = await requireSupabase()
    .from('users')
    .insert([{
      phone: userData.phone,
      email: userData.email || null,
      first_name: userData.firstName || null,
      last_name: userData.lastName || null,
      full_name: userData.fullName || null,
      role: userData.role,
      status: userData.status || 'active',
      password_hash: userData.passwordHash || null
    }])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error creating user:', error);
    return null;
  }

  return data;
}

const ALLOWED_USER_COLUMNS = new Set([
  'phone', 'email', 'first_name', 'last_name', 'full_name',
  'role', 'status', 'password_hash', 'avatar_url', 'last_login'
]);

/**
 * Update user
 */
async function updateUser(userId, updates) {
  const safeUpdates = {
    updated_at: new Date().toISOString()
  };

  if (updates && typeof updates === 'object') {
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_USER_COLUMNS.has(key)) {
        safeUpdates[key] = value;
      }
    }
  }

  const { data, error } = await requireSupabase()
    .from('users')
    .update(safeUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating user:', error);
    return null;
  }

  return data;
}

/**
 * Update user last login
 */
async function updateUserLastLogin(userId) {
  const { error } = await requireSupabase()
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('[Supabase] Error updating last login:', error);
  }
}

// ─── OTP OPERATIONS ───

/**
 * Store OTP code in database
 */
async function storeOTP(phone, code, purpose, expiryMinutes = 5) {
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

  // First, invalidate any existing unused OTPs for this phone
  await requireSupabase()
    .from('otp_codes')
    .update({ used: true })
    .eq('phone', phone)
    .eq('used', false);

  // Insert new OTP
  const { data, error } = await requireSupabase()
    .from('otp_codes')
    .insert([{
      phone,
      code,
      purpose,
      expires_at: expiresAt,
      used: false
    }])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error storing OTP:', error);
    return { error: error.message || 'Failed to store OTP in database' };
  }

  console.log(`[Supabase] Stored OTP for ${phone}: ${code} (expires: ${expiresAt})`);
  return { data };
}

/**
 * Verify OTP code
 */
async function verifyOTP(phone, code) {
  // Normalize phone variants (+233..., 050..., 233...) so format mismatches never block valid codes
  const rawDigits = String(phone || '').replace(/\D/g, '');
  const last9 = rawDigits.slice(-9);
  const possiblePhones = [
    phone,
    `+233${last9}`,
    `233${last9}`,
    `0${last9}`
  ].filter(Boolean);
  const uniquePhones = [...new Set(possiblePhones)];
  const cleanCode = String(code || '').trim();

  const { data: otps, error } = await requireSupabase()
    .from('otp_codes')
    .select('*')
    .in('phone', uniquePhones)
    .eq('code', cleanCode)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1);

  const otp = otps && otps.length > 0 ? otps[0] : null;

  if (error || !otp) {
    return { valid: false, error: 'Invalid or expired verification code. Please check and try again.' };
  }

  // Check if expired
  if (new Date() > new Date(otp.expires_at)) {
    await requireSupabase().from('otp_codes').update({ used: true }).eq('id', otp.id);
    return { valid: false, error: 'Code has expired. Please request a new one.' };
  }

  // Mark as used
  const { error: updateError } = await requireSupabase()
    .from('otp_codes')
    .update({ 
      used: true,
      used_at: new Date().toISOString()
    })
    .eq('id', otp.id);

  if (updateError) {
    console.error('[Supabase] Error marking OTP as used:', updateError);
  }

  console.log(`[Supabase] OTP verified successfully for ${phone}`);
  return { valid: true, otp };
}

/**
 * Clean up expired OTPs (run periodically)
 */
async function cleanupExpiredOTPs() {
  try {
    if (!supabase) return;
    const { error } = await supabase
      .from('otp_codes')
      .delete()
      .lt('expires_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (error) {
      console.error('[Supabase] Error cleaning up OTPs:', error);
    } else {
      console.log('[Supabase] Cleaned up expired OTPs');
    }
  } catch (err) {
    console.warn('[Supabase] cleanupExpiredOTPs skipped:', err.message);
  }
}

/**
 * Get OTP logs for Moolre overview / admin audit
 */
async function getOTPLogs(limit = 100) {
  try {
    const { data, error } = await requireSupabase()
      .from('otp_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Supabase] Error getting OTP logs:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Supabase] getOTPLogs error:', err.message);
    return [];
  }
}

/**
 * Purge expired and used OTP records
 */
async function purgeExpiredOTPs() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await requireSupabase()
      .from('otp_codes')
      .delete()
      .or(`used.eq.true,expires_at.lt.${now}`)
      .select();

    if (error) {
      console.error('[Supabase] Error purging OTPs:', error);
      return { success: false, error: error.message };
    }
    return { success: true, deleted: data ? data.length : 0 };
  } catch (err) {
    console.error('[Supabase] purgeExpiredOTPs error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get aggregated financial summary from rides/payments for Moolre overview
 */
async function getPaymentFinancials() {
  try {
    const { data: rides, error: ridesErr } = await requireSupabase()
      .from('rides')
      .select('id, estimated_fare, actual_fare, status, requested_at, completed_at, passenger_id, rider_id')
      .order('requested_at', { ascending: false });

    if (ridesErr) {
      console.error('[Supabase] Error getting rides for financials:', ridesErr);
    }

    const allRides = rides || [];
    const completed = allRides.filter(r => r.status === 'completed');
    const pendingRides = allRides.filter(r => r.status === 'requested' || r.status === 'accepted' || r.status === 'in_progress');
    const failedRides = allRides.filter(r => r.status === 'cancelled');

    const totalCollected = completed.reduce((sum, r) => sum + parseFloat(r.actual_fare || r.estimated_fare || 0), 0);
    const totalCommission = totalCollected * 0.10; // 10% platform fee
    const totalDisbursed = totalCollected * 0.90;  // 90% rider payout

    return {
      success: true,
      total_collected: totalCollected,
      total_commission: totalCommission,
      total_disbursed: totalDisbursed,
      completed_count: completed.length,
      pending_payments: pendingRides.length,
      failed_payments: failedRides.length,
      total_trips: allRides.length
    };
  } catch (err) {
    console.error('[Supabase] getPaymentFinancials error:', err.message);
    return {
      success: false,
      total_collected: 0,
      total_commission: 0,
      total_disbursed: 0,
      completed_count: 0,
      pending_payments: 0,
      failed_payments: 0,
      total_trips: 0
    };
  }
}

// ─── RIDER APPLICATION OPERATIONS ───

/**
 * Create rider application with strict schema mapping
 */
async function createRiderApplication(applicationData) {
  try {
    // Map input fields to actual table columns in rider_applications
    const allowedFields = [
      'user_id', 'phone', 'first_name', 'last_name', 'email',
      'date_of_birth', 'gender', 'address', 'city', 'region',
      'emergency_contact_name', 'emergency_contact_phone',
      'vehicle_type', 'vehicle_make', 'vehicle_model', 'vehicle_year',
      'vehicle_color', 'license_plate', 'driver_license_url',
      'insurance_url', 'vehicle_registration_url', 'ghana_card_url',
      'passport_photo_url', 'status'
    ];

    const cleanData = {};
    for (const field of allowedFields) {
      if (applicationData[field] !== undefined) {
        cleanData[field] = applicationData[field];
      }
    }

    // Handle common alternative field names from various forms
    if (!cleanData.first_name && (applicationData.fname || applicationData.firstName)) {
      cleanData.first_name = applicationData.fname || applicationData.firstName;
    }
    if (!cleanData.last_name && (applicationData.lname || applicationData.lastName)) {
      cleanData.last_name = applicationData.lname || applicationData.lastName;
    }
    if (!cleanData.date_of_birth && (applicationData.dob || applicationData.dateOfBirth)) {
      cleanData.date_of_birth = applicationData.dob || applicationData.dateOfBirth;
    }
    if (!cleanData.license_plate && (applicationData.vehicle_plate || applicationData.reg_number || applicationData.vehiclePlate)) {
      cleanData.license_plate = applicationData.vehicle_plate || applicationData.reg_number || applicationData.vehiclePlate;
    }
    if (!cleanData.status) {
      cleanData.status = 'pending';
    }

    // Ensure user_id is a valid UUID or omit it
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (cleanData.user_id && !uuidRegex.test(cleanData.user_id)) {
      delete cleanData.user_id;
    }

    const { data, error } = await requireSupabase()
      .from('rider_applications')
      .insert([cleanData])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Error creating rider application:', error);
      return { success: false, error: error.message };
    }

    return { success: true, application: data };
  } catch (err) {
    console.error('[Supabase] createRiderApplication catch:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get rider applications
 */
async function getRiderApplications(filters = {}) {
  try {
    let query = requireSupabase().from('rider_applications').select('*');

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error getting rider applications:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[Supabase] getRiderApplications catch:', err.message);
    return [];
  }
}

/**
 * Permanently delete a rider application and all associated uploaded documents from disk
 */
async function deleteRiderApplication(applicationId) {
  try {
    const db = requireSupabase();
    let targetApp = null;
    const cleanId = String(applicationId || '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(cleanId)) {
      const { data } = await db.from('rider_applications').select('*').eq('id', cleanId).maybeSingle();
      targetApp = data;
    } else {
      // Look up by phone if numeric/phone format
      const digitsOnly = cleanId.replace(/\D/g, '');
      if (digitsOnly.length >= 9) {
        const { data: byPhone } = await db.from('rider_applications').select('*').ilike('phone', `%${digitsOnly.slice(-9)}%`).maybeSingle();
        if (byPhone) targetApp = byPhone;
      }
      // If still not found, search all applications
      if (!targetApp) {
        const { data: all } = await db.from('rider_applications').select('*');
        if (all && all.length) {
          const matchKey = cleanId.replace(/^APP-|^K3PA-/i, '').toLowerCase();
          targetApp = all.find(a => 
            a.id === cleanId || 
            (a.id && a.id.toLowerCase().startsWith(matchKey)) ||
            (a.phone && a.phone.includes(digitsOnly && digitsOnly.length >= 7 ? digitsOnly.slice(-7) : cleanId))
          );
        }
      }
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'applications');
    let deletedFilesCount = 0;

    // Delete associated physical document files from disk
    if (targetApp) {
      const docUrls = [
        targetApp.driver_license_url,
        targetApp.insurance_url,
        targetApp.vehicle_registration_url,
        targetApp.ghana_card_url,
        targetApp.passport_photo_url
      ];

      if (targetApp.address && targetApp.address.includes('__METADATA__:')) {
        try {
          const parts = targetApp.address.split('__METADATA__:');
          const meta = JSON.parse(parts[1].trim());
          if (Array.isArray(meta.documents)) {
            meta.documents.forEach(d => { if (d.url) docUrls.push(d.url); });
          }
        } catch (_) {}
      }

      if (fs.existsSync(uploadsDir)) {
        for (const url of docUrls) {
          if (url && typeof url === 'string' && url.includes('/uploads/applications/')) {
            const filename = path.basename(url);
            const fullPath = path.join(uploadsDir, filename);
            try {
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                deletedFilesCount++;
                console.log(`[Supabase Service] Deleted document file: ${fullPath}`);
              }
            } catch (err) {
              console.warn(`[Supabase Service] Failed to unlink ${fullPath}:`, err.message);
            }
          }
        }
      }

      // Delete database record permanently
      const { error } = await db
        .from('rider_applications')
        .delete()
        .eq('id', targetApp.id);

      if (error) {
        console.error('[Supabase] Error deleting rider application:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        deletedApp: targetApp,
        deletedFilesCount,
        message: 'Application and associated documents permanently deleted'
      };
    }

    // If not in database (e.g. mock or local fallback submission), still clean disk if files match cleanId
    if (fs.existsSync(uploadsDir) && cleanId.length >= 4) {
      try {
        const files = fs.readdirSync(uploadsDir);
        const searchPattern = cleanId.replace(/[^a-zA-Z0-9_-]/g, '');
        files.forEach(f => {
          if (searchPattern && f.includes(searchPattern)) {
            try {
              fs.unlinkSync(path.join(uploadsDir, f));
              deletedFilesCount++;
            } catch (_) {}
          }
        });
      } catch (_) {}
    }

    return { 
      success: true, 
      deletedApp: { id: cleanId },
      deletedFilesCount,
      message: 'Application removed permanently'
    };
  } catch (err) {
    console.error('[Supabase] deleteRiderApplication catch:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update rider application status
 */
async function updateRiderApplicationStatus(applicationId, status, reviewedBy, rejectionReason = null) {
  const { data, error } = await requireSupabase()
    .from('rider_applications')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      rejection_reason: rejectionReason
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating rider application:', error);
    return null;
  }

  return data;
}

// ─── RIDE OPERATIONS ───

const ALLOWED_RIDE_COLUMNS = new Set([
  'passenger_id', 'rider_id', 'vehicle_id',
  'pickup_address', 'pickup_latitude', 'pickup_longitude', 'pickup_landmark',
  'dropoff_address', 'dropoff_latitude', 'dropoff_longitude', 'dropoff_landmark',
  'distance_km', 'estimated_duration_minutes', 'estimated_fare', 'actual_fare',
  'status', 'requested_at', 'accepted_at', 'arrived_at', 'started_at',
  'completed_at', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
  'passenger_notes', 'rider_notes'
]);

/**
 * Create a new ride
 */
async function createRide(rideData) {
  const safeRideData = {};
  if (rideData && typeof rideData === 'object') {
    for (const [key, value] of Object.entries(rideData)) {
      if (ALLOWED_RIDE_COLUMNS.has(key)) {
        safeRideData[key] = value;
      }
    }
  }

  const { data, error } = await requireSupabase()
    .from('rides')
    .insert([safeRideData])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error creating ride:', error);
    return null;
  }

  return data;
}

/**
 * Get ride by ID
 */
async function getRideById(rideId) {
  const { data, error } = await requireSupabase()
    .from('rides')
    .select('*')
    .eq('id', rideId)
    .single();

  if (error) {
    console.error('[Supabase] Error getting ride:', error);
    return null;
  }

  return data;
}

/**
 * Update ride status
 */
async function updateRideStatus(rideId, statusOrData, additionalData = {}) {
  let status;
  let updateData = {};
  if (typeof statusOrData === 'object' && statusOrData !== null) {
    status = statusOrData.status;
    updateData = { ...statusOrData, ...additionalData };
  } else {
    status = statusOrData;
    updateData = { status, ...additionalData };
  }

  const timestampField = {
    'accepted': 'accepted_at',
    'arriving': 'arrived_at',
    'in_progress': 'started_at',
    'completed': 'completed_at',
    'cancelled': 'cancelled_at'
  }[status] || null;

  if (timestampField && !updateData[timestampField]) {
    updateData[timestampField] = new Date().toISOString();
  }

  const { data, error } = await requireSupabase()
    .from('rides')
    .update(updateData)
    .eq('id', rideId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating ride status:', error);
    return null;
  }

  return data;
}

/**
 * Get rides for a passenger
 */
async function getPassengerRides(passengerId, limit = 20) {
  const { data, error } = await requireSupabase()
    .from('rides')
    .select('*')
    .eq('passenger_id', passengerId)
    .order('requested_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] Error getting passenger rides:', error);
    return [];
  }

  return data;
}

/**
 * Delete all rides for a passenger (permanently clear ride history from DB)
 */
async function deletePassengerRides(passengerId) {
  const { data, error } = await requireSupabase()
    .from('rides')
    .delete()
    .eq('passenger_id', passengerId)
    .select();

  if (error) {
    console.error('[Supabase] Error deleting passenger rides:', error);
    return { success: false, error: error.message };
  }

  return { success: true, count: data ? data.length : 0 };
}

/**
 * Get rides for a rider
 */
async function getRiderRides(riderId, limit = 20) {
  if (!riderId || typeof riderId !== 'string') return [];
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(riderId);
  if (!isUuid) return [];

  const { data, error } = await requireSupabase()
    .from('rides')
    .select('*')
    .eq('rider_id', riderId)
    .order('requested_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] Error getting rider rides:', error);
    return [];
  }

  return data;
}

/**
 * Get available rides (for riders to accept)
 */
async function getAvailableRides() {
  const { data, error } = await requireSupabase()
    .from('rides')
    .select('*')
    .eq('status', 'searching')
    .order('requested_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[Supabase] Error getting available rides:', error);
    return [];
  }

  return data;
}

/**
 * Get all rides (for admin dashboard)
 */
async function getAllRides(limit = 100) {
  try {
    const { data, error } = await requireSupabase()
      .from('rides')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Supabase] Error getting all rides:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Supabase] getAllRides catch:', err.message);
    return [];
  }
}

/**
 * Get available riders near a location
 */
async function getAvailableRiders(lat = null, lng = null, radiusKm = 5) {
  const { data, error } = await requireSupabase()
    .from('users')
    .select('*')
    .eq('role', 'rider')
    .eq('status', 'active');

  if (error) {
    console.error('[Supabase] Error getting available riders:', error);
    return [];
  }

  return data || [];
}

// ─── VEHICLE OPERATIONS ───

/**
 * Create rider vehicle
 */
async function createVehicle(vehicleData) {
  const { data, error } = await requireSupabase()
    .from('rider_vehicles')
    .insert([vehicleData])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error creating vehicle:', error);
    return null;
  }

  return data;
}

/**
 * Get rider vehicles
 */
async function getRiderVehicles(riderId) {
  const { data, error } = await requireSupabase()
    .from('rider_vehicles')
    .select('*')
    .eq('rider_id', riderId)
    .eq('is_active', true);

  if (error) {
    console.error('[Supabase] Error getting rider vehicles:', error);
    return [];
  }

  return data;
}

// ─── PAYMENT OPERATIONS ───

/**
 * Create payment record
 */
async function createPayment(paymentData) {
  const { data, error } = await requireSupabase()
    .from('payments')
    .insert([paymentData])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error creating payment:', error);
    return null;
  }

  return data;
}

/**
 * Update payment status
 */
async function updatePaymentStatus(paymentId, status, processedAt = null) {
  const { data, error } = await requireSupabase()
    .from('payments')
    .update({
      payment_status: status,
      processed_at: processedAt || new Date().toISOString()
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error updating payment status:', error);
    return null;
  }

  return data;
}

// ─── RIDER APPLICATION OPERATIONS ───

/**
 * Get all rider applications
 */
async function getRiderApplications() {
  const { data, error } = await requireSupabase()
    .from('rider_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Supabase] Error getting rider applications:', error);
    return [];
  }

  return data;
}

/**
 * Approve a rider application
 */
async function approveRiderApplication(applicationId) {
  try {
    const db = requireSupabase();
    const cleanId = String(applicationId || '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let application = null;

    if (uuidRegex.test(cleanId)) {
      const { data } = await db.from('rider_applications').select('*').eq('id', cleanId).maybeSingle();
      application = data;
    } else {
      const digitsOnly = cleanId.replace(/\D/g, '');
      if (digitsOnly.length >= 7) {
        const { data: byPhone } = await db.from('rider_applications').select('*').ilike('phone', `%${digitsOnly.slice(-7)}%`).maybeSingle();
        application = byPhone;
      }
      if (!application) {
        const { data: all } = await db.from('rider_applications').select('*');
        if (all && all.length) {
          const matchKey = cleanId.replace(/^APP-|^K3PA-/i, '').toLowerCase();
          application = all.find(a => 
            a.id === cleanId || 
            (a.id && a.id.toLowerCase().startsWith(matchKey)) ||
            (a.phone && digitsOnly.length >= 7 && a.phone.includes(digitsOnly.slice(-7)))
          );
        }
      }
    }

    // If application is not found in database (e.g. local mock or client fallback), gracefully handle approval
    if (!application) {
      const defaultApp = {
        id: cleanId,
        first_name: 'Approved Rider',
        last_name: '',
        phone: cleanId.startsWith('0') || cleanId.startsWith('+') ? cleanId : '',
        status: 'approved'
      };
      return { 
        success: true, 
        application: defaultApp,
        message: 'Application approved successfully'
      };
    }

    // Update application status
    const updatePayload = {
      status: 'approved',
      reviewed_at: new Date().toISOString()
    };

    const { data: updatedApp, error: updateError } = await db
      .from('rider_applications')
      .update(updatePayload)
      .eq('id', application.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Supabase] Error approving application:', updateError);
      return { success: false, error: 'Failed to approve application: ' + updateError.message };
    }

    // Update or create rider account so rider can log in
    try {
      let riderUserId = application.user_id;
      if (!riderUserId) {
        let existingUser = await findUserByPhone(application.phone, 'rider');
        if (!existingUser) {
          existingUser = await findUserByPhone(application.phone, 'passenger');
        }
        if (existingUser) {
          riderUserId = existingUser.id;
        } else {
          const createRes = await createUser({
            phone: application.phone,
            firstName: application.first_name,
            lastName: application.last_name,
            fullName: `${application.first_name || ''} ${application.last_name || ''}`.trim(),
            email: application.email,
            role: 'rider'
          });
          if (createRes?.id) {
            riderUserId = createRes.id;
          }
        }
        if (riderUserId) {
          await db
            .from('rider_applications')
            .update({ user_id: riderUserId })
            .eq('id', application.id);
        }
      }

      if (riderUserId) {
        await db
          .from('users')
          .update({ status: 'active', role: 'rider' })
          .eq('id', riderUserId);
      }
    } catch (userErr) {
      console.warn('[Supabase] Warning updating user account on application approval:', userErr.message);
    }

    return { success: true, application: updatedApp };
  } catch (err) {
    console.error('[Supabase] approveRiderApplication catch:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Reject a rider application
 */
async function rejectRiderApplication(applicationId, reason) {
  try {
    const db = requireSupabase();
    const cleanId = String(applicationId || '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let application = null;

    if (uuidRegex.test(cleanId)) {
      const { data } = await db.from('rider_applications').select('*').eq('id', cleanId).maybeSingle();
      application = data;
    } else {
      const digitsOnly = cleanId.replace(/\D/g, '');
      if (digitsOnly.length >= 7) {
        const { data: byPhone } = await db.from('rider_applications').select('*').ilike('phone', `%${digitsOnly.slice(-7)}%`).maybeSingle();
        application = byPhone;
      }
      if (!application) {
        const { data: all } = await db.from('rider_applications').select('*');
        if (all && all.length) {
          const matchKey = cleanId.replace(/^APP-|^K3PA-/i, '').toLowerCase();
          application = all.find(a => 
            a.id === cleanId || 
            (a.id && a.id.toLowerCase().startsWith(matchKey)) ||
            (a.phone && digitsOnly.length >= 7 && a.phone.includes(digitsOnly.slice(-7)))
          );
        }
      }
    }

    if (!application) {
      return { 
        success: true, 
        application: { id: cleanId, status: 'rejected', rejection_reason: reason },
        message: 'Application rejected'
      };
    }

    // Update application status
    const { data: updatedApp, error: updateError } = await db
      .from('rider_applications')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', application.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Supabase] Error rejecting application:', updateError);
      return { success: false, error: 'Failed to reject application' };
    }

    // Update user status to suspended
    if (application.user_id) {
      try {
        await db
          .from('users')
          .update({ status: 'suspended' })
          .eq('id', application.user_id);
      } catch (_) {}
    }

    return { success: true, application: updatedApp };
  } catch (err) {
    console.error('[Supabase] rejectRiderApplication catch:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check latest rider application status for a given phone
 */
async function getRiderApplicationStatus(phone) {
  try {
    if (!phone) return null;
    let norm = phone;
    try {
      const { normalizePhone } = require('../utils/phone');
      norm = normalizePhone(phone);
    } catch (_) {}

    const { data, error } = await requireSupabase()
      .from('rider_applications')
      .select('*')
      .eq('phone', norm)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) return data[0];

    // Try alternate phone representation (with/without leading zero or +233)
    const alt = phone.startsWith('+233') ? '0' + phone.slice(4) : (phone.startsWith('0') ? '+233' + phone.slice(1) : phone);
    const { data: dataAlt } = await requireSupabase()
      .from('rider_applications')
      .select('*')
      .eq('phone', alt)
      .order('created_at', { ascending: false })
      .limit(1);

    if (dataAlt && dataAlt.length > 0) return dataAlt[0];
    return null;
  } catch (err) {
    console.warn('[Supabase] Error in getRiderApplicationStatus:', err.message);
    return null;
  }
}

/**
 * Get approved riders with vehicle details and uploaded documents
 */
async function getApprovedRiders() {
  try {
    const { data: users, error: userError } = await requireSupabase()
      .from('users')
      .select('*')
      .eq('role', 'rider')
      .neq('status', 'deleted');

    const { data: apps, error: appError } = await requireSupabase()
      .from('rider_applications')
      .select('*')
      .in('status', ['approved', 'suspended']);

    const appMap = new Map();
    if (apps && Array.isArray(apps)) {
      for (const app of apps) {
        let parsedDocs = [];
        if (app.address && app.address.includes('__METADATA__:')) {
          try {
            const meta = JSON.parse(app.address.split('__METADATA__:')[1].trim());
            if (meta.documents) parsedDocs = meta.documents;
          } catch (_) {}
        }
        app.documents = parsedDocs;
        if (app.phone) appMap.set(app.phone, app);
        if (app.user_id) appMap.set(app.user_id, app);
      }
    }

    const ridersList = [];
    const processedPhones = new Set();

    if (users && Array.isArray(users)) {
      for (const u of users) {
        const matchingApp = appMap.get(u.phone) || appMap.get(u.id);
        if (u.phone) processedPhones.add(u.phone);

        const riderStatus = (u.status === 'suspended' || matchingApp?.status === 'suspended') ? 'suspended' : 'active';
        const isAvailable = riderStatus === 'suspended' ? false : (u.is_available ?? true);

        const cleanRiderId = matchingApp?.rider_id ||
          matchingApp?.app_ref ||
          u.rider_id ||
          (u.phone ? `K3R-${String(u.phone).replace(/\D/g, '').slice(-6)}` : `K3R-${String(u.id).slice(0, 6)}`);
        const cleanAppRef = matchingApp?.app_ref || (matchingApp?.id ? `APP-${matchingApp.id.substring(0, 8).toUpperCase()}` : null);

        const riderObj = {
          id: u.id,
          user_id: u.id,
          rider_id: cleanRiderId,
          k3r_id: cleanRiderId,
          app_ref: cleanAppRef,
          fname: u.first_name || matchingApp?.first_name || 'Rider',
          lname: u.last_name || matchingApp?.last_name || '',
          phone: u.phone || matchingApp?.phone || '',
          email: u.email || matchingApp?.email || '',
          role: 'rider',
          status: riderStatus,
          is_available: isAvailable,
          on_trip: false,
          rating: 4.9,
          trips_completed: 0,
          total_earnings: 0,
          vehicle_type: matchingApp?.vehicle_type || 'Tricycle',
          vehicle_make: matchingApp?.vehicle_make || '',
          vehicle_model: matchingApp?.vehicle_model || '',
          vehicle_year: matchingApp?.vehicle_year || '',
          vehicle_color: matchingApp?.vehicle_color || '',
          vehicle_plate: matchingApp?.license_plate || matchingApp?.vehicle_plate || '—',
          driver_license_url: matchingApp?.driver_license_url || null,
          vehicle_registration_url: matchingApp?.vehicle_registration_url || null,
          ghana_card_url: matchingApp?.ghana_card_url || null,
          insurance_url: matchingApp?.insurance_url || null,
          passport_photo_url: matchingApp?.passport_photo_url || null,
          documents: matchingApp?.documents || [],
          joined: u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Recently'
        };
        ridersList.push(riderObj);
      }
    }

    // Also include any approved applications that don't have a users record yet
    if (apps && Array.isArray(apps)) {
      for (const app of apps) {
        if (app.phone && !processedPhones.has(app.phone)) {
          processedPhones.add(app.phone);
          const appStatus = app.status === 'suspended' ? 'suspended' : 'active';
          const cleanAppRiderId = app.rider_id ||
            app.app_ref ||
            (app.phone ? `K3R-${String(app.phone).replace(/\D/g, '').slice(-6)}` : `K3R-${String(app.id).slice(0, 6)}`);
          const cleanAppRef = app.app_ref || (app.id ? `APP-${app.id.substring(0, 8).toUpperCase()}` : null);
          ridersList.push({
            id: app.user_id || app.id,
            rider_id: cleanAppRiderId,
            k3r_id: cleanAppRiderId,
            app_ref: cleanAppRef,
            fname: app.first_name || 'Rider',
            lname: app.last_name || '',
            phone: app.phone || '',
            email: app.email || '',
            role: 'rider',
            status: appStatus,
            is_available: appStatus === 'suspended' ? false : true,
            on_trip: false,
            rating: 5.0,
            trips_completed: 0,
            total_earnings: 0,
            vehicle_type: app.vehicle_type || 'Tricycle',
            vehicle_make: app.vehicle_make || '',
            vehicle_model: app.vehicle_model || '',
            vehicle_year: app.vehicle_year || '',
            vehicle_color: app.vehicle_color || '',
            vehicle_plate: app.license_plate || app.vehicle_plate || '—',
            driver_license_url: app.driver_license_url || null,
            vehicle_registration_url: app.vehicle_registration_url || null,
            ghana_card_url: app.ghana_card_url || null,
            insurance_url: app.insurance_url || null,
            passport_photo_url: app.passport_photo_url || null,
            documents: app.documents || [],
            joined: app.created_at ? new Date(app.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Recently'
          });
        }
      }
    }

    return ridersList;
  } catch (err) {
    console.error('[Supabase] Error in getApprovedRiders:', err);
    return [];
  }
}

/**
 * Get pending riders
 */
async function getPendingRiders() {
  const { data, error } = await requireSupabase()
    .from('users')
    .select('*')
    .eq('role', 'rider')
    .eq('status', 'pending');

  if (error) {
    console.error('[Supabase] Error getting pending riders:', error);
    return [];
  }

  return data;
}

/**
 * Suspend a rider account
 */
async function suspendRider(riderId, reason = 'Suspended by admin') {
  try {
    const supabase = requireSupabase();
    let phone = null;
    let riderName = 'Rider';

    const { data: user } = await supabase.from('users').select('*').eq('id', riderId).maybeSingle();
    if (user) {
      phone = user.phone;
      riderName = user.first_name || riderName;
      await supabase.from('users').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', riderId);
    }

    const { data: app } = await supabase.from('rider_applications').select('*').or(`id.eq.${riderId},user_id.eq.${riderId}`).maybeSingle();
    if (app) {
      if (!phone) phone = app.phone;
      if (riderName === 'Rider') riderName = app.first_name || riderName;
      await supabase.from('rider_applications').update({ status: 'suspended', rejection_reason: reason, updated_at: new Date().toISOString() }).eq('id', app.id);
    }

    if (phone) {
      await supabase.from('users').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('phone', phone);
      await supabase.from('rider_applications').update({ status: 'suspended', rejection_reason: reason, updated_at: new Date().toISOString() }).eq('phone', phone);
    }

    return { success: true, message: 'Rider suspended successfully', status: 'suspended', phone, riderName };
  } catch (err) {
    console.error('[Supabase] Error suspending rider:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reactivate / Unsuspend a rider account
 */
async function unsuspendRider(riderId) {
  try {
    const supabase = requireSupabase();
    let phone = null;
    let riderName = 'Rider';

    const { data: user } = await supabase.from('users').select('*').eq('id', riderId).maybeSingle();
    if (user) {
      phone = user.phone;
      riderName = user.first_name || riderName;
      await supabase.from('users').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', riderId);
    }

    const { data: app } = await supabase.from('rider_applications').select('*').or(`id.eq.${riderId},user_id.eq.${riderId}`).maybeSingle();
    if (app) {
      if (!phone) phone = app.phone;
      if (riderName === 'Rider') riderName = app.first_name || riderName;
      await supabase.from('rider_applications').update({ status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() }).eq('id', app.id);
    }

    if (phone) {
      await supabase.from('users').update({ status: 'active', updated_at: new Date().toISOString() }).eq('phone', phone);
      await supabase.from('rider_applications').update({ status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() }).eq('phone', phone);
    }

    return { success: true, message: 'Rider account reactivated successfully', status: 'active', phone, riderName };
  } catch (err) {
    console.error('[Supabase] Error unsuspending rider:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Permanently remove / delete a rider account
 */
async function deleteRider(riderId) {
  try {
    const supabase = requireSupabase();
    let phone = null;

    const { data: user } = await supabase.from('users').select('*').eq('id', riderId).maybeSingle();
    if (user) {
      phone = user.phone;
      await supabase.from('users').delete().eq('id', riderId);
    }

    const { data: app } = await supabase.from('rider_applications').select('*').or(`id.eq.${riderId},user_id.eq.${riderId}`).maybeSingle();
    if (app) {
      if (!phone) phone = app.phone;
      await supabase.from('rider_applications').delete().eq('id', app.id);
    }

    if (phone) {
      await supabase.from('users').delete().eq('phone', phone).eq('role', 'rider');
      await supabase.from('rider_applications').delete().eq('phone', phone);
    }

    return { success: true, message: 'Rider account removed successfully' };
  } catch (err) {
    console.error('[Supabase] Error deleting rider:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get registered passengers
 */
async function getRegisteredPassengers() {
  try {
    const { data, error } = await requireSupabase()
      .from('users')
      .select('*')
      .eq('role', 'passenger')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error getting registered passengers:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[Supabase] getRegisteredPassengers catch:', err.message);
    return [];
  }
}

// ─── NOTIFICATION OPERATIONS ───

/**
 * Create notification
 */
async function createNotification(userId, title, message, type = 'info', actionUrl = null) {
  const { data, error } = await requireSupabase()
    .from('notifications')
    .insert([{
      user_id: userId,
      title,
      message,
      type,
      action_url: actionUrl
    }])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error creating notification:', error);
    return null;
  }

  return data;
}

/**
 * Get user notifications
 */
async function getUserNotifications(userId, unreadOnly = false) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

  if (error) {
    console.error('[Supabase] Error getting notifications:', error);
    return [];
  }

  return data;
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId) {
  const { error } = await requireSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('[Supabase] Error marking notification as read:', error);
  }
}

// ─── HEALTH CHECK ───

/**
 * Test database connection
 */
async function healthCheck() {
  try {
    const { data, error } = await requireSupabase()
      .from('users')
      .select('count')
      .limit(1)
      .single();

    if (error) throw error;

    return { 
      status: 'ok', 
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { 
      status: 'error', 
      message: 'Database connection failed',
      error: error.message
    };
  }
}

// Schedule cleanup of expired OTPs every 5 minutes (daemon/server only, not in serverless)
if (process.env.VERCEL !== '1' && typeof setInterval !== 'undefined') {
  const otpTimer = setInterval(() => {
    cleanupExpiredOTPs().catch(() => {});
  }, 5 * 60 * 1000);
  if (otpTimer && typeof otpTimer.unref === 'function') {
    otpTimer.unref();
  }
}

module.exports = {
  // User operations
  findUserByPhone,
  findAllUsersByPhone,
  findUserByEmail,
  createUser,
  updateUser,
  updateUserLastLogin,

  // OTP operations
  storeOTP,
  verifyOTP,
  cleanupExpiredOTPs,
  getOTPLogs,
  purgeExpiredOTPs,

  // Rider application operations
  createRiderApplication,
  getRiderApplications,
  getRiderApplicationStatus,
  approveRiderApplication,
  rejectRiderApplication,
  deleteRiderApplication,
  getApprovedRiders,
  getPendingRiders,
  getRegisteredPassengers,
  suspendRider,
  unsuspendRider,
  deleteRider,

  // Ride operations
  createRide,
  getRideById,
  getAllRides,
  updateRideStatus,
  getPassengerRides,
  deletePassengerRides,
  getRiderRides,
  getAvailableRides,
  getAvailableRiders,

  // Vehicle operations
  createVehicle,
  getRiderVehicles,

  // Payment operations
  createPayment,
  updatePaymentStatus,
  getPaymentFinancials,

  // Notification operations
  createNotification,
  getUserNotifications,
  markNotificationAsRead,

  // Health check
  healthCheck
};
