import { expect, test } from '../../shared/console-guardian';

test.describe('Admin Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/audit-logs');
  });

  test('page loads with title and description', async ({ page }) => {
    await expect(page.locator('[data-test-id="audit-logs-title"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-test-id="audit-logs-description"]')).toBeVisible();
  });

  test('has 3 tabs: All Events, Impersonation, Reseller Activity', async ({ page }) => {
    await expect(page.locator('[data-test-id="audit-logs-title"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-test-id="audit-logs-tab-all"]')).toBeVisible();
    await expect(page.locator('[data-test-id="audit-logs-tab-impersonation"]')).toBeVisible();
    await expect(page.locator('[data-test-id="audit-logs-tab-reseller"]')).toBeVisible();
  });

  test('table shows correct column headers', async ({ page }) => {
    // Wait for the table to render
    await expect(page.locator('[data-test-id="audit-logs-table"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole('columnheader', { name: 'Timestamp' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actor' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Entity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Entity ID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Source' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'IP Address' })).toBeVisible();
  });
});
