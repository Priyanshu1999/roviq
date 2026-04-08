import { expect, test } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/dashboard');
  });

  test('renders welcome card', async ({ page }) => {
    await expect(page.getByText('Welcome to Roviq Admin')).toBeVisible();
    await expect(
      page.getByText('Manage institutes, users, and platform settings from here.'),
    ).toBeVisible();
  });

  test('shows all quick links', async ({ page }) => {
    await expect(page.getByText('Quick Links')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage Institutes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage Users' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Audit Logs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Settings' })).toBeVisible();
  });

  test('quick link "Manage Institutes" navigates to institutes page', async ({ page }) => {
    await page.getByRole('link', { name: 'Manage Institutes' }).click();
    await expect(page).toHaveURL(/\/institutes/, { timeout: 10_000 });
    await expect(page.getByText('Institutes')).toBeVisible();
  });

  test('quick link "View Audit Logs" navigates to audit logs page', async ({ page }) => {
    await page.getByRole('link', { name: 'View Audit Logs' }).click();
    await expect(page).toHaveURL(/\/audit-logs/, { timeout: 10_000 });
    await expect(page.getByText('Audit Logs')).toBeVisible();
  });
});
