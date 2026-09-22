/**
 * Unit & Integration Test Suite for Pricing CMS & Fare Engine
 */

const assert = require('assert');
const pricingService = require('./services/pricing.service');

async function runTests() {
  console.log('\n--- 1. Testing Default Config & Initial Load ---');
  const cfg = pricingService.getPricingConfig();
  assert(cfg.success === true, 'getPricingConfig should succeed');
  assert(Array.isArray(cfg.locations) && cfg.locations.length >= 20, 'Should have initial locations catalog');
  assert(Array.isArray(cfg.routes) && cfg.routes.length >= 10, 'Should have initial route fare matrix');
  assert(typeof cfg.settings === 'object', 'Should have global settings');
  console.log(`✅ Loaded ${cfg.locations.length} locations, ${cfg.routes.length} route overrides`);

  console.log('\n--- 2. Testing In/Out Campus Fare Calculation ---');
  // Intra-campus route: HTU to Student Hostel
  const intra = pricingService.calculateFare('Ho Technical University (HSTU)', 'HSTU Student Hostel');
  assert(intra.success === true, 'Intra-campus calculation should succeed');
  assert.strictEqual(intra.zone_type, 'in', 'Should be classified as in-campus');
  assert.strictEqual(intra.fare, 3.00, 'Intra-campus base fare should be ₵3.00');
  assert.strictEqual(intra.alone_fare, 9.00, 'Alone fare should be ₵9.00 (3x)');
  console.log(`✅ In-Campus Route OK: ${intra.fare} GHS (Alone: ${intra.alone_fare} GHS)`);

  // Out-campus route without specific override: HTU to Ho Central Market (configured override is 4.00)
  const outRoute = pricingService.calculateFare('Ho Technical University (HSTU)', 'Ho Central Market');
  assert(outRoute.success === true, 'Out-campus calculation should succeed');
  assert.strictEqual(outRoute.zone_type, 'out', 'Should be classified as out-campus');
  assert.strictEqual(outRoute.fare, 4.00, 'Fare should be ₵4.00');
  console.log(`✅ Out-Campus Route OK: ${outRoute.fare} GHS`);

  // Specific override: Ahoe to Volta Barracks = 3.50
  const override = pricingService.calculateFare('Ahoe', 'Volta Barracks');
  assert(override.success === true, 'Override route calculation should succeed');
  assert.strictEqual(override.fare, 3.50, 'Ahoe to Barracks should be ₵3.50');
  assert.strictEqual(override.alone_fare, 10.50, 'Alone fare should be ₵10.50 (3.50 * 3)');
  assert.strictEqual(override.is_override, true, 'is_override should be true');
  console.log(`✅ Matrix Override OK: ${override.fare} GHS`);

  console.log('\n--- 3. Testing Location CRUD ---');
  // Create
  const testLocName = 'Test HTU Science Lab ' + Date.now();
  const createdLoc = pricingService.createLocation({
    name: testLocName,
    zone_type: 'in',
    category: 'Campuses & Hostels',
    lat: 6.6279,
    lng: 0.4739,
    address: 'HTU Campus, Sokode',
    is_popular: true
  });
  assert(createdLoc.id, 'Created location should have an id');
  assert.strictEqual(createdLoc.name, testLocName);
  console.log(`✅ Location Created: ${createdLoc.id} (${createdLoc.name})`);

  // Update
  const updatedLoc = pricingService.updateLocation(createdLoc.id, {
    name: testLocName + ' Updated',
    zone_type: 'out'
  });
  assert.strictEqual(updatedLoc.name, testLocName + ' Updated');
  assert.strictEqual(updatedLoc.zone_type, 'out');
  console.log(`✅ Location Updated: ${updatedLoc.name} (${updatedLoc.zone_type})`);

  // Delete
  const delRes = pricingService.deleteLocation(createdLoc.id);
  assert.strictEqual(delRes.success, true);
  const reCheck = pricingService.findLocation(createdLoc.id);
  assert.strictEqual(reCheck, null, 'Deleted location should not be found');
  console.log(`✅ Location Deleted: ${createdLoc.id}`);

  console.log('\n--- 4. Testing Route Fare Overrides CRUD ---');
  // Create Route
  const newRoute = pricingService.createRouteFare({
    from: 'Test Station Alpha',
    to: 'Test Station Beta',
    fare: 4.80,
    zone_type: 'out',
    notes: 'Special event test corridor'
  });
  assert(newRoute.id, 'Route should have an ID');
  assert.strictEqual(newRoute.fare, 4.80);
  console.log(`✅ Route Fare Created: ${newRoute.id} (${newRoute.from} <-> ${newRoute.to} = ${newRoute.fare})`);

  // Test fare calculation with the new route
  const calcTest = pricingService.calculateFare('Test Station Alpha', 'Test Station Beta');
  assert.strictEqual(calcTest.fare, 4.80);
  assert.strictEqual(calcTest.is_override, true);

  // Update Route
  const updatedRoute = pricingService.updateRouteFare(newRoute.id, {
    fare: 5.20
  });
  assert.strictEqual(updatedRoute.fare, 5.20);
  console.log(`✅ Route Fare Updated: ${updatedRoute.id} fare = ${updatedRoute.fare}`);

  // Delete Route
  const delRouteRes = pricingService.deleteRouteFare(newRoute.id);
  assert.strictEqual(delRouteRes.success, true);
  console.log(`✅ Route Fare Deleted: ${newRoute.id}`);

  console.log('\n--- 5. Testing Pricing Settings Update ---');
  const oldSettings = pricingService.getPricingConfig().settings;
  const updatedSettings = pricingService.updateSettings({
    in_campus_base_fare: 3.00,
    out_campus_base_fare: 4.00,
    alone_multiplier: 3.0,
    mapbox_public_token: 'pk.test.token.123'
  });
  assert.strictEqual(updatedSettings.mapbox_public_token, 'pk.test.token.123');
  // Restore Mapbox token
  pricingService.updateSettings({ mapbox_public_token: oldSettings.mapbox_public_token });
  console.log('✅ Settings Update OK');

  console.log('\n🎉 ALL PRICING SERVICE & FARE ENGINE TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
