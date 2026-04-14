import { expect, test } from '../../shared/console-guardian';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/dashboard');
  });

  test('renders welcome card', async ({ page }) => {
    await expect(page.getByTestId('admin-dashboard-welcome-title')).toBeVisible();
    await expect(page.getByTestId('admin-dashboard-welcome-description')).toBeVisible();
  });

  test('shows all quick links', async ({ page }) => {
    await expect(page.getByTestId('admin-dashboard-quick-links-title')).toBeVisible();
    await expect(page.getByTestId('admin-dashboard-link-institutes')).toBeVisible();
    await expect(page.getByTestId('admin-dashboard-link-users')).toBeVisible();
    await expect(page.getByTestId('admin-dashboard-link-audit-logs')).toBeVisible();
    await expect(page.getByTestId('admin-dashboard-link-settings')).toBeVisible();
  });

  test('quick link "Manage Institutes" navigates to institutes page', async ({ page }) => {
    await page.getByTestId('admin-dashboard-link-institutes-link').click();
    await expect(page).toHaveURL(/\/institutes/, { timeout: 10_000 });
    await expect(page.getByTestId('institutes-title')).toBeVisible();
  });

  test('quick link "View Audit Logs" navigates to audit logs page', async ({ page }) => {
    await page.getByTestId('admin-dashboard-link-audit-logs-link').click();
    await expect(page).toHaveURL(/\/audit-logs/, { timeout: 10_000 });
    await expect(page.getByTestId('audit-logs-title')).toBeVisible();
  });
});
