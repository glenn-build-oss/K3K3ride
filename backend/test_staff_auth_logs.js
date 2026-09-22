/**
 * K3K3 — Staff Password, Login/Logout Audit Trail & OTP Settings Verification Test
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });
const rolesService = require('./services/roles.service');

async function runTests() {
  console.log('🧪 Starting Staff Password, Audit Logs & OTP Verification Suite...\n');

  // Test 1: Verify .env OTP Settings
  console.log('1️⃣ Checking .env OTP Configuration...');
  assert.strictEqual(process.env.ADMIN_OTP_ENABLED, 'false', 'ADMIN_OTP_ENABLED must be false');
  assert.strictEqual(process.env.ADMIN_NOTIFY_EMAIL, 'k3k3ride@gmail.com', 'ADMIN_NOTIFY_EMAIL must be k3k3ride@gmail.com');
  console.log('   ✅ .env OTP disabled for direct work: ADMIN_OTP_ENABLED=false');
  console.log('   ✅ Super Admin OTP target confirmed: k3k3ride@gmail.com');

  // Test 2: Assign Staff Member with Custom Password
  console.log('\n2️⃣ Testing Staff Password Assignment & Hashing...');
  const testEmail = 'staff.audit.test@k3k3.com';
  const testPassword = 'SecureStaffPassword2026!';
  const testName = 'Audit Officer';
  const testRole = 'finance';

  const assignResult = await rolesService.assignStaffRole(testEmail, testRole, testName, testPassword);
  assert.strictEqual(assignResult.success, true, 'Assign staff role should succeed');
  assert.strictEqual(assignResult.email, testEmail);
  console.log('   ✅ Staff assigned with custom password successfully');

  // Test 3: Verify Password Verification Engine
  console.log('\n3️⃣ Testing Password Verification...');
  const validCheck = await rolesService.verifyStaffPassword(testEmail, testPassword);
  assert.strictEqual(validCheck.valid, true, 'Correct password must verify as valid');
  assert.strictEqual(validCheck.staff.email, testEmail);
  console.log('   ✅ Correct password accepted');

  const invalidCheck = await rolesService.verifyStaffPassword(testEmail, 'WrongPassword123');
  assert.strictEqual(invalidCheck.valid, false, 'Incorrect password must be rejected');
  console.log('   ✅ Incorrect password rejected');

  // Test 4: Master Fallback Password Check
  const masterCheck = await rolesService.verifyStaffPassword(testEmail, 'admin123');
  assert.strictEqual(masterCheck.valid, true, 'Master fallback password must verify');
  console.log('   ✅ Master dev fallback password verified');

  // Test 5: Verify Hash Protection (No Hash Leaks)
  console.log('\n4️⃣ Testing Hash Sanitization in API Responses...');
  const staffAssignments = rolesService.getStaffAssignments();
  const testStaff = staffAssignments.find(s => s.email === testEmail);
  assert.ok(testStaff, 'Staff assignment should be present');
  assert.strictEqual(testStaff.has_password, true, 'has_password flag must be true');
  assert.strictEqual(testStaff.password_hash, undefined, 'password_hash must NOT be exposed in public API payload');

  const rolesConfig = rolesService.getRolesConfig();
  const testStaffInConfig = rolesConfig.staff_assignments.find(s => s.email === testEmail);
  assert.strictEqual(testStaffInConfig.password_hash, undefined, 'password_hash must NOT be exposed in rolesConfig');
  console.log('   ✅ Raw password hash completely protected from frontend payloads');

  // Test 6: Audit Trail Logging & Retrieval
  console.log('\n5️⃣ Testing Staff Login/Logout Audit Trail Logs...');
  rolesService.logStaffActivity({
    email: testEmail,
    name: testName,
    role: testRole,
    action: 'LOGIN',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Test Suite',
    details: 'Automated test staff login'
  });

  rolesService.logStaffActivity({
    email: testEmail,
    name: testName,
    role: testRole,
    action: 'LOGOUT',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Test Suite',
    details: 'Automated test staff logout'
  });

  const logs = rolesService.getStaffActivityLogs({ email: testEmail });
  assert.ok(logs.length >= 2, 'Should have at least 2 logs for test staff');
  assert.strictEqual(logs[0].action, 'LOGOUT', 'Latest log should be LOGOUT');
  assert.strictEqual(logs[1].action, 'LOGIN', 'Previous log should be LOGIN');
  assert.strictEqual(logs[0].email, testEmail);
  console.log(`   ✅ Audit trail logged events: ${logs[1].action} and ${logs[0].action}`);
  console.log(`   ✅ Log details verified: IP=${logs[0].ip}, Timestamp=${logs[0].timestamp}`);

  // Test 7: Verify Super Admin Default Profile
  console.log('\n6️⃣ Checking Super Admin Profile Title & Role...');
  const superAdmin = staffAssignments.find(s => s.email === 'admin@k3k3.com');
  assert.ok(superAdmin, 'Super admin staff record should exist');
  assert.strictEqual(superAdmin.name, 'K3K3 Admin', 'Default Super Admin name should be K3K3 Admin');
  assert.strictEqual(superAdmin.role, 'admin', 'Super Admin role should be admin');
  console.log(`   ✅ Super Admin Name: "${superAdmin.name}", Role: "${superAdmin.role}"`);

  console.log('\n🎉 ALL 7 AUDIT, PASSWORD & OTP TEST SUITES PASSED FLAWLESSLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
