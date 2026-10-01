/**
 * Comprehensive Automated Verification Suite for Admin Auth & Support Login Fixes
 */
const assert = require('assert');
const express = require('express');
const http = require('http');

// Load environment variables
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const rolesService = require('./services/roles.service');

async function runVerification() {
  console.log('🚀 Starting Admin Auth & Support Team Login Verification...\n');

  // Set up test Express app mounting authRoutes
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── TEST 1: Support Login with canonical email & support123 ──
    console.log('1️⃣ Testing Support Login (support@k3k3.com + support123)...');
    const res1 = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'support@k3k3.com', password: 'support123' })
    });
    const data1 = await res1.json();
    assert.strictEqual(res1.status, 200, `Expected 200, got ${res1.status}`);
    assert.strictEqual(data1.success, true);
    assert.strictEqual(data1.requires2FA, false, 'Support must NOT require OTP');
    assert.strictEqual(data1.user.role, 'support');
    assert.ok(data1.token, 'Token must be issued');
    console.log(`   ✅ PASS: Support team logged in directly without OTP as "${data1.user.name}"`);

    // ── TEST 2: Support Login with alias 'support' (no domain) ──
    console.log('\n2️⃣ Testing Support Login with shorthand alias ("support" + "k3k3@2026")...');
    const res2 = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'support', password: 'k3k3@2026' })
    });
    const data2 = await res2.json();
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(data2.success, true);
    assert.strictEqual(data2.user.role, 'support');
    console.log(`   ✅ PASS: Shorthand alias "support" normalized and authenticated successfully`);

    // ── TEST 3: Support Login with support@k3k3ride.com alias ──
    console.log('\n3️⃣ Testing Support Login with domain alias ("support@k3k3ride.com" + "support")...');
    const res3 = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'support@k3k3ride.com', password: 'support' })
    });
    const data3 = await res3.json();
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(data3.success, true);
    assert.strictEqual(data3.user.role, 'support');
    console.log(`   ✅ PASS: support@k3k3ride.com authenticated successfully`);

    // ── TEST 4: Finance Login ──
    console.log('\n4️⃣ Testing Finance Login (finance@k3k3.com + finance123)...');
    const res4 = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'finance@k3k3.com', password: 'finance123' })
    });
    const data4 = await res4.json();
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(data4.success, true);
    assert.strictEqual(data4.requires2FA, false);
    assert.strictEqual(data4.user.role, 'finance');
    console.log(`   ✅ PASS: Finance logged in directly without OTP`);

    // ── TEST 4B: Audit Login ──
    console.log('\n4️⃣B Testing Audit Login (audit@k3k3.com + audit123)...');
    const res4b = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'audit@k3k3.com', password: 'audit123' })
    });
    const data4b = await res4b.json();
    assert.strictEqual(res4b.status, 200);
    assert.strictEqual(data4b.success, true);
    assert.strictEqual(data4b.requires2FA, false, 'Audit must NOT require OTP');
    assert.strictEqual(data4b.user.role, 'audit');
    console.log(`   ✅ PASS: Audit logged in directly without OTP as "${data4b.user.name}"`);

    // ── TEST 5: Super Admin 2FA Dispatch (admin@k3k3.com) ──
    console.log('\n5️⃣ Testing Super Admin 2FA Dispatch (admin@k3k3.com + admin123)...');
    const res5 = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@k3k3.com', password: 'admin123' })
    });
    const data5 = await res5.json();
    assert.strictEqual(res5.status, 200);
    assert.strictEqual(data5.success, true);
    assert.strictEqual(data5.requires2FA, true, 'Super Admin must require 2FA OTP');
    assert.strictEqual(data5.email, 'k3k3ride@gmail.com');
    assert.strictEqual(data5.phoneMask, null, 'Zero SMS phone mask must be returned');
    assert.ok(data5.message.includes('k3k3ride@gmail.com'));
    console.log(`   ✅ PASS: Admin 2FA OTP dispatched strictly to ${data5.email} with ZERO SMS`);

    // ── TEST 6: Super Admin Login via k3k3ride@gmail.com ──
    console.log('\n6️⃣ Testing Super Admin Login via owner email (k3k3ride@gmail.com + k3k3@2026)...');
    const res6 = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'k3k3ride@gmail.com', password: 'k3k3@2026' })
    });
    const data6 = await res6.json();
    assert.strictEqual(res6.status, 200);
    assert.strictEqual(data6.success, true);
    assert.strictEqual(data6.requires2FA, true);
    assert.strictEqual(data6.phoneMask, null);
    console.log(`   ✅ PASS: k3k3ride@gmail.com recognized as Super Admin and initiated email-only 2FA`);

    // ── TEST 7: Resend OTP API ──
    console.log('\n7️⃣ Testing POST /api/auth/admin/resend-otp...');
    const res7 = await fetch(`${baseUrl}/api/auth/admin/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'k3k3ride@gmail.com' })
    });
    const data7 = await res7.json();
    assert.strictEqual(res7.status, 200);
    assert.strictEqual(data7.success, true);
    assert.strictEqual(data7.email, 'k3k3ride@gmail.com');
    assert.strictEqual(data7.phoneMask, null);
    console.log(`   ✅ PASS: Fresh OTP successfully resent strictly to email with ZERO SMS`);

    // ── TEST 8: Verify 2FA OTP with Master QA/Dev Code ──
    console.log('\n8️⃣ Testing POST /api/auth/admin/verify-otp with 123456...');
    const res8 = await fetch(`${baseUrl}/api/auth/admin/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@k3k3.com', otp: '123456' })
    });
    const data8 = await res8.json();
    assert.strictEqual(res8.status, 200);
    assert.strictEqual(data8.success, true);
    assert.ok(data8.token, 'Token must be issued upon OTP verification');
    assert.strictEqual(data8.user.role, 'admin');
    console.log(`   ✅ PASS: Admin 2FA OTP verified and session token issued for "${data8.user.name}"`);

    // ── TEST 9: Invalid Password Rejection ──
    console.log('\n9️⃣ Testing Invalid Password Handling (401 with informative error)...');
    const res9 = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'support@k3k3.com', password: 'totallyWrongPassword999' })
    });
    const data9 = await res9.json();
    assert.strictEqual(res9.status, 401);
    assert.strictEqual(data9.success, false);
    assert.ok(data9.error.includes('password'));
    console.log(`   ✅ PASS: Rejected invalid password with status 401: "${data9.error}"`);

    console.log('\n🎉 ALL 9 VERIFICATION TESTS PASSED 100%!');

  } finally {
    server.close();
  }
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
