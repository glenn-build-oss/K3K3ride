const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('K3K3 Legal Pages Verification', () => {

  test('Terms of Service contains all 18 sections, preamble, and contact info', async ({ page }) => {
    const filePath = 'file:///' + path.resolve(__dirname, '../legal/terms-of-service.html').replace(/\\/g, '/');
    await page.goto(filePath);

    // Verify Title and Header
    await expect(page.locator('h1')).toHaveText('Terms of Service');
    await expect(page.locator('.header p')).toContainText('23 October 2026');

    // Verify Preamble
    const agreementSection = page.locator('#agreement');
    await expect(agreementSection).toBeVisible();
    await expect(agreementSection).toContainText('Agreement to Terms');
    await expect(agreementSection).toContainText('independent keke (tricycle) drivers');

    // Verify all 18 numbered sections
    for (let i = 1; i <= 18; i++) {
      const section = page.locator(`#section-${i}`);
      await expect(section).toBeVisible();
    }

    // Verify specific key terms
    await expect(page.locator('#section-1')).toContainText('About K3K3ride');
    await expect(page.locator('#section-5')).toContainText('Ghana Card verification');
    await expect(page.locator('#section-13')).toContainText('Data Protection Act, 2012 (Act 843)');
    await expect(page.locator('#section-18')).toContainText('General Provisions');

    // Verify Contact Section
    const contact = page.locator('#contact');
    await expect(contact).toContainText('k3k3ride@gmail.com');
    await expect(contact).toContainText('https://www.k3k3ride.com/');
  });

  test('Privacy Policy contains all 15 sections, Ghana Act 843, and DPC link', async ({ page }) => {
    const filePath = 'file:///' + path.resolve(__dirname, '../legal/privacy-policy.html').replace(/\\/g, '/');
    await page.goto(filePath);

    // Verify Title and Header
    await expect(page.locator('h1')).toHaveText('Privacy Policy');
    await expect(page.locator('.header p')).toContainText('23 October 2026');

    // Verify all 15 numbered sections
    for (let i = 1; i <= 15; i++) {
      const section = page.locator(`#section-${i}`);
      await expect(section).toBeVisible();
    }

    // Verify specific requirements
    await expect(page.locator('#section-1')).toContainText('Data Protection Act, 2012 (Act 843)');
    await expect(page.locator('#section-2')).toContainText('k3k3ride@gmail.com');
    await expect(page.locator('#section-11')).toContainText('https://dpc.gov.gh/');
    await expect(page.locator('#section-12')).toContainText('Children');

    // Verify Contact Info
    const contact = page.locator('#contact');
    await expect(contact).toContainText('k3k3ride@gmail.com');
  });

  test('Cookie Policy contains all 8 sections, eaten cookie SVG, and contact info', async ({ page }) => {
    const filePath = 'file:///' + path.resolve(__dirname, '../legal/cookie-policy.html').replace(/\\/g, '/');
    await page.goto(filePath);

    // Verify Title and Header
    await expect(page.locator('h1')).toHaveText('Cookie Policy');
    await expect(page.locator('.header p')).toContainText('23 October 2026');

    // Verify Bitten / Eaten Cookie SVG is present
    const eatenCookie = page.locator('.eaten-cookie-badge .bitten-cookie-svg');
    await expect(eatenCookie).toBeVisible();

    // Verify all 8 numbered sections
    for (let i = 1; i <= 8; i++) {
      const section = page.locator(`#section-${i}`);
      await expect(section).toBeVisible();
    }

    // Verify key sections
    await expect(page.locator('#section-1')).toContainText('https://www.k3k3ride.com/');
    await expect(page.locator('#section-2')).toContainText('Why We May Use Cookies');
    await expect(page.locator('#section-4')).toContainText('Managing Your Choices');
    await expect(page.locator('#section-5')).toContainText('Location Services');
    await expect(page.locator('#section-8')).toContainText('Changes to This Cookie Policy');

    // Verify Contact Info
    const contact = page.locator('#contact');
    await expect(contact).toContainText('k3k3ride@gmail.com');
    await expect(contact).toContainText('https://www.k3k3ride.com/');
  });

});
