import { expect, test } from '../../shared/console-guardian';
import { SEED, SEED_IDS } from '../../shared/seed';

test.describe('Admin Institutes', () => {
  test.describe('Institutes list', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/en/admin/institutes');
    });

    test('page loads with title and description', async ({ page }) => {
      await expect(page.locator('[data-test-id="institutes-title"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institutes-description"]')).toBeVisible();
    });

    test('table displays correct column headers', async ({ page }) => {
      // Wait for the table to render (either data or skeleton)
      await expect(page.locator('[data-test-id="institutes-table"]')).toBeVisible({
        timeout: 15_000,
      });

      await expect(page.locator('[data-test-id="institutes-table-col-name"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institutes-table-col-code"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institutes-table-col-type"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institutes-table-col-status"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institutes-table-col-reseller"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institutes-table-col-group"]')).toBeVisible();
    });

    test('shows at least 2 seeded institutes', async ({ page }) => {
      // Wait for table rows to load
      await expect(
        page.locator(`[data-test-id="institute-name-cell-${SEED_IDS.INSTITUTE_1}"]`),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator(`[data-test-id="institute-name-cell-${SEED_IDS.INSTITUTE_2}"]`),
      ).toBeVisible();
    });

    test('"Pending Approval" tab is visible', async ({ page }) => {
      await expect(page.locator('[data-test-id="institutes-tab-pending"]')).toBeVisible();
    });

    test('clicking an institute row navigates to detail page', async ({ page }) => {
      const nameCell = page.locator(`[data-test-id="institute-name-cell-${SEED_IDS.INSTITUTE_1}"]`);
      await expect(nameCell).toBeVisible({ timeout: 15_000 });
      await nameCell.click();
      await expect(page).toHaveURL(/\/institutes\/[a-f0-9-]+/, { timeout: 10_000 });
    });
  });

  test.describe('Institute detail', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to detail via the list to get a valid institute ID
      await page.goto('/en/admin/institutes');
      const nameCell = page.locator(`[data-test-id="institute-name-cell-${SEED_IDS.INSTITUTE_1}"]`);
      await expect(nameCell).toBeVisible({ timeout: 15_000 });
      await nameCell.click();
      await expect(page).toHaveURL(/\/institutes\/[a-f0-9-]+/, { timeout: 10_000 });
    });

    test('detail page loads with institute name as heading', async ({ page }) => {
      await expect(page.locator('[data-test-id="institute-detail-title"]')).toBeVisible({
        timeout: 10_000,
      });
    });

    test('breadcrumb shows institute name', async ({ page }) => {
      await expect(page.locator('[data-test-id="institute-detail-title"]')).toBeVisible({
        timeout: 10_000,
      });
      // Breadcrumb navigation should contain the institute name
      const breadcrumbs = page.locator(
        'nav[aria-label="breadcrumb"], nav[aria-label="Breadcrumb"]',
      );
      await expect(breadcrumbs.getByText(SEED.INSTITUTE_1.name)).toBeVisible();
    });

    test('Overview tab shows Identity, Contact, and Address sections', async ({ page }) => {
      // Overview tab is active by default
      await expect(page.locator('[data-test-id="institute-detail-tab-overview"]')).toBeVisible({
        timeout: 10_000,
      });

      // Identity card
      await expect(page.locator('[data-test-id="institute-detail-identity-title"]')).toBeVisible();

      // Contact card
      await expect(page.locator('[data-test-id="institute-detail-contact-title"]')).toBeVisible();

      // Address card
      await expect(page.locator('[data-test-id="institute-detail-address-title"]')).toBeVisible();
    });

    test('has expected tabs', async ({ page }) => {
      await expect(page.locator('[data-test-id="institute-detail-tab-overview"]')).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.locator('[data-test-id="institute-detail-tab-academic"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institute-detail-tab-config"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institute-detail-tab-branding"]')).toBeVisible();
      await expect(page.locator('[data-test-id="institute-detail-tab-audit"]')).toBeVisible();
      // Setup Progress tab may or may not be visible depending on institute status
    });
  });
});
