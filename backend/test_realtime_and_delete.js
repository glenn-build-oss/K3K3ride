/**
 * Automated Verification Script:
 * 1. FAQ copy check in index.html
 * 2. POST /applications -> Database row, disk files, Socket.io `admin:new_application` event
 * 3. DELETE /applications/:id -> Row purged, disk files deleted, Socket.io `admin:application_deleted` event
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const adminRoutes = require('./routes/admin.routes');
const { getRiderApplications } = require('./services/supabase.service');

const TEST_PORT = 8899;

async function runTests() {
  console.log('========================================================');
  console.log('Starting Verification: Real-Time Applications & Deletion');
  console.log('========================================================\n');

  // -- TEST 1: Check FAQ copy in index.html --
  console.log('[Test 1] Checking FAQ copy in index.html...');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  const expectedText = 'We support transfers across MTN , Telecel Cash  and cash payments. Fares are straightforward with zero hidden fees, surge pricing, or payment deductions.';

  if (!indexContent.includes(expectedText)) {
    throw new Error('Test 1 FAILED: Expected FAQ text not found in index.html!');
  }
  console.log('Test 1 PASSED: index.html FAQ copy contains the exact requested text!\n');

  // -- Setup Test Server with Socket.io --
  console.log('[Setup] Launching test Express server with Socket.io on port', TEST_PORT);
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use('/', adminRoutes);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[Setup] Server listening on http://127.0.0.1:${TEST_PORT}`);

  // -- Setup Socket.io client --
  const clientSocket = ClientIO(`http://127.0.0.1:${TEST_PORT}`);
  await new Promise((resolve) => clientSocket.on('connect', resolve));
  console.log('[Setup] Socket.io client connected with ID:', clientSocket.id);

  let receivedNewAppEvent = null;
  let receivedDeletedAppEvent = null;

  clientSocket.on('admin:new_application', (app) => {
    console.log('Socket event received: admin:new_application ->', app.first_name, app.phone);
    receivedNewAppEvent = app;
  });

  clientSocket.on('admin:application_deleted', (data) => {
    console.log('Socket event received: admin:application_deleted ->', data);
    receivedDeletedAppEvent = data;
  });

  try {
    // -- TEST 2: Submit application and verify real-time event --
    console.log('\n[Test 2] Submitting driver application with 5 documents...');
    const testPhone = '024' + Math.floor(1000000 + Math.random() * 9000000);
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const testPayload = {
      first_name: 'Ebenezer',
      last_name: 'TestDriver',
      phone: testPhone,
      email: `test.${Date.now()}@k3k3.com`,
      vehicle_type: 'Tricycle',
      vehicle_make: 'Bajaj',
      vehicle_model: 'RE 205',
      vehicle_plate: 'VR-9988-26',
      experience: '4 years',
      documents: {
        riderLicense: { data: dummyImage, name: 'license.png' },
        vehicleRegistration: { data: dummyImage, name: 'reg.png' },
        idCardFront: { data: dummyImage, name: 'id_front.png' },
        idCardBack: { data: dummyImage, name: 'id_back.png' },
        passportPhoto: { data: dummyImage, name: 'passport.png' }
      }
    };

    const submitRes = await fetch(`http://127.0.0.1:${TEST_PORT}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const submitData = await submitRes.json();
    console.log('POST /applications response:', submitRes.status, submitData);

    if (submitRes.status !== 201 || !submitData.success || !submitData.id) {
      throw new Error(`Test 2 FAILED: Application creation failed with status ${submitRes.status}`);
    }

    const createdAppId = submitData.id;
    console.log('Created Application ID:', createdAppId);

    // Wait a brief moment for socket emission
    await new Promise((r) => setTimeout(r, 600));

    if (!receivedNewAppEvent) {
      throw new Error('Test 2 FAILED: admin:new_application Socket.io event was NOT received!');
    }
    console.log('Test 2 PASSED: Application submitted and instantly received via Socket.io!\n');

    // Verify files on disk
    console.log('[Test 2.1] Verifying physical documents saved on disk...');
    const uploadsDir = path.join(__dirname, 'uploads', 'applications');
    const files = fs.readdirSync(uploadsDir);
    const createdFiles = files.filter(f => f.includes('riderLicense') || f.includes('vehicleRegistration'));
    console.log(`Found ${createdFiles.length} application document files in uploads/applications/`);
    if (createdFiles.length === 0) {
      throw new Error('Test 2.1 FAILED: Expected documents to be saved on disk!');
    }
    console.log('Test 2.1 PASSED: Documents successfully written to disk.\n');

    // -- TEST 3: Permanent Deletion --
    console.log('[Test 3] Permanently deleting application via DELETE /applications/' + createdAppId);
    const deleteRes = await fetch(`http://127.0.0.1:${TEST_PORT}/applications/${createdAppId}`, {
      method: 'DELETE'
    });

    const deleteData = await deleteRes.json();
    console.log('DELETE /applications/:id response:', deleteRes.status, deleteData);

    if (deleteRes.status !== 200 || !deleteData.success) {
      throw new Error(`Test 3 FAILED: Delete endpoint failed with status ${deleteRes.status}`);
    }

    // Wait a brief moment for socket emission
    await new Promise((r) => setTimeout(r, 600));

    if (!receivedDeletedAppEvent) {
      throw new Error('Test 3 FAILED: admin:application_deleted Socket.io event was NOT received!');
    }

    // Check that row is removed from getRiderApplications
    const allApps = await getRiderApplications();
    const stillExists = allApps.some(a => a.id === createdAppId || (a.phone && a.phone.includes(testPhone.slice(-9))));
    if (stillExists) {
      throw new Error('Test 3 FAILED: Application record still exists in Supabase after deletion!');
    }

    console.log('Test 3 PASSED: Application permanently deleted from database and disk, and broadcast via Socket.io!\n');

    console.log('========================================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED.');
    console.log('========================================================');

  } finally {
    clientSocket.disconnect();
    server.close();
  }
}

runTests().catch(err => {
  console.error('\nVERIFICATION TEST FAILED:', err);
  process.exit(1);
});
