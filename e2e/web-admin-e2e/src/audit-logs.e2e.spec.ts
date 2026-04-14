import { expect, test } from '../../shared/console-guardian';

test.describe('Admin Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/audit-logs');
  });

  test('page loads with title and description', async ({ page }) => {
    await expect(page.getByTestId('audit-logs-title')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('audit-logs-description')).toBeVisible();
  });

  test('has 3 tabs: All Events, Impersonation, Reseller Activity', async ({ page }) => {
    await expect(page.getByTestId('audit-logs-title')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('audit-logs-tab-all')).toBeVisible();
    await expect(page.getByTestId('audit-logs-tab-impersonation')).toBeVisible();
    await expect(page.getByTestId('audit-logs-tab-reseller')).toBeVisible();
  });

  test('table shows correct column headers', async ({ page }) => {
    // Wait for the table to render
    await expect(page.getByTestId('audit-logs-table')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByTestId('audit-logs-table-col-createdAt')).toBeVisible();
    await expect(page.getByTestId('audit-logs-table-col-actorId')).toBeVisible();
    await expect(page.getByTestId('audit-logs-table-col-action')).toBeVisible();
    await expect(page.getByTestId('audit-logs-table-col-actionType')).toBeVisible();
    await expect(page.getByTestId('audit-logs-table-col-entityType')).toBeVisible();
    await expect(page.getByTestId('audit-logs-table-col-entityId')).toBeVisible();
    await expect(page.getByTestId('audit-logs-table-col-source')).toBeVisible();
    await expect(page.getByTestId('audit-logs-table-col-ipAddress')).toBeVisible();
  });
});
