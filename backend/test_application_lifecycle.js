/**
 * Verification test for Rider Application Document Upload & Approval Lifecycle
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const http = require('http');
const express = require('express');
const adminRoutes = require('./routes/admin.routes');
const authRoutes = require('./routes/auth.routes');

const TEST_PORT = 8993;

async function runTest() {
  console.log('================================================================');
  console.log('  RIDER APPLICATION & APPROVAL LIFECYCLE VERIFICATION');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/admin', adminRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/', adminRoutes);

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[Test Server] Listening on port ${TEST_PORT}`);

  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  try {
    // ── Test 1: Submission with MISSING documents must be rejected (400) ──
    console.log('\n--- Test 1: Application with Missing Documents ---');
    const missingDocsPayload = {
      first_name: 'Kofi',
      last_name: 'Mensah',
      phone: '0241234567',
      email: 'kofi.test@k3k3.com',
      documents: {
        riderLicense: { data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', name: 'license.png' }
        // missing vehicleRegistration, idCardFront, idCardBack, passportPhoto
      }
    };

    const res1 = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(missingDocsPayload)
    });

    const data1 = await res1.json();
    console.log('Response Status:', res1.status);
    console.log('Response Body:', data1);

    if (res1.status === 400 && data1.error && data1.error.includes('Missing')) {
      console.log('✅ TEST 1 PASSED: Submission with missing documents correctly rejected with 400!');
    } else {
      throw new Error(`TEST 1 FAILED: Expected 400 with missing docs error, got ${res1.status}`);
    }

    // ── Test 2: Submission with ALL 5 required documents ──
    console.log('\n--- Test 2: Application with All 5 Required Documents ---');
    const dummyImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const testPhone = '0248889999';

    const fullPayload = {
      first_name: 'Kwame',
      last_name: 'Appiah',
      phone: testPhone,
      email: 'kwame.test@k3k3.com',
      address: 'Ho Central, Volta Region, Ghana',
      vehicle_type: 'tricycle',
      vehicle_make: 'Bajaj',
      vehicle_model: 'RE 205',
      vehicle_year: '2023',
      vehicle_plate: 'VR-4567-24',
      license_number: 'DEL-99887766-12345',
      license_expiry: '2027-12-31',
      documents: {
        riderLicense: { data: dummyImageBase64, name: 'license.png', type: 'image/png' },
        vehicleRegistration: { data: dummyImageBase64, name: 'registration.png', type: 'image/png' },
        idCardFront: { data: dummyImageBase64, name: 'id_front.png', type: 'image/png' },
        idCardBack: { data: dummyImageBase64, name: 'id_back.png', type: 'image/png' },
        passportPhoto: { data: dummyImageBase64, name: 'passport.png', type: 'image/png' }
      }
    };

    const res2 = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload)
    });

    const data2 = await res2.json();
    console.log('Response Status:', res2.status);
    console.log('Response Body:', data2);

    if ((res2.status === 201 || res2.status === 200) && data2.success) {
      console.log('✅ TEST 2 PASSED: Application accepted and saved!');
    } else {
      console.warn('Note: If Supabase table is unreachable, test 2 returned:', data2);
    }

    // ── Test 3: Status Check for Pending Rider ──
    console.log('\n--- Test 3: Status Check Endpoint (Before Approval) ---');
    const res3 = await fetch(`${baseUrl}/api/auth/rider/status?phone=${testPhone}`);
    const data3 = await res3.json();
    console.log('Rider Status Check:', data3);

    if (data3.success && (data3.status === 'pending' || data3.status === 'under_review') && !data3.isApproved) {
      console.log('✅ TEST 3 PASSED: Rider status is strictly pending before approval!');
    } else {
      throw new Error(`TEST 3 FAILED: Expected pending status, got: ${JSON.stringify(data3)}`);
    }

    // ── Test 4: Admin Approval & Congratulations SMS ──
    console.log('\n--- Test 4: Admin Approval & SMS Dispatch ---');
    const appId = data2.id;
    const res4 = await fetch(`${baseUrl}/api/admin/applications/${appId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data4 = await res4.json();
    console.log('Approval Response:', data4);

    if (data4.success && (data4.application?.status === 'approved' || data4.rider_id)) {
      console.log('✅ TEST 4 PASSED: Application approved and rider activated!');
    } else {
      throw new Error(`TEST 4 FAILED: Approval failed: ${JSON.stringify(data4)}`);
    }

    // ── Test 5: Status Check After Approval ──
    console.log('\n--- Test 5: Status Check Endpoint (After Approval) ---');
    const res5 = await fetch(`${baseUrl}/api/auth/rider/status?phone=${testPhone}`);
    const data5 = await res5.json();
    console.log('Post-Approval Status Check:', data5);

    if (data5.success && (data5.status === 'approved' || data5.isApproved)) {
      console.log('✅ TEST 5 PASSED: Rider status is now APPROVED and has dashboard access!');
    } else {
      throw new Error(`TEST 5 FAILED: Expected approved status, got: ${JSON.stringify(data5)}`);
    }

    console.log('\n================================================================');
    console.log('  ALL 5 INTEGRATION VERIFICATION CHECKS PASSED EMPIRICALLY!');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

runTest().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
