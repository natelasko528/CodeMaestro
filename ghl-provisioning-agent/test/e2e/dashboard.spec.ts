import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should display dashboard with stats', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify page loads
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Verify stats cards exist
    await expect(page.locator('text="Total Jobs"')).toBeVisible();
    await expect(page.locator('text="Active Jobs"')).toBeVisible();
    await expect(page.locator('text="Completed"')).toBeVisible();
    await expect(page.locator('text="Success Rate"')).toBeVisible();

    // Verify OAuth status component exists
    await expect(page.locator('[data-testid="oauth-status"]')).toBeVisible();

    // Verify recent activity section
    await expect(page.locator('text="Recent Activity"')).toBeVisible();
  });

  test('should navigate to provision page from quick action', async ({ page }) => {
    await page.goto('/dashboard');

    // Click "New Provision" button
    await page.click('button:has-text("New Provision")');

    // Should navigate to provision page
    await expect(page).toHaveURL('/provision');
  });

  test('should show recent jobs in activity feed', async ({ page }) => {
    await page.goto('/dashboard');

    // Recent activity feed should exist
    const activityFeed = page.locator('[data-testid="recent-activity"]');
    await expect(activityFeed).toBeVisible();

    // Check if jobs are displayed
    const jobs = page.locator('[data-testid="activity-job"]');
    const count = await jobs.count();

    if (count > 0) {
      // First job should show status
      const firstJob = jobs.first();
      await expect(firstJob.locator('[data-testid="job-status"]')).toBeVisible();

      // Should show timestamp
      await expect(firstJob.locator('[data-testid="job-timestamp"]')).toBeVisible();
    }
  });
});
