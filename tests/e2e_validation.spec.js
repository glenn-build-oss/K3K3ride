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

});
