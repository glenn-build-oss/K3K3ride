const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('K3K3 PWA, Socket, and Regional Search Validation', () => {

  test('index.html has mobile-web-app-capable and safe PWA registration without race conditions', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    const indexPath = 'file:///' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
    await page.goto(indexPath);

    // Verify deprecated meta tag has standard replacement
    const mobileCapableMeta = await page.locator('meta[name="mobile-web-app-capable"]').getAttribute('content');
    expect(mobileCapableMeta).toBe('yes');

    const appleMeta = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(appleMeta).toBe('yes');

    // Verify no unhandled "Failed to update a ServiceWorker" or "Old Service Worker unregistered" race condition
    const hasUnregisterRace = consoleErrors.some(e => e.includes('Failed to update a ServiceWorker'));
    expect(hasUnregisterRace).toBe(false);
  });

  test('passenger/dashboard.html correctly handles Accra/UPSA locations and avoids UHAS fallback trap', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const dashPath = 'file:///' + path.resolve(__dirname, '../passenger/dashboard.html').replace(/\\/g, '/');
    await page.goto(dashPath);

    // 1. Verify meta tags
    const mobileCapable = await page.locator('meta[name="mobile-web-app-capable"]').getAttribute('content');
    expect(mobileCapable).toBe('yes');

    // 2. Test evaluateServiceAreaClient & landmark resolution in browser context
    const testResults = await page.evaluate(() => {
      // Test 1: findClosestHoLandmark with Accra coordinates (e.g., UPSA lat: 5.6548, lng: -0.1704)
      const upsaLat = 5.6548;
      const upsaLng = -0.1704;
      const landmarkForUpsa = findClosestHoLandmark(upsaLat, upsaLng);

      // Test 2: findClosestHoLandmark with Ho coordinates (e.g., lat: 6.6012, lng: 0.4688)
      const hoLat = 6.6012;
      const hoLng = 0.4688;
      const landmarkForHo = findClosestHoLandmark(hoLat, hoLng);

      // Test 3: Local places list includes UPSA and national landmarks
      const hasUpsaLocal = (window.HO_PLACES || []).some(p => p.name.includes('UPSA'));
      const hasLegonLocal = (window.HO_PLACES || []).some(p => p.name.includes('Legon'));

      // Test 4: Coordinate lookup for UPSA
      const upsaCoords = getHoCoordinate('University of Professional Studies, Accra (UPSA)');

      return {
        landmarkForUpsa,
        landmarkForHo,
        hasUpsaLocal,
        hasLegonLocal,
        upsaCoords
      };
    });

    // An Accra location (UPSA) MUST NOT be forced into UHAS or Ho Central Market
    expect(testResults.landmarkForUpsa).toContain('UPSA');
    expect(testResults.landmarkForUpsa).not.toContain('UHAS');
    expect(testResults.landmarkForUpsa).not.toContain('Ho Central');

    // A Ho coordinate SHOULD resolve to Ho
    expect(testResults.landmarkForHo).toContain('Ho Central');

    // Autocomplete pools MUST contain national expansion points
    expect(testResults.hasUpsaLocal).toBe(true);
    expect(testResults.hasLegonLocal).toBe(true);
    expect(testResults.upsaCoords).toEqual([5.6548, -0.1704]);
  });

  test('pickup and destination autocomplete dynamically biases around user proximity', async ({ page }) => {
    const dashPath = 'file:///' + path.resolve(__dirname, '../passenger/dashboard.html').replace(/\\/g, '/');
    await page.goto(dashPath);

    // Open booking modal
    await page.evaluate(() => {
      // Simulate passenger being in Accra UPSA
      sessionStorage.setItem('k3k3_lat', '5.6548');
      sessionStorage.setItem('k3k3_lng', '-0.1704');
      sessionStorage.setItem('k3k3_pickup_name', 'University of Professional Studies, Accra (UPSA)');
      openBookModal();
    });

    // Check that pickup is auto-populated with UPSA, NOT UHAS!
    const pickupVal = await page.locator('#pickupInput').inputValue();
    expect(pickupVal).toContain('UPSA');
    expect(pickupVal).not.toContain('UHAS');

    // Type in destination search
    await page.locator('#destInput').fill('upsa');

    // Wait for suggestions box to appear
    const suggBox = page.locator('#destSuggestions');
    await expect(suggBox).toHaveClass(/show/);

    const suggestionCount = await suggBox.locator('.place-suggestion-item').count();
    expect(suggestionCount).toBeGreaterThan(0);

    const firstSuggestionText = await suggBox.locator('.place-suggestion-item .place-sugg-name').first().textContent();
    expect(firstSuggestionText.toLowerCase()).toContain('upsa');
  });

  test('passenger service area evaluation allows Accra when activated and handles inactive zones correctly', async ({ page }) => {
    const dashPath = 'file:///' + path.resolve(__dirname, '../passenger/dashboard.html').replace(/\\/g, '/');
    await page.goto(dashPath);

    const results = await page.evaluate(() => {
      // 1. Simulate Greater Accra being ACTIVE in cache
      window._activeServiceAreasCache = {
        success: true,
        regions: [
          { id: 'volta', active: true, cities: [{ id: 'ho', active: true }] },
          { id: 'greater_accra', active: true, cities: [{ id: 'accra', active: true }, { id: 'tema', active: true }] },
          { id: 'ashanti', active: false, cities: [{ id: 'kumasi', active: false }] }
        ]
      };

      // Test active Accra
      const accraEvalActive = evaluateServiceAreaClient('Accra Mall', [5.6225, -0.1770]);
      const upsaEvalActive = evaluateServiceAreaClient('University of Professional Studies, Accra (UPSA)', [5.6548, -0.1704]);
      const accraGeofenceActive = isInsideHoVoltaServiceZone(5.6548, -0.1704);

      // Test active Ho
      const hoEvalActive = evaluateServiceAreaClient('Ho Central Market', [6.6012, 0.4688]);
      const hoGeofenceActive = isInsideHoVoltaServiceZone(6.6012, 0.4688);

      // Test inactive region (Kumasi)
      const kumasiEval = evaluateServiceAreaClient('KNUST Campus, Kumasi', [6.6885, -1.6244]);

      // 2. Now simulate Greater Accra being INACTIVE
      window._activeServiceAreasCache = {
        success: true,
        regions: [
          { id: 'volta', active: true, cities: [{ id: 'ho', active: true }] },
          { id: 'greater_accra', active: false, cities: [{ id: 'accra', active: false }] }
        ]
      };
      const accraEvalInactive = evaluateServiceAreaClient('Accra Mall', [5.6225, -0.1770]);

      return {
        accraEvalActive,
        upsaEvalActive,
        accraGeofenceActive,
        hoEvalActive,
        hoGeofenceActive,
        kumasiEval,
        accraEvalInactive
      };
    });

    // When Accra is active, it must be allowed!
    expect(results.accraEvalActive.allowed).toBe(true);
    expect(results.accraEvalActive.status).toBe('ACTIVE');
    expect(results.upsaEvalActive.allowed).toBe(true);
    expect(results.accraGeofenceActive).toBe(true);

    // Ho is always allowed
    expect(results.hoEvalActive.allowed).toBe(true);
    expect(results.hoGeofenceActive).toBe(true);

    // Inactive Kumasi must be blocked
    expect(results.kumasiEval.allowed).toBe(false);
    expect(results.kumasiEval.status).toBe('COMING_SOON');

    // When Accra is deactivated, it must be blocked
    expect(results.accraEvalInactive.allowed).toBe(false);
    expect(results.accraEvalInactive.status).toBe('COMING_SOON');
  });

  test('admin/pricing-cms.html initializes simulator map cleanly without throwing Mapbox errors', async ({ page }) => {
    const cmsPath = 'file:///' + path.resolve(__dirname, '../admin/pricing-cms.html').replace(/\\/g, '/');

    // Listen for console error
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    // Fake admin login token so RBAC guard allows opening pricing-cms.html
    await page.addInitScript(() => {
      localStorage.setItem('k3k3_admin_token', 'test_admin_token');
      localStorage.setItem('current_admin', JSON.stringify({
        id: 'admin_1',
        name: 'Super Admin',
        role: 'admin',
        allowedPages: ['pricing-cms.html']
      }));
    });

    await page.goto(cmsPath);

    // Switch to simulator tab and initialize simulator map
    const simResult = await page.evaluate(async () => {
      switchTab('simulator');
      initSimulatorMap();
      return {
        hasSimMap: Boolean(window.simMap || window.simLeafletMap),
        hasContainer: Boolean(document.getElementById('simMapContainer'))
      };
    });

    expect(simResult.hasContainer).toBe(true);
    // Ensure no unhandled access token crash occurred
    const hasMapboxTokenError = pageErrors.some(e => e.includes('An API access token is required to use Mapbox GL'));
    expect(hasMapboxTokenError).toBe(false);
  });

});

