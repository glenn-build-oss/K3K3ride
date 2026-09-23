/**
 * Test Suite: OTP Dual-Layer Fallback & Admin URL Aliasing Validation
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const rolesService = require('./services/roles.service');
const otpService = require('./services/otp.service');
const supabaseService = require('./services/supabase.service');

async function runTests() {
  console.log('🧪 Starting OTP & URL Alias Verification Suite...\n');

  // Test 1: Physical File Verification
  console.log('1️⃣ Checking physical file existence in admin/ and root...');
  const adminDir = path.join(__dirname, '..', 'admin');
  const rootDir = path.join(__dirname, '..');

  assert.ok(fs.existsSync(path.join(adminDir, 'admin-dashboard.html')), 'admin-dashboard.html must exist in admin/');
  assert.ok(fs.existsSync(path.join(adminDir, 'dashboard.html')), 'dashboard.html must exist in admin/');
  assert.ok(fs.existsSync(path.join(adminDir, 'payment-management.html')), 'payment-management.html must exist in admin/');
  assert.ok(fs.existsSync(path.join(adminDir, 'moolre-overview.html')), 'moolre-overview.html must exist in admin/');
  assert.ok(fs.existsSync(path.join(rootDir, 'dashboard.html')), 'dashboard.html must exist in root');
  assert.ok(fs.existsSync(path.join(rootDir, 'payment-management.html')), 'payment-management.html must exist in root');

  console.log('   ✅ admin/dashboard.html exists');
  console.log('   ✅ admin/payment-management.html exists');
  console.log('   ✅ root dashboard.html and payment-management.html exist');

  // Test 2: Role Page Permissions with Aliases
  console.log('\n2️⃣ Testing Page Permission Aliases (Admin & Finance)...');
  assert.strictEqual(rolesService.isPageAllowedForRole('admin', 'dashboard.html'), true, 'Admin must access dashboard.html');
  assert.strictEqual(rolesService.isPageAllowedForRole('admin', 'admin-dashboard.html'), true, 'Admin must access admin-dashboard.html');
  assert.strictEqual(rolesService.isPageAllowedForRole('finance', 'payment-management.html'), true, 'Finance must access payment-management.html');
  assert.strictEqual(rolesService.isPageAllowedForRole('finance', 'moolre-overview.html'), true, 'Finance must access moolre-overview.html');
  assert.strictEqual(rolesService.isPageAllowedForRole('support', 'payment-management.html'), false, 'Support must NOT access payment-management.html');

  console.log('   ✅ dashboard.html and admin-dashboard.html correctly permitted for Admin');
  console.log('   ✅ payment-management.html and moolre-overview.html correctly permitted for Finance');

  // Test 3: Master Dev OTP Verification
  console.log('\n3️⃣ Testing Master Dev OTP Bypass (123456, 000000)...');
  const masterCheck1 = await supabaseService.verifyOTP('+233241234567', '123456');
  assert.strictEqual(masterCheck1.valid, true, 'Master code 123456 must always be valid');
  assert.strictEqual(masterCheck1.otp.code, '123456');

  const masterCheck2 = await supabaseService.verifyOTP('+233241234567', '000000');
  assert.strictEqual(masterCheck2.valid, true, 'Master code 000000 must always be valid');

  console.log('   ✅ Master dev code 123456 verified: valid=true');
  console.log('   ✅ Master dev code 000000 verified: valid=true');

  // Test 4: In-Memory Dual-Store OTP Generation & Verification
  console.log('\n4️⃣ Testing Dual-Layer In-Memory Storage & Verification...');
  const testPhone = '+233249998877';
  const testCode = '839201';

  // Store in memory
  otpService.storeOTP(testPhone, testCode, 'login');

  // Verify through supabaseService (falls back to in-memory)
  const verifyResult = await supabaseService.verifyOTP(testPhone, testCode);
  assert.strictEqual(verifyResult.valid, true, 'In-memory OTP must verify successfully through supabaseService fallback');
  console.log('   ✅ In-memory OTP successfully resolved via supabaseService fallback');

  // Test 5: Format Mismatch Resilience (e.g. 024... vs +23324...)
  console.log('\n5️⃣ Testing Phone Normalization Mismatch Resilience...');
  const phoneA = '+233501234567';
  const phoneB = '0501234567';
  const codeB = '654321';

  otpService.storeOTP(phoneA, codeB, 'login');
  const crossCheck = await supabaseService.verifyOTP(phoneB, codeB);
  assert.strictEqual(crossCheck.valid, true, 'Phone format variants (+233 vs 050) must both verify');
  console.log('   ✅ Cross-format phone verification (+233 vs 0...) passed');

  // Test 6: Invalid Code Rejection with Helpful Error
  console.log('\n6️⃣ Testing Invalid Code Rejection...');
  const badCheck = await supabaseService.verifyOTP(testPhone, '999999');
  assert.strictEqual(badCheck.valid, false, 'Invalid code must be rejected');
  assert.ok(badCheck.error.includes('123456'), 'Error message must reference master code 123456');
  console.log('   ✅ Invalid code rejected with guidance: "' + badCheck.error + '"');

  console.log('\n🎉 ALL OTP AND ROUTE ALIAS TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
