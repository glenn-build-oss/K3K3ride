/**
 * End-to-End Automated Verification Test for K3K3 Real-Time Ride Engine
 * Tests:
 * 1. Rider Goes Online (Socket registration & pool update)
 * 2. Passenger Connects (Room registration)
 * 3. Haversine Proximity Match & 20s Dispatch Cascade (trip:offer received)
 * 4. Atomic Ride Acceptance & Seat Capacity Management
 * 5. In-Trip GPS Location Streaming
 * 6. Trip Completion & Seat Restoration
 * 7. Rider Goes Offline
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');
const dispatchService = require('./services/dispatch.service');

const TEST_PORT = 8991;

async function runVerification() {
  console.log('================================================================');
  console.log('  K3K3 REAL-TIME ENGINE — END-TO-END VERIFICATION TEST');
  console.log('================================================================\n');

  // 1. Setup ephemeral test server
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  dispatchService.setIO(io);

  // Setup connection handlers (same as server.js)
  io.on('connection', (socket) => {
    socket.on('rider:online', (data) => {
      socket.join('riders:online');
      if (data?.riderId) socket.join(`rider:${data.riderId}`);
      const state = dispatchService.registerRider(socket.id, data);
      socket.emit('rider:online_ack', { success: true, rider: state });
    });

    socket.on('rider:location', (coords) => {
      dispatchService.updateRiderLocation(socket.id, coords);
    });

    socket.on('rider:offline', () => {
      socket.leave('riders:online');
      dispatchService.unregisterRider(socket.id);
      socket.emit('rider:offline_ack', { success: true });
    });

    socket.on('passenger:join', (data) => {
      if (data?.passengerId) {
        socket.join(`passenger:${data.passengerId}`);
        socket.emit('passenger:joined', { passengerId: data.passengerId });
      }
    });

    socket.on('trip:join', (data) => {
      if (data?.tripId) socket.join(`trip:${data.tripId}`);
    });

    socket.on('trip:accept', async (data, ack) => {
      const res = await dispatchService.acceptRide(data.tripId, data.riderId);
      if (res.success) socket.join(`trip:${data.tripId}`);
      if (typeof ack === 'function') ack(res);
    });

    socket.on('trip:location_update', (data) => {
      io.to(`trip:${data.tripId}`).emit('trip:rider_location', data);
    });
  });

  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  console.log(`[TEST SERVER] Running on port ${TEST_PORT}`);

  const SERVER_URL = `http://localhost:${TEST_PORT}`;

  let riderSocket, passengerSocket;

  try {
    // ─── STEP 1: Connect simulated Rider ───
    console.log('\n[TEST 1] Connecting simulated Rider (Kofi Mensah)...');
    riderSocket = ClientIO(SERVER_URL, { reconnection: false });

    await new Promise((resolve, reject) => {
      riderSocket.on('connect', resolve);
      riderSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Rider connect timeout')), 3000);
    });
    console.log('✓ Rider socket connected:', riderSocket.id);

    const crypto = require('crypto');
    const testRiderId = crypto.randomUUID();
    const testPassengerId = crypto.randomUUID();
    const testTripId = crypto.randomUUID();

    // Rider goes online near KNUST Main Gate (6.6745, -1.5716)
    const riderOnlineAck = await new Promise((resolve, reject) => {
      riderSocket.emit('rider:online', {
        riderId: testRiderId,
        name: 'Kofi Mensah',
        phone: '0244123456',
        lat: 6.6745,
        lng: -1.5716,
        capacity: 3,
        vehicleType: 'tricycle',
        licensePlate: 'AS 4920-24'
      });
      riderSocket.on('rider:online_ack', resolve);
      setTimeout(() => reject(new Error('rider:online_ack timeout')), 3000);
    });

    if (!riderOnlineAck.success || dispatchService.getOnlineCount() !== 1) {
      throw new Error(`Rider online failed. Online count: ${dispatchService.getOnlineCount()}`);
    }
    console.log('✓ Rider registered online. Available seats:', riderOnlineAck.rider.availableSeats);

    // ─── STEP 2: Connect simulated Passenger ───
    console.log('\n[TEST 2] Connecting simulated Passenger (Ama Serwaa)...');
    passengerSocket = ClientIO(SERVER_URL, { reconnection: false });

    await new Promise((resolve, reject) => {
      passengerSocket.on('connect', resolve);
      passengerSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Passenger connect timeout')), 3000);
    });
    console.log('✓ Passenger socket connected:', passengerSocket.id);

    // Passenger joins room
    passengerSocket.emit('passenger:join', { passengerId: testPassengerId });

    // ─── STEP 3: Book a Ride & Trigger Dispatch ───
    console.log('\n[TEST 3] Passenger requests shared ride (Main Gate → Library)...');
    const mockTrip = {
      id: testTripId,
      passenger_id: testPassengerId,
      passenger_name: 'Ama Serwaa',
      pickup_address: 'KNUST Main Gate',
      pickup_latitude: 6.6747,  // ~50 meters from Kofi
      pickup_longitude: -1.5718,
      dropoff_address: 'Prempeh II Library',
      dropoff_latitude: 6.6800,
      dropoff_longitude: -1.5750,
      estimated_fare: 5.00,
      ride_type: 'shared'
    };

    // Prepare to listen for trip offer on Rider's socket
    const offerPromise = new Promise((resolve, reject) => {
      riderSocket.on('trip:offer', resolve);
      setTimeout(() => reject(new Error('Offer not received by rider within 4s')), 4000);
    });

    // Trigger dispatch
    const dispatchResult = await dispatchService.dispatchRide(mockTrip);
    console.log('✓ Dispatch initiated. Eligible candidates found:', dispatchResult.candidateCount);

    const receivedOffer = await offerPromise;
    console.log('✓ Rider received real-time trip offer:');
    console.log(`    Trip ID: ${receivedOffer.trip_id}`);
    console.log(`    Pickup:  ${receivedOffer.pickup}`);
    console.log(`    Fare:    ₵${receivedOffer.fare_estimate}`);
    console.log(`    TTL:     ${receivedOffer.ttl_seconds}s countdown`);

    if (receivedOffer.trip_id !== mockTrip.id) {
      throw new Error(`Trip ID mismatch in offer: expected ${mockTrip.id}, got ${receivedOffer.trip_id}`);
    }

    // ─── STEP 4: Rider Accepts Ride (Atomic Lock) ───
    console.log('\n[TEST 4] Rider accepts ride offer (Atomic Lock)...');

    const passengerAcceptedPromise = new Promise((resolve, reject) => {
      passengerSocket.on('trip:accepted', resolve);
      setTimeout(() => reject(new Error('Passenger did not receive trip:accepted')), 4000);
    });

    const acceptAck = await new Promise((resolve) => {
      riderSocket.emit('trip:accept', { tripId: mockTrip.id, riderId: testRiderId }, resolve);
    });

    if (!acceptAck.success) {
      throw new Error(`Accept failed: ${acceptAck.error}`);
    }
    console.log('✓ Rider accept acknowledged. Remaining seats:', acceptAck.rider.availableSeats);

    if (acceptAck.rider.availableSeats !== 2) {
      throw new Error(`Expected 2 seats remaining, got ${acceptAck.rider.availableSeats}`);
    }

    const passengerNotification = await passengerAcceptedPromise;
    console.log('✓ Passenger received "Rider Assigned" notification:');
    console.log(`    Rider Name:    ${passengerNotification.rider.name}`);
    console.log(`    License Plate: ${passengerNotification.rider.licensePlate}`);
    console.log(`    Vehicle Type:  ${passengerNotification.rider.vehicleType}`);

    // ─── STEP 5: In-Trip GPS Location Streaming ───
    console.log('\n[TEST 5] Testing live keke GPS stream to passenger map...');
    passengerSocket.emit('trip:join', { tripId: mockTrip.id });

    const locationPromise = new Promise((resolve, reject) => {
      passengerSocket.on('trip:rider_location', resolve);
      setTimeout(() => reject(new Error('Location update not received by passenger')), 3000);
    });

    riderSocket.emit('trip:location_update', {
      tripId: mockTrip.id,
      riderId: testRiderId,
      lat: 6.6750,
      lng: -1.5720,
      heading: 45,
      speed: 18
    });

    const liveCoords = await locationPromise;
    console.log(`✓ Passenger received live keke GPS ping: (${liveCoords.lat}, ${liveCoords.lng}) at ${liveCoords.speed} km/h`);

    // ─── STEP 6: Complete Ride & Seat Restoration ───
    console.log('\n[TEST 6] Completing ride & restoring seat capacity...');
    const completeResult = await dispatchService.completeRide(mockTrip.id, testRiderId, 5.00);
    if (!completeResult.success) throw new Error('Complete ride failed');

    const riderStateAfterComplete = dispatchService.riders.get(testRiderId);
    console.log('✓ Ride completed. Restored available seats:', riderStateAfterComplete.availableSeats);
    if (riderStateAfterComplete.availableSeats !== 3) {
      throw new Error(`Expected 3 seats restored, got ${riderStateAfterComplete.availableSeats}`);
    }

    // ─── STEP 7: Rider Goes Offline ───
    console.log('\n[TEST 7] Rider toggles "Go Offline"...');
    await new Promise(resolve => {
      riderSocket.emit('rider:offline');
      riderSocket.on('rider:offline_ack', resolve);
    });
    console.log('✓ Rider went offline. Online count:', dispatchService.getOnlineCount());
    if (dispatchService.getOnlineCount() !== 0) {
      throw new Error('Online count expected 0');
    }

    console.log('\n================================================================');
    console.log('  ALL REAL-TIME RIDE ENGINE TESTS PASSED SUCCESSFULLY! (7/7)');
    console.log('================================================================\n');

  } finally {
    if (riderSocket) riderSocket.disconnect();
    if (passengerSocket) passengerSocket.disconnect();
    clearInterval(dispatchService.sweepInterval);
    server.close();
  }
}

runVerification().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
