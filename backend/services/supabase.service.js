/**
 * K3K3 Backend — Supabase Database Service
 * 
 * Handles all database operations using Supabase client.
 * Replaces in-memory storage with persistent database.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase] ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── USER OPERATIONS ───

/**
 * Find user by phone number
 */
async function findUserByPhone(phone, role) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .eq('role', role)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Supabase] Error finding user by phone:', error);
  }

  return data || null;
}

/**
 * Find all users by phone number (for checking multiple roles)
 */
async function findAllUsersByPhone(phone) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data: existingUsers } = await supabase
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

  const { data, error } = await supabase
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

/**
 * Update user
 */
async function updateUser(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
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
  const { error } = await supabase
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
  await supabase
    .from('otp_codes')
    .update({ used: true })
    .eq('phone', phone)
    .eq('used', false);

  // Insert new OTP
  const { data, error } = await supabase
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
    return null;
  }

  console.log(`[Supabase] Stored OTP for ${phone}: ${code} (expires: ${expiresAt})`);
  return data;
}

/**
 * Verify OTP code
 */
async function verifyOTP(phone, code) {
  const { data: otp, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !otp) {
    return { valid: false, error: 'No OTP found. Please request a new code.' };
  }

  // Check if expired
  if (new Date() > new Date(otp.expires_at)) {
    await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id);
    return { valid: false, error: 'Code has expired. Please request a new one.' };
  }

  // Mark as used
  const { error: updateError } = await supabase
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
  const { error } = await supabase
    .from('otp_codes')
    .delete()
    .lt('expires_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

  if (error) {
    console.error('[Supabase] Error cleaning up OTPs:', error);
  } else {
    console.log('[Supabase] Cleaned up expired OTPs');
  }
}

// ─── RIDER APPLICATION OPERATIONS ───

/**
 * Create rider application
 */
async function createRiderApplication(applicationData) {
  const { data, error } = await supabase
    .from('rider_applications')
    .insert([applicationData])
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error creating rider application:', error);
    return null;
  }

  return data;
}

/**
 * Get rider applications
 */
async function getRiderApplications(filters = {}) {
  let query = supabase.from('rider_applications').select('*');

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

  return data;
}

/**
 * Update rider application status
 */
async function updateRiderApplicationStatus(applicationId, status, reviewedBy, rejectionReason = null) {
  const { data, error } = await supabase
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

/**
 * Create a new ride
 */
async function createRide(rideData) {
  const { data, error } = await supabase
    .from('rides')
    .insert([rideData])
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
  const { data, error } = await supabase
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
async function updateRideStatus(rideId, status, additionalData = {}) {
  const timestampField = {
    'accepted': 'accepted_at',
    'arriving': 'arrived_at',
    'in_progress': 'started_at',
    'completed': 'completed_at',
    'cancelled': 'cancelled_at'
  }[status] || null;

  const updateData = {
    status,
    ...additionalData
  };

  if (timestampField) {
    updateData[timestampField] = new Date().toISOString();
  }

  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
 * Get rides for a rider
 */
async function getRiderRides(riderId, limit = 20) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
 * Get available riders near a location
 */
async function getAvailableRiders(lat = null, lng = null, radiusKm = 5) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  // Get the application first
  const { data: application, error: fetchError } = await supabase
    .from('rider_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (fetchError || !application) {
    return { success: false, error: 'Application not found' };
  }

  // Update application status
  const { data: updatedApp, error: updateError } = await supabase
    .from('rider_applications')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin'
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (updateError) {
    console.error('[Supabase] Error approving application:', updateError);
    return { success: false, error: 'Failed to approve application' };
  }

  // Update user status to active
  if (application.user_id) {
    await supabase
      .from('users')
      .update({ status: 'active' })
      .eq('id', application.user_id);
  }

  return { success: true, application: updatedApp };
}

/**
 * Reject a rider application
 */
async function rejectRiderApplication(applicationId, reason) {
  // Get the application first
  const { data: application, error: fetchError } = await supabase
    .from('rider_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (fetchError || !application) {
    return { success: false, error: 'Application not found' };
  }

  // Update application status
  const { data: updatedApp, error: updateError } = await supabase
    .from('rider_applications')
    .update({
      status: 'rejected',
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin'
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (updateError) {
    console.error('[Supabase] Error rejecting application:', updateError);
    return { success: false, error: 'Failed to reject application' };
  }

  // Update user status to suspended
  if (application.user_id) {
    await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', application.user_id);
  }

  return { success: true, application: updatedApp };
}

/**
 * Get approved riders
 */
async function getApprovedRiders() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'rider')
    .eq('status', 'active');

  if (error) {
    console.error('[Supabase] Error getting approved riders:', error);
    return [];
  }

  return data;
}

/**
 * Get pending riders
 */
async function getPendingRiders() {
  const { data, error } = await supabase
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

// ─── NOTIFICATION OPERATIONS ───

/**
 * Create notification
 */
async function createNotification(userId, title, message, type = 'info', actionUrl = null) {
  const { data, error } = await supabase
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
  const { error } = await supabase
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
    const { data, error } = await supabase
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

// Schedule cleanup of expired OTPs every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

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

  // Rider application operations
  createRiderApplication,
  getRiderApplications,
  approveRiderApplication,
  rejectRiderApplication,
  getApprovedRiders,
  getPendingRiders,

  // Ride operations
  createRide,
  getRideById,
  updateRideStatus,
  getPassengerRides,
  getRiderRides,
  getAvailableRides,
  getAvailableRiders,

  // Vehicle operations
  createVehicle,
  getRiderVehicles,

  // Payment operations
  createPayment,
  updatePaymentStatus,

  // Notification operations
  createNotification,
  getUserNotifications,
  markNotificationAsRead,

  // Health check
  healthCheck
};
