/**
 * Test Suite: Service Area Regional Expansion & Accra Activation
 * Verifies that activating/deactivating regions (e.g. Greater Accra)
 * dynamically updates evaluation for both text landmarks and GPS coordinates,
 * and persists to Supabase admin_settings.
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const serviceAreaService = require('./services/service_area.service');
const supabaseService = require('./services/supabase.service');

async function runTests() {
  console.log('\n--- 1. Testing Default Initial State ---');
  const regions = serviceAreaService.getAllRegions();
  assert(Array.isArray(regions) && regions.length === 16, 'Should load all 16 Ghana regions');
  
  const volta = regions.find(r => r.id === 'volta');
  assert(volta && volta.active === true, 'Volta Region should be active by default');
  
  const hoEval = serviceAreaService.evaluateLocation('Ho Central Market', 6.6012, 0.4688);
  assert.strictEqual(hoEval.allowed, true, 'Ho Central Market should be allowed');
  assert.strictEqual(hoEval.status, 'ACTIVE');
  console.log('✅ Volta Region / Ho evaluates as ACTIVE');

  console.log('\n--- 2. Testing Inactive Region (Greater Accra before activation) ---');
  // Ensure deactivated initially
  serviceAreaService.toggleAreaStatus('greater_accra', null, false);
  const accraInactiveEval = serviceAreaService.evaluateLocation('Accra Mall', 5.6225, -0.1770);
  assert.strictEqual(accraInactiveEval.allowed, false, 'Accra Mall should be disallowed when Greater Accra is inactive');
  assert.strictEqual(accraInactiveEval.status, 'COMING_SOON');
  assert(accraInactiveEval.message.includes('Accra') || accraInactiveEval.message.includes('Greater Accra'), 'Should inform user service is coming soon');
  console.log('✅ Inactive Accra correctly blocked with Coming Soon message');

  console.log('\n--- 3. Testing Regional Activation (Greater Accra) ---');
  // Activate Greater Accra
  const toggleRes = serviceAreaService.toggleAreaStatus('greater_accra', null, true);
  assert.strictEqual(toggleRes.success, true, 'toggleAreaStatus should succeed');
  assert.strictEqual(toggleRes.region.active, true, 'Region active flag should be true');

  // Verify cities in Greater Accra are also active
  const accraCity = toggleRes.region.cities.find(c => c.id === 'accra');
  assert(accraCity && accraCity.active === true, 'Accra city should be marked active');

  // Test Text query: 'Accra Mall'
  const textEval = serviceAreaService.evaluateLocation('Accra Mall', null, null);
  assert.strictEqual(textEval.allowed, true, 'Accra Mall text query must be ALLOWED when activated');
  assert.strictEqual(textEval.status, 'ACTIVE');
  assert.strictEqual(textEval.region_id, 'greater_accra');
  console.log('✅ Accra Mall landmark evaluates as ACTIVE after activation');

  // Test GPS Coordinates: UPSA (lat: 5.6548, lng: -0.1704)
  const upsaCoordEval = serviceAreaService.evaluateLocation('UPSA Hostel', 5.6548, -0.1704);
  assert.strictEqual(upsaCoordEval.allowed, true, 'UPSA coordinates must be ALLOWED when Greater Accra is active');
  assert.strictEqual(upsaCoordEval.status, 'ACTIVE');
  console.log('✅ Accra GPS coordinates (UPSA) evaluate as ACTIVE');

  // Test Kotoka International Airport (lat: 5.6052, lng: -0.1718)
  const kiaEval = serviceAreaService.evaluateLocation('Kotoka International Airport (ACC)', 5.6052, -0.1718);
  assert.strictEqual(kiaEval.allowed, true, 'Airport must be ALLOWED');
  console.log('✅ Kotoka Airport evaluates as ACTIVE');

  console.log('\n--- 4. Testing Supabase admin_settings Sync ---');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await serviceAreaService.syncToSupabase();
    const remoteSetting = await supabaseService.getAdminSetting('ghana_service_areas');
    assert(remoteSetting, 'Supabase should return ghana_service_areas setting');
    const parsed = typeof remoteSetting.value === 'string' ? JSON.parse(remoteSetting.value) : remoteSetting.value;
    const remoteAccra = parsed.regions.find(r => r.id === 'greater_accra');
    assert(remoteAccra && remoteAccra.active === true, 'Supabase remote setting must reflect Greater Accra active: true');
    console.log('✅ Remote Supabase admin_settings verified: Greater Accra active = true');
  } else {
    console.log('⚠️ Skipping Supabase live check (missing env vars)');
  }

  console.log('\n--- 5. Testing Fare & Rate Configuration for Activated Region ---');
  assert(textEval.base_fare_shared > 0, 'Should have positive base_fare_shared');
  assert(textEval.base_fare_alone > 0, 'Should have positive base_fare_alone');
  console.log(`✅ Greater Accra Fares: Shared = ₵${textEval.base_fare_shared.toFixed(2)}, Alone = ₵${textEval.base_fare_alone.toFixed(2)}`);

  console.log('\n🎉 ALL REGIONAL EXPANSION & ACCRA ACTIVATION TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
