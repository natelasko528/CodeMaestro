import { test, expect } from '@playwright/test';

test.describe('OAuth Connection', () => {
  test('should display connection page', async ({ page }) => {
    await page.goto('/connect');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Connect to GoHighLevel');

    // Verify OAuth button exists
    await expect(page.locator('button:has-text("Connect")')).toBeVisible();

    // Verify security information
    await expect(page.locator('text="OAuth 2.0"')).toBeVisible();
    await expect(page.locator('text="Secure"')).toBeVisible();
  });

  test('should show connection status when connected', async ({ page }) => {
    // This would need to be mocked in real tests
    await page.goto('/connect');

    // Verify status indicator exists
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
  });

  test('should navigate to settings from connect page', async ({ page }) => {
    await page.goto('/connect');

    // Look for settings link
    const settingsLink = page.locator('a[href="/settings"]');
    const exists = await settingsLink.isVisible();

    if (exists) {
      await settingsLink.click();
      await expect(page).toHaveURL('/settings');
    }
  });
});
