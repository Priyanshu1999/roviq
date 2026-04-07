import { expect, test } from '@playwright/test';

test.describe('Admin Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/audit-logs');
  });

  test('page loads with title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText('System-wide audit trail of all actions across institutes.'),
    ).toBeVisible();
  });

  test('has 3 tabs: All Events, Impersonation, Reseller Activity', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: /All Events/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Impersonation/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Reseller Activity/ })).toBeVisible();
  });

  test('table shows correct column headers', async ({ page }) => {
    // Wait for the table to render
    await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });

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
