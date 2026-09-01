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
const { 
  getRiderApplications, 
  approveRiderApplication, 
  rejectRiderApplication,
  getApprovedRiders,
  getPendingRiders
} = require('../services/supabase.service');

// ─── Rider Applications ───

/**
 * GET /api/admin/applications
 * Get all rider applications
 */
router.get('/applications', async (req, res) => {
  try {
    const applications = await getRiderApplications();
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
    const applications = await getRiderApplications();
    const pending = applications.filter(app => app.status === 'pending_review');
    res.json({ success: true, applications: pending });
  } catch (error) {
    console.error('[Admin] Error fetching pending applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending applications' });
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
      const message = 'Congratulations! Your rider application has been approved. You can now log in to your K3K3ride Rider account using your registered phone number. Welcome to K3K3ride!';
      await sendSMS(result.application.phone, message, `approval_${id}`);
    }

    res.json({ success: true, message: 'Application approved successfully', application: result.application });
  } catch (error) {
    console.error('[Admin] Error approving application:', error);
    res.status(500).json({ success: false, error: 'Failed to approve application' });
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

// ─── Riders ───

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
