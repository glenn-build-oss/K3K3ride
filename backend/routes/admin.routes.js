/**
 * K3K3 Backend — Admin Routes
 * 
 * Handles admin-specific operations:
 * - Rider application management (list, approve, reject)
 * - Rider management
 * - Admin dashboard data
 */

const express = require('express');
const router = express.Router();
const { sendSMS } = require('../services/moolre.service');
const { normalizePhone } = require('../utils/phone');
const { 
  createRiderApplication,
  getRiderApplications, 
  approveRiderApplication, 
  rejectRiderApplication,
  deleteRiderApplication,
  getApprovedRiders,
  getPendingRiders,
  getRegisteredPassengers,
  suspendRider,
  unsuspendRider,
  deleteRider,
  findUserByPhone
} = require('../services/supabase.service');

// ─── Rider Applications ───

const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'applications');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (_) {}
}

/**
 * Save Base64 data URL to local disk in uploads/applications
 */
function saveBase64Document(docKey, docObj, appId) {
  if (!docObj) return null;
  const rawData = typeof docObj === 'string' ? docObj : (docObj.data || docObj.url);
  if (!rawData || typeof rawData !== 'string') return null;

  if (rawData.startsWith('http') || rawData.startsWith('/uploads/')) {
    return rawData;
  }

  try {
    const commaIndex = rawData.indexOf(',');
    if (commaIndex === -1 || !rawData.startsWith('data:')) {
      return null;
    }
    const metaPart = rawData.substring(5, commaIndex); // e.g. "image/png;base64"
    const base64Data = rawData.substring(commaIndex + 1);
    const mimeType = (metaPart.split(';')[0] || '').toLowerCase();
    const buffer = Buffer.from(base64Data, 'base64');
    
    let ext = 'jpg';
    if (mimeType.includes('pdf')) ext = 'pdf';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (docObj.name && docObj.name.includes('.')) ext = docObj.name.split('.').pop().toLowerCase();

    const safeKey = docKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeId = (appId || Date.now()).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeId}_${safeKey}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/applications/${fileName}`;
  } catch (err) {
    console.error(`[Admin] Error saving document ${docKey}:`, err.message);
    return null;
  }
}

/**
 * Helper to enrich and format application record with all form fields
 */
function enrichApplication(app) {
  if (!app) return app;
  const enriched = { ...app };

  // Parse extra metadata if encoded in address
  if (enriched.address && enriched.address.includes('__METADATA__:')) {
    try {
      const parts = enriched.address.split('__METADATA__:');
      enriched.address = parts[0].trim();
      const meta = JSON.parse(parts[1].trim());
      Object.assign(enriched, meta);
    } catch (_) {}
  }

  // Ensure all alternative field names match seamlessly
  enriched.first_name = enriched.first_name || enriched.fname || enriched.firstName || '';
  enriched.last_name = enriched.last_name || enriched.lname || enriched.lastName || '';
  enriched.fname = enriched.first_name;
  enriched.lname = enriched.last_name;
  enriched.full_name = `${enriched.first_name} ${enriched.last_name}`.trim();
  enriched.vehicle_plate = enriched.license_plate || enriched.vehicle_plate || enriched.reg_number;
  enriched.reg_number = enriched.vehicle_plate;
  enriched.license_number = enriched.license_number || enriched.licence_number || enriched.driver_license_url;
  enriched.driver_license_url = enriched.driver_license_url || enriched.license_number;
  enriched.ghana_card_number = enriched.ghana_card_number || enriched.id_number || enriched.ghana_card_url;
  enriched.ghana_card_url = enriched.ghana_card_url || enriched.ghana_card_number;
  enriched.nationality = enriched.nationality || enriched.region || 'Ghanaian';

  // Fallback for experience
  if (!enriched.experience && enriched.emergency_contact_name && enriched.emergency_contact_name.startsWith('Exp:')) {
    enriched.experience = enriched.emergency_contact_name.replace('Exp:', '').trim();
  }

  // Documents array structure for preview
  if (!enriched.documents || !Array.isArray(enriched.documents)) {
    enriched.documents = [];
  }

  // Map the 5 standard document types
  const standardDocs = [
    { key: 'riderLicense', label: "Rider's License", url: enriched.driver_license_url },
    { key: 'vehicleRegistration', label: "Vehicle Registration", url: enriched.vehicle_registration_url },
    { key: 'idCardFront', label: "National ID — Front", url: enriched.ghana_card_url },
    { key: 'idCardBack', label: "National ID — Back", url: enriched.insurance_url },
    { key: 'passportPhoto', label: "Passport Photo", url: enriched.passport_photo_url }
  ];

  for (const std of standardDocs) {
    if (std.url && (std.url.startsWith('http') || std.url.startsWith('/uploads/'))) {
      if (!enriched.documents.some(d => d.key === std.key || d.url === std.url)) {
        const isPdf = typeof std.url === 'string' && std.url.toLowerCase().endsWith('.pdf');
        enriched.documents.push({
          key: std.key,
          label: std.label,
          name: std.label,
          url: std.url,
          type: isPdf ? 'pdf' : 'image'
        });
      }
    }
  }

  return enriched;
}

/**
 * POST /api/admin/applications
 * Submit a new rider application (from passenger dashboard or rider apply form)
 */
router.post('/applications', async (req, res) => {
  try {
    const body = req.body || {};
    const rawPhone = body.phone || '';

    if (!rawPhone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    let phone = rawPhone;
    try {
      phone = normalizePhone(rawPhone);
    } catch (_) {}

    const firstName = body.first_name || body.fname || body.firstName || '';
    const lastName = body.last_name || body.lname || body.lastName || '';

    // Find or associate user_id if valid UUID exists
    let userId = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (body.user_id && uuidRegex.test(body.user_id)) {
      userId = body.user_id;
    } else {
      const existingUser = await findUserByPhone(phone, 'passenger') || await findUserByPhone(phone, 'rider');
      if (existingUser && existingUser.id && uuidRegex.test(existingUser.id)) {
        userId = existingUser.id;
      }
    }

    // Process uploaded document files (Base64 data URLs)
    const docsInput = body.documents || {};
    const tempAppId = 'app_' + Date.now();
    const savedDocUrls = {};
    const savedDocList = [];

    const docDefs = [
      { key: 'riderLicense', aliases: ['rider_license', 'driver_license', 'license'], label: "Rider's License", targetCol: 'driver_license_url' },
      { key: 'vehicleRegistration', aliases: ['vehicle_registration', 'registration'], label: "Vehicle Registration", targetCol: 'vehicle_registration_url' },
      { key: 'idCardFront', aliases: ['id_card_front', 'national_id_front', 'ghana_card_front'], label: "National ID — Front", targetCol: 'ghana_card_url' },
      { key: 'idCardBack', aliases: ['id_card_back', 'national_id_back', 'ghana_card_back'], label: "National ID — Back", targetCol: 'insurance_url' },
      { key: 'passportPhoto', aliases: ['passport_photo', 'photo'], label: "Passport Photo", targetCol: 'passport_photo_url' }
    ];

    for (const def of docDefs) {
      let docData = docsInput[def.key];
      if (!docData) {
        for (const alias of def.aliases) {
          if (docsInput[alias]) {
            docData = docsInput[alias];
            break;
          }
        }
      }
      if (docData) {
        const savedUrl = saveBase64Document(def.key, docData, tempAppId);
        if (savedUrl) {
          savedDocUrls[def.targetCol] = savedUrl;
          savedDocList.push({
            key: def.key,
            label: def.label,
            name: docData.name || (def.label + '.jpg'),
            url: savedUrl,
            type: (docData.type && docData.type.includes('pdf')) ? 'pdf' : 'image'
          });
        }
      }
    }

    // Capture extra fields into metadata block
    const extraMeta = {};
    if (body.nationality) extraMeta.nationality = body.nationality;
    if (body.experience) extraMeta.experience = body.experience;
    if (body.license_expiry || body.licence_expiry || body.licenseExpiry) {
      extraMeta.license_expiry = body.license_expiry || body.licence_expiry || body.licenseExpiry;
    }
    if (body.vehicle_seats || body.vehicleSeats) extraMeta.vehicle_seats = body.vehicle_seats || body.vehicleSeats;
    if (body.about || body.extra) extraMeta.about = body.about || body.extra;
    if (body.id_type || body.idType) extraMeta.id_type = body.id_type || body.idType;
    if (body.emergency_contact_name) extraMeta.emergency_contact_name = body.emergency_contact_name;
    if (body.emergency_contact_phone) extraMeta.emergency_contact_phone = body.emergency_contact_phone;
    if (savedDocList.length > 0) extraMeta.documents = savedDocList;

    let baseAddress = (body.address || '').trim();
    let formattedAddress = baseAddress;
    if (Object.keys(extraMeta).length > 0) {
      formattedAddress = baseAddress ? `${baseAddress}\n__METADATA__:${JSON.stringify(extraMeta)}` : `__METADATA__:${JSON.stringify(extraMeta)}`;
    }

    const applicationData = {
      phone,
      first_name: firstName || 'Applicant',
      last_name: lastName || '',
      email: body.email || null,
      date_of_birth: body.date_of_birth || body.dob || body.dateOfBirth || null,
      gender: body.gender || null,
      address: formattedAddress || null,
      city: body.city || null,
      region: body.region || body.nationality || null,
      emergency_contact_name: body.emergency_contact_name || (body.experience ? `Exp: ${body.experience}` : null),
      emergency_contact_phone: body.emergency_contact_phone || null,
      vehicle_type: body.vehicle_type || body.vehicleType || null,
      vehicle_make: body.vehicle_make || body.vehicleMake || null,
      vehicle_model: body.vehicle_model || body.vehicleModel || null,
      vehicle_year: body.vehicle_year || body.vehicleYear ? parseInt(body.vehicle_year || body.vehicleYear, 10) : null,
      vehicle_color: body.vehicle_color || body.vehicleColor || null,
      license_plate: body.license_plate || body.vehicle_plate || body.reg_number || body.vehiclePlate || null,
      driver_license_url: savedDocUrls.driver_license_url || body.driver_license_url || body.licence_number || body.license_number || body.licenseNumber || null,
      vehicle_registration_url: savedDocUrls.vehicle_registration_url || body.vehicle_registration_url || null,
      ghana_card_url: savedDocUrls.ghana_card_url || body.ghana_card_url || body.ghana_card_number || body.id_number || body.ghanaCardNumber || null,
      insurance_url: savedDocUrls.insurance_url || body.insurance_url || null,
      passport_photo_url: savedDocUrls.passport_photo_url || body.passport_photo_url || null,
      status: 'pending'
    };

    if (userId) {
      applicationData.user_id = userId;
    }

    const result = await createRiderApplication(applicationData);

    if (!result || !result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result?.error || 'Failed to submit application to database' 
      });
    }

    const app = enrichApplication(result.application);
    const appId = app?.id || Date.now();
    const appRef = app?.id ? `APP-${app.id.substring(0, 8).toUpperCase()}` : `APP-${Date.now()}`;

    // Send confirmation SMS if phone is available
    try {
      await sendSMS(
        phone,
        `Hello ${firstName || 'there'}! Your K3K3 rider application (${appRef}) has been received and is under review. Thank you for choosing K3K3ride.`,
        `app_submit_${appId}`
      );
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      id: appId,
      app_ref: appRef,
      application: app
    });

  } catch (error) {
    console.error('[Admin] Error creating application:', error);
    res.status(500).json({ success: false, error: 'Internal server error while saving application' });
  }
});

/**
 * GET /api/admin/applications
 * Get all rider applications
 */
router.get('/applications', async (req, res) => {
  try {
    const rawApps = await getRiderApplications();
    const applications = (rawApps || []).map(enrichApplication);
    res.json({ success: true, applications });
  } catch (error) {
    console.error('[Admin] Error fetching applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch applications' });
  }
});

/**
 * GET /api/admin/applications/pending
 * Get pending rider applications
 */
router.get('/applications/pending', async (req, res) => {
  try {
    const rawApps = await getRiderApplications();
    const applications = (rawApps || []).map(enrichApplication);
    const pending = applications.filter(app => app.status === 'pending' || app.status === 'pending_review' || app.status === 'under_review');
    res.json({ success: true, applications: pending });
  } catch (error) {
    console.error('[Admin] Error fetching pending applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending applications' });
  }
});

/**
 * GET /api/admin/applications/stats/summary
 * Summary for sidebar badge
 */
router.get('/applications/stats/summary', async (req, res) => {
  try {
    const applications = await getRiderApplications();
    const pending = applications.filter(app => app.status === 'pending_review' || app.status === 'pending').length;
    res.json({ success: true, pending, total: applications.length });
  } catch (error) {
    res.json({ success: true, pending: 0, total: 0 });
  }
});

/**
 * POST /api/admin/applications/:id/approve
 * Approve a rider application
 */
router.post('/applications/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await approveRiderApplication(id);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Send approval SMS to rider
    if (result.application && result.application.phone) {
      const riderName = result.application.first_name || 'Rider';
      const riderPhone = result.application.phone;
      const message = `Congratulations ${riderName}! Your K3K3 Rider application has been approved. Thank you for choosing K3K3. You can now log in to your account with your phone number (${riderPhone}) to start accepting rides. Welcome to K3K3!`;
      await sendSMS(riderPhone, message, `approval_${id}`);
    }

    const riderId = 'K3R-' + (result.application?.phone ? result.application.phone.slice(-6) : Math.floor(100000 + Math.random() * 900000));
    const defaultPassword = result.application?.date_of_birth ? result.application.date_of_birth.replace(/\D/g, '') : 'K3k3@' + (result.application?.phone ? result.application.phone.slice(-4) : '2026');

    res.json({ 
      success: true, 
      message: 'Application approved successfully', 
      application: result.application,
      rider_id: riderId,
      first_name: result.application?.first_name || '',
      last_name: result.application?.last_name || '',
      default_password: defaultPassword,
      app_ref: result.application?.id ? `APP-${result.application.id.substring(0, 8).toUpperCase()}` : 'APP-APPROVED'
    });
  } catch (error) {
    console.error('[Admin] Error approving application:', error);
    res.status(500).json({ success: false, error: 'Failed to approve application' });
  }
});

/**
 * PATCH /api/admin/applications/:id/status
 * Update application status (e.g. decline / reject)
 */
router.patch('/applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, reason } = req.body;
    
    const rejectionReason = admin_notes || reason || 'Declined by admin';
    const result = await rejectRiderApplication(id, rejectionReason);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: 'Application status updated', application: result.application });
  } catch (error) {
    console.error('[Admin] Error updating application status:', error);
    res.status(500).json({ success: false, error: 'Failed to update application status' });
  }
});

/**
 * DELETE /api/admin/applications/:id
 * Delete a rider application
 */
router.delete('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteRiderApplication(id);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    console.error('[Admin] Error deleting application:', error);
    res.status(500).json({ success: false, error: 'Failed to delete application' });
  }
});

/**
 * POST /api/admin/applications/:id/reject
 * Reject a rider application
 */
router.post('/applications/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await rejectRiderApplication(id, reason);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Send rejection SMS to rider (optional - if reason provided)
    if (result.application && result.application.phone && reason) {
      const message = `Your rider application has been reviewed. Unfortunately, we could not approve it at this time. Reason: ${reason}. Thank you for your interest in K3K3ride.`;
      await sendSMS(result.application.phone, message, `rejection_${id}`);
    }

    res.json({ success: true, message: 'Application rejected successfully', application: result.application });
  } catch (error) {
    console.error('[Admin] Error rejecting application:', error);
    res.status(500).json({ success: false, error: 'Failed to reject application' });
  }
});

/**
 * GET /api/admin/passengers
 * Get all registered passengers for admin dashboard
 */
router.get('/passengers', async (req, res) => {
  try {
    const passengers = await getRegisteredPassengers();
    res.json({ success: true, passengers });
  } catch (error) {
    console.error('[Admin] Error fetching passengers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch passengers' });
  }
});

// ─── Riders ───

/**
 * GET /api/admin/riders
 * Get all approved riders (alias)
 */
router.get('/riders', async (req, res) => {
  try {
    const riders = await getApprovedRiders();
    res.json({ success: true, riders });
  } catch (error) {
    console.error('[Admin] Error fetching riders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch riders' });
  }
});

/**
 * GET /api/admin/riders/approved
 * Get all approved riders
 */
router.get('/riders/approved', async (req, res) => {
  try {
    const riders = await getApprovedRiders();
    res.json({ success: true, riders });
  } catch (error) {
    console.error('[Admin] Error fetching approved riders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch approved riders' });
  }
});

/**
 * GET /api/admin/riders/pending
 * Get pending riders
 */
router.get('/riders/pending', async (req, res) => {
  try {
    const riders = await getPendingRiders();
    res.json({ success: true, riders });
  } catch (error) {
    console.error('[Admin] Error fetching pending riders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending riders' });
  }
});

/**
 * POST /api/admin/riders/:id/suspend
 * Suspend a rider account
 */
router.post('/riders/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const result = await suspendRider(id, reason);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Failed to suspend rider' });
    }

    // Send SMS notice to rider
    if (result.phone) {
      try {
        const smsMsg = `Notice from K3K3: Your rider account has been temporarily suspended.${reason ? ` Reason: ${reason}.` : ''} For inquiries or assistance, please contact K3K3 Support.`;
        await sendSMS(result.phone, smsMsg, `suspend_${id}`);
      } catch (smsErr) {
        console.warn('[Admin] SMS notification for suspension failed (non-fatal):', smsErr.message);
      }
    }

    res.json({ success: true, message: 'Rider suspended successfully', status: 'suspended' });
  } catch (error) {
    console.error('[Admin] Error suspending rider:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend rider' });
  }
});

/**
 * POST /api/admin/riders/:id/unsuspend
 * Reactivate / Unsuspend a rider account
 */
router.post('/riders/:id/unsuspend', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await unsuspendRider(id);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Failed to reactivate rider' });
    }

    // Send SMS notice to rider
    if (result.phone) {
      try {
        const smsMsg = `Good news! Your K3K3 Rider account has been reactivated. You can now log in with your phone number and start accepting rides. Welcome back!`;
        await sendSMS(result.phone, smsMsg, `reactivate_${id}`);
      } catch (smsErr) {
        console.warn('[Admin] SMS notification for reactivation failed (non-fatal):', smsErr.message);
      }
    }

    res.json({ success: true, message: 'Rider account reactivated successfully', status: 'active' });
  } catch (error) {
    console.error('[Admin] Error reactivating rider:', error);
    res.status(500).json({ success: false, error: 'Failed to reactivate rider' });
  }
});

/**
 * PATCH /api/admin/riders/:id/status
 * Update rider account status (toggle suspend / active)
 */
router.patch('/riders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body || {};
    if (status === 'suspended') {
      const result = await suspendRider(id, reason);
      return res.json(result);
    } else if (status === 'active' || status === 'approved') {
      const result = await unsuspendRider(id);
      return res.json(result);
    }
    res.status(400).json({ success: false, error: 'Invalid status. Supported: active, suspended' });
  } catch (error) {
    console.error('[Admin] Error updating rider status:', error);
    res.status(500).json({ success: false, error: 'Failed to update rider status' });
  }
});

/**
 * DELETE /api/admin/riders/:id
 * Permanently delete/remove a rider account
 */
router.delete('/riders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteRider(id);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Failed to remove rider' });
    }

    res.json({ success: true, message: 'Rider account removed successfully' });
  } catch (error) {
    console.error('[Admin] Error removing rider:', error);
    res.status(500).json({ success: false, error: 'Failed to remove rider' });
  }
});

// ─── Dashboard Stats ───

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const applications = await getRiderApplications();
    const pending = applications.filter(app => app.status === 'pending_review').length;
    const approved = applications.filter(app => app.status === 'approved').length;
    const rejected = applications.filter(app => app.status === 'rejected').length;

    const riders = await getApprovedRiders();
    const onlineRiders = riders.filter(r => r.is_available).length;

    res.json({
      success: true,
      stats: {
        pendingApplications: pending,
        approvedApplications: approved,
        rejectedApplications: rejected,
        totalRiders: riders.length,
        onlineRiders
      }
    });
  } catch (error) {
    console.error('[Admin] Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

module.exports = router;
