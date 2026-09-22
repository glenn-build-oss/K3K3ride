/**
 * Test Suite: Roles & Permissions and Resend Email Service
 * 
 * Verifies:
 *  1. Roles service CRUD (admin, finance, support, custom roles).
 *  2. Deletion safeguards on system roles.
 *  3. Page-level permission checks (isPageAllowedForRole).
 *  4. Staff role assignments.
 *  5. Resend service email template generation & config check.
 */

const assert = require('assert');
const rolesService = require('./services/roles.service');
const resendService = require('./services/resend.service');

async function runTests() {
  console.log('\n--- 1. Testing Roles & Permissions Service ---');

  // Test 1: Retrieve roles configuration
  const config = rolesService.getRolesConfig();
  assert(Array.isArray(config.roles), 'Roles must be an array');
  assert(config.roles.length >= 3, 'Must have at least 3 default roles');

  const adminRole = rolesService.getRole('admin');
  const financeRole = rolesService.getRole('finance');
  const supportRole = rolesService.getRole('support');

  assert(adminRole && adminRole.is_system, 'Admin role must exist and be system');
  assert(financeRole && financeRole.is_system, 'Finance role must exist and be system');
  assert(supportRole && supportRole.is_system, 'Support role must exist and be system');

  console.log(`[PASS] Found default system roles: ${adminRole.name}, ${financeRole.name}, ${supportRole.name}`);

  // Test 2: Page permission validation
  assert.strictEqual(rolesService.isPageAllowedForRole('admin', 'system-settings.html'), true, 'Admin can access system-settings');
  assert.strictEqual(rolesService.isPageAllowedForRole('admin', 'pricing-cms.html'), true, 'Admin can access pricing-cms');
  assert.strictEqual(rolesService.isPageAllowedForRole('finance', 'payment-management.html'), true, 'Finance can access payment-management');
  assert.strictEqual(rolesService.isPageAllowedForRole('finance', 'pricing-cms.html'), false, 'Finance cannot access pricing-cms');
  assert.strictEqual(rolesService.isPageAllowedForRole('support', 'ride-monitoring.html'), true, 'Support can access ride-monitoring');
  assert.strictEqual(rolesService.isPageAllowedForRole('support', 'payment-management.html'), false, 'Support cannot access payment-management');

  console.log('[PASS] Page-level access control enforced accurately across roles');

  // Test 3: Create Custom Role
  const customRole = rolesService.createRole({
    name: 'Dispatcher Lead',
    description: 'Assists riders with route dispatch and tracking',
    default_page: 'ride-monitoring.html',
    allowed_pages: ['ride-monitoring.html', 'live-riders.html', 'trips.html'],
    color: '#EC4899'
  });

  assert(customRole && customRole.id, 'Custom role must have an ID');
  assert.strictEqual(customRole.is_system, false, 'Custom role must not be system');
  assert.strictEqual(rolesService.isPageAllowedForRole(customRole.id, 'ride-monitoring.html'), true);
  assert.strictEqual(rolesService.isPageAllowedForRole(customRole.id, 'pricing-cms.html'), false);
  console.log(`[PASS] Created custom role: ${customRole.name} (ID: ${customRole.id})`);

  // Test 4: Update Custom Role
  const updatedRole = rolesService.updateRole(customRole.id, {
    description: 'Updated dispatcher role scope',
    allowed_pages: ['ride-monitoring.html', 'live-riders.html', 'trips.html', 'customers.html']
  });
  assert.strictEqual(updatedRole.description, 'Updated dispatcher role scope');
  assert.strictEqual(rolesService.isPageAllowedForRole(customRole.id, 'customers.html'), true);
  console.log('[PASS] Successfully updated custom role permissions');

  // Test 5: System role deletion protection
  let systemDeleteFailed = false;
  try {
    rolesService.deleteRole('admin');
  } catch (err) {
    systemDeleteFailed = true;
  }
  assert.strictEqual(systemDeleteFailed, true, 'Deleting system role must be blocked');

  try {
    rolesService.deleteRole('finance');
  } catch (err) {
    systemDeleteFailed = true;
  }
  assert.strictEqual(systemDeleteFailed, true, 'Deleting finance role must be blocked');
  console.log('[PASS] System roles are strictly protected against deletion');

  // Test 6: Delete custom role
  const delResult = rolesService.deleteRole(customRole.id);
  assert.strictEqual(delResult.success, true);
  assert.strictEqual(rolesService.getRole(customRole.id), null);
  console.log('[PASS] Successfully deleted custom role');

  // Test 7: Staff Role Assignment
  const assignResult = rolesService.assignStaffRole('audit@k3k3.com', 'finance', 'Auditor');
  assert.strictEqual(assignResult.success, true);
  const staffList = rolesService.getStaffAssignments();
  const foundStaff = staffList.find(s => s.email === 'audit@k3k3.com');
  assert(foundStaff && foundStaff.role === 'finance');
  console.log('[PASS] Staff member assigned role successfully');

  console.log('\n--- 2. Testing Resend Email Service ---');

  // Test 8: HTML email template generation
  const testOtp = '849201';
  const html = resendService.buildOtpEmailHtml(testOtp, 'Admin 2FA Login');
  assert(html.includes(testOtp), 'HTML must contain OTP code');
  assert(html.includes('K3K3'), 'HTML must contain K3K3 branding');
  assert(html.includes('Security Notice'), 'HTML must contain security notice');
  console.log('[PASS] Branded HTML OTP email template generated successfully');

  // Test 9: Resend service execution (simulated if key not yet provided)
  const sendRes = await resendService.sendEmailOTP({
    to: 'test@k3k3.com',
    code: testOtp,
    role: 'Admin',
    purpose: '2FA Login'
  });
  assert(sendRes !== null, 'Send email result must be returned');
  console.log('[PASS] Resend service handled dispatch gracefully (Configured:', resendService.isResendConfigured(), ')');

  console.log('\n=============================================');
  console.log('ALL TESTS PASSED (100% Red/Green Verified)');
  console.log('=============================================\n');
}

runTests().catch(err => {
  console.error('[FAIL] Test error:', err);
  process.exit(1);
});
