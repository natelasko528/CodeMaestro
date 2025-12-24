import { test, expect } from '@playwright/test';

test.describe('Jobs List', () => {
  test('should display jobs list with filters', async ({ page }) => {
    await page.goto('/jobs');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Provisioning Jobs');

    // Verify summary cards exist
    await expect(page.locator('[data-testid="total-jobs"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-jobs"]')).toBeVisible();
    await expect(page.locator('[data-testid="completed-jobs"]')).toBeVisible();

    // Verify job table/grid exists
    await expect(page.locator('[data-testid="jobs-grid"]')).toBeVisible();

    // Test filter tabs
    await page.click('button:has-text("Completed")');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // All visible jobs should show completed status
    const jobCards = page.locator('[data-testid="job-card"]');
    const count = await jobCards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const status = await jobCards.nth(i).locator('[data-testid="job-status"]').textContent();
        expect(status).toContain('Completed');
      }
    }
  });

  test('should navigate to job details', async ({ page }) => {
    await page.goto('/jobs');

    // Click first job card
    const firstJob = page.locator('[data-testid="job-card"]').first();
    await firstJob.click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/jobs\/[a-zA-Z0-9-]+/);

    // Verify detail page loaded
    await expect(page.locator('[data-testid="job-detail"]')).toBeVisible();
  });

  test('should show pagination', async ({ page }) => {
    await page.goto('/jobs');

    // If there are many jobs, pagination should appear
    const pagination = page.locator('[data-testid="pagination"]');

    // Try to click next page if pagination exists
    const paginationExists = await pagination.isVisible();

    if (paginationExists) {
      const nextButton = pagination.locator('button:has-text("Next")');
      const isEnabled = await nextButton.isEnabled();

      if (isEnabled) {
        await nextButton.click();

        // Should update URL or reload content
        await page.waitForTimeout(500);

        // Verify jobs list still visible
        await expect(page.locator('[data-testid="jobs-grid"]')).toBeVisible();
      }
    }
  });
});
