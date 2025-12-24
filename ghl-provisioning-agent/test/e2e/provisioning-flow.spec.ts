import { test, expect } from '@playwright/test';

test.describe('Provisioning Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/dashboard');
  });

  test('should complete full provisioning workflow', async ({ page }) => {
    // Navigate to provisioning page
    await page.goto('/provision');

    // Verify page loads
    await expect(page.locator('h1')).toContainText('New Sub-Account');

    // Fill in form
    await page.fill('input[name="companyName"]', 'Test Fitness Studio');
    await page.fill('input[name="email"]', 'owner@testfitness.com');
    await page.fill('input[name="phone"]', '+1-555-0100');

    // Select industry
    await page.selectOption('select[name="industry"]', 'fitness');

    // Get AI recommendations
    await page.click('button:has-text("Get AI Recommendations")');

    // Wait for recommendations to appear
    await expect(page.locator('[data-testid="snapshot-recommendation"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Verify recommendations show confidence scores
    const firstRecommendation = page.locator('[data-testid="snapshot-recommendation"]').first();
    await expect(firstRecommendation).toContainText('%');

    // Select the recommended snapshot
    await firstRecommendation.click();

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Sub-Account")');

    // Should redirect to job detail page
    await expect(page).toHaveURL(/\/jobs\/[a-zA-Z0-9-]+/, { timeout: 15000 });

    // Verify job status is visible
    await expect(page.locator('[data-testid="job-status"]')).toBeVisible();

    // Verify live logs component exists
    await expect(page.locator('[data-testid="live-log-viewer"]')).toBeVisible();

    // Wait for completion (or timeout after 30s)
    await expect(page.locator('text="COMPLETED"')).toBeVisible({
      timeout: 30000,
    });

    // Verify sub-account ID is displayed
    await expect(page.locator('[data-testid="sub-account-id"]')).toBeVisible();
  });

  test('should handle validation errors', async ({ page }) => {
    await page.goto('/provision');

    // Try to submit without filling required fields
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('text="Company name is required"')).toBeVisible();
    await expect(page.locator('text="Email is required"')).toBeVisible();
  });

  test('should allow manual snapshot selection', async ({ page }) => {
    await page.goto('/provision');

    // Fill basic info
    await page.fill('input[name="companyName"]', 'Test Business');
    await page.fill('input[name="email"]', 'test@business.com');

    // Open snapshot selector dropdown
    await page.click('button:has-text("Select Snapshot")');

    // Select a snapshot manually
    await page.click('text="Fitness Studio Template"');

    // Verify selection
    await expect(page.locator('button:has-text("Fitness Studio Template")')).toBeVisible();

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect
    await expect(page).toHaveURL(/\/jobs\//);
  });
});
