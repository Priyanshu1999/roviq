import { expect, test } from '@playwright/test';

test.describe('Admin Institutes', () => {
  test.describe('Institutes list', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/en/admin/institutes');
    });

    test('page loads with title and description', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Institutes' })).toBeVisible();
      await expect(page.getByText('Manage all institutes on the platform.')).toBeVisible();
    });

    test('table displays correct column headers', async ({ page }) => {
      // Wait for the table to render (either data or skeleton)
      await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });

      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Reseller' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Group' })).toBeVisible();
    });

    test('shows at least 2 seeded institutes', async ({ page }) => {
      // Wait for table rows to load
      await expect(page.getByText('Saraswati Vidya Mandir')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Rajasthan Public School')).toBeVisible();
    });

    test('"Pending Approval" tab is visible', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /Pending Approval/ })).toBeVisible();
    });

    test('clicking an institute row navigates to detail page', async ({ page }) => {
      await expect(page.getByText('Saraswati Vidya Mandir')).toBeVisible({ timeout: 15_000 });
      await page.getByText('Saraswati Vidya Mandir').click();
      await expect(page).toHaveURL(/\/institutes\/[a-f0-9-]+/, { timeout: 10_000 });
    });
  });

  test.describe('Institute detail', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to detail via the list to get a valid institute ID
      await page.goto('/en/admin/institutes');
      await expect(page.getByText('Saraswati Vidya Mandir')).toBeVisible({ timeout: 15_000 });
      await page.getByText('Saraswati Vidya Mandir').click();
      await expect(page).toHaveURL(/\/institutes\/[a-f0-9-]+/, { timeout: 10_000 });
    });

    test('detail page loads with institute name as heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Saraswati Vidya Mandir' })).toBeVisible({
        timeout: 10_000,
      });
    });

    test('breadcrumb shows institute name', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Saraswati Vidya Mandir' })).toBeVisible({
        timeout: 10_000,
      });
      // Breadcrumb navigation should contain the institute name
      const breadcrumbs = page.locator(
        'nav[aria-label="breadcrumb"], nav[aria-label="Breadcrumb"]',
      );
      await expect(breadcrumbs.getByText('Saraswati Vidya Mandir')).toBeVisible();
    });

    test('Overview tab shows Identity, Contact, and Address sections', async ({ page }) => {
      // Overview tab is active by default
      await expect(page.getByRole('tab', { name: /Overview/ })).toBeVisible({ timeout: 10_000 });

      // Identity card
      await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible();

      // Contact card
      await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();

      // Address card
      await expect(page.getByRole('heading', { name: 'Address' })).toBeVisible();
    });

    test('has expected tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /Overview/ })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('tab', { name: /Academic Structure/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Configuration/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Branding/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Audit Log/ })).toBeVisible();
      // Setup Progress tab may or may not be visible depending on institute status
    });
  });
});
