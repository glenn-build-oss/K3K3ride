/**
 * K3K3 — E2E Live API Verification for Admin Auth & Logs
 */

const assert = require('assert');

async function testLiveAPI() {
  console.log('🌐 Testing Live Admin Endpoints on http://localhost:8810...\n');

  // Test 1: Direct Admin Login with default master/fallback password without OTP
  console.log('1️⃣ Testing Direct Admin Login (OTP Disabled)...');
  const loginRes = await fetch('http://localhost:8810/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@k3k3.com', password: 'admin' })
  });

  assert.strictEqual(loginRes.status, 200, 'Direct login should return 200');
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.success, true);
  assert.strictEqual(loginData.requires2FA, false, 'requires2FA must be false when OTP disabled');
  assert.ok(loginData.token, 'JWT token should be provided');
  assert.strictEqual(loginData.user.name, 'K3K3 Admin', 'Admin name must be K3K3 Admin');
  assert.strictEqual(loginData.user.roleName, 'Super Admin', 'Role title must be Super Admin');
  console.log(`   ✅ Direct login successful: Token issued for "${loginData.user.name}" (${loginData.user.roleName})`);

  // Test 2: Assign a staff password via API
  console.log('\n2️⃣ Testing Assigning Staff Password via PUT /api/admin/staff/assign...');
  const assignRes = await fetch('http://localhost:8810/api/admin/staff/assign', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'finance@k3k3.com',
      roleId: 'finance',
      name: 'Sarah Connor',
      password: 'SarahFin2026Password!'
    })
  });
  assert.strictEqual(assignRes.status, 200);
  const assignData = await assignRes.json();
  assert.strictEqual(assignData.success, true);
  console.log('   ✅ Staff password assigned via API for finance@k3k3.com');

  // Test 3: Log in as finance staff using custom password
  console.log('\n3️⃣ Testing Staff Login with Custom Password...');
  const staffLoginRes = await fetch('http://localhost:8810/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'finance@k3k3.com', password: 'SarahFin2026Password!' })
  });
  assert.strictEqual(staffLoginRes.status, 200);
  const staffLoginData = await staffLoginRes.json();
  assert.strictEqual(staffLoginData.success, true);
  assert.strictEqual(staffLoginData.user.name, 'Sarah Connor');
  assert.strictEqual(staffLoginData.user.role, 'finance');
  console.log(`   ✅ Staff logged in with custom password: "${staffLoginData.user.name}" (${staffLoginData.user.roleName})`);

  // Test 4: Test Logout API
  console.log('\n4️⃣ Testing Logout Audit Event via POST /api/auth/admin/logout...');
  const logoutRes = await fetch('http://localhost:8810/api/auth/admin/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'finance@k3k3.com', name: 'Sarah Connor', role: 'finance' })
  });
  assert.strictEqual(logoutRes.status, 200);
  console.log('   ✅ Logout recorded in audit engine');

  // Test 5: Fetch Staff Activity Logs via GET /api/admin/staff/logs
  console.log('\n5️⃣ Testing Fetching Audit Logs via GET /api/admin/staff/logs...');
  const logsRes = await fetch('http://localhost:8810/api/admin/staff/logs?limit=50');
  assert.strictEqual(logsRes.status, 200);
  const logsData = await logsRes.json();
  assert.strictEqual(logsData.success, true);
  assert.ok(Array.isArray(logsData.logs), 'Logs should be an array');
  assert.ok(logsData.logs.length > 0, 'Should have recorded log entries');
  console.log(`   ✅ Retrieved ${logsData.logs.length} activity audit log records`);
  console.log(`   ✅ Most recent event: ${logsData.logs[0].action} by ${logsData.logs[0].email} (${logsData.logs[0].name})`);

  console.log('\n🎉 ALL LIVE API CHECKS PASSED PERFECTLY!\n');
}

testLiveAPI().catch(err => {
  console.error('\n❌ Live API test failed:', err);
  process.exit(1);
});
