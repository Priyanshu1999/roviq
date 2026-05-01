import { testIds } from '@roviq/ui/testing/testid-registry';
import { expect, test } from '../../shared/console-guardian';

/**
 * Sidebar navigation links for the admin portal.
 * Grouped by nav section as defined in the admin layout.
 */
const SIDEBAR_LINKS = [
  // Overview group
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Institutes', path: '/institutes' },
  { name: 'Institute Groups', path: '/institute-groups' },
  // System group
  { name: 'Audit Logs', path: '/audit-logs' },
  // Observability embeds a Grafana iframe (localhost:3001) — skipped in E2E
  { name: 'Account', path: '/account' },
] as const;

test.describe('Admin Navigation', () => {
  test('all sidebar links load without errors', async ({ page }) => {
    // Start at dashboard
    await page.goto('/en/admin/dashboard');
    await expect(page.getByTestId(testIds.adminDashboard.welcomeTitle)).toBeVisible({
      timeout: 15_000,
    });

    for (const link of SIDEBAR_LINKS) {
      await page.goto(`/en/admin${link.path}`);

      // Verify no error page rendered — check the page loaded successfully
      // by confirming no uncaught error boundary or 404 page
      await expect(page.locator('body')).not.toContainText('404', { timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('breadcrumbs render on key pages', async ({ page }) => {
    // Both mobile + desktop variants render in DOM (CSS hides one per breakpoint);
    // scope to desktop since the test runs at desktop viewport.
    const breadcrumbNav = page.getByTestId(testIds.layout.breadcrumbsDesktop);

    // Institutes page
    await page.goto('/en/admin/institutes');
    await expect(page.getByTestId(testIds.adminInstitutes.title)).toBeVisible({
      timeout: 15_000,
    });
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav.getByText('Institutes')).toBeVisible();

    // Institute Groups page
    await page.goto('/en/admin/institute-groups');
    await expect(page.getByTestId(testIds.adminInstituteGroups.title)).toBeVisible({
      timeout: 15_000,
    });
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav.getByText('Institute Groups')).toBeVisible();

    // Audit Logs page
    await page.goto('/en/admin/audit-logs');
    await expect(page.getByTestId(testIds.adminAuditLogs.title)).toBeVisible({
      timeout: 15_000,
    });
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav.getByText('Audit Logs')).toBeVisible();
  });
});
