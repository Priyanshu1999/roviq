import { expect, test } from '../../shared/console-guardian';
import { SEED_IDS } from '../../shared/seed';

/**
 * Visual regression baselines for the admin portal.
 *
 * First run (or `--update-snapshots`) captures the PNG baselines in
 * `./visual-regression.e2e.spec.ts-snapshots/`. Subsequent runs diff against
 * the baseline.
 *
 * Re-baselining workflow (after an intentional UI change):
 *   pnpm e2e:up
 *   pnpm test:e2e:ui -- --update-snapshots
 *   git add e2e/web-admin-e2e/src/*-snapshots
 *
 * Opting out of the axe accessibility check keeps these tests focused on
 * pixel diffs — functional tests elsewhere already cover a11y.
 */
test.use({ checkAccessibility: false });

test.describe('Admin portal — visual regression (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-login.png', {
      maxDiffPixels: 50,
      animations: 'disabled',
    });
  });
});

test.describe('Admin portal — visual regression (authenticated)', () => {
  test('dashboard', async ({ page }) => {
    await page.goto('/en/admin/dashboard');
    await expect(page.getByTestId('admin-dashboard-welcome-title')).toBeVisible();
    await expect(page.getByTestId('admin-dashboard-quick-links-title')).toBeVisible();
    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      maxDiffPixels: 100,
      animations: 'disabled',
    });
  });

  test('institutes data table', async ({ page }) => {
    await page.goto('/en/admin/institutes');
    await expect(page.getByTestId('institutes-table')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`institute-name-cell-${SEED_IDS.INSTITUTE_1}`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveScreenshot('admin-institutes-table.png', {
      maxDiffPixels: 150,
      animations: 'disabled',
    });
  });
});
