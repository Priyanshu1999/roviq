/**
 * ROV-169 — Staff list page smoke tests.
 *
 * Resilient to an empty seed: verifies the page chrome (title, Add Staff
 * button) renders for an authenticated institute admin. Actual CRUD flows
 * will be added once the seed includes staff fixtures.
 *
 * Route under test: `/en/people/staff` (the `(dashboard)` segment is
 * invisible in URLs).
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Staff list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/people/staff');
    await expect(page.getByTestId('staff-title')).toBeVisible({ timeout: 10_000 });
  });

  test('list page renders the Staff heading', async ({ page }) => {
    await expect(page.getByTestId('staff-title')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Add Staff button is visible for the institute admin', async ({ page }) => {
    await expect(page.getByTestId('staff-new-btn')).toBeVisible();
  });

  test('search input accepts typing', async ({ page }) => {
    const search = page.getByTestId('staff-search');
    await expect(search).toBeVisible();
    await search.fill('Rajesh');
    await expect(search).toHaveValue('Rajesh');
  });

  test('empty state renders when no staff match filters', async ({ page }) => {
    const search = page.getByTestId('staff-search');
    await search.fill('zzzzz-no-such-staff');
    await expect(page.getByTestId('staff-empty-state')).toBeVisible({
      timeout: 5_000,
    });
  });
});
