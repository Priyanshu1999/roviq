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
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Staff list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/people/staff');
    await page.waitForLoadState('networkidle');
  });

  test('list page renders the Staff heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /^staff$/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Add Staff button is visible for the institute admin', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add staff/i })).toBeVisible();
  });

  test('search input accepts typing', async ({ page }) => {
    const search = page.getByPlaceholder(/search by name or employee id/i);
    await expect(search).toBeVisible();
    await search.fill('Rajesh');
    await expect(search).toHaveValue('Rajesh');
  });
});
