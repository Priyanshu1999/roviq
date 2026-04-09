/**
 * ROV-169 — Guardian list page smoke tests.
 *
 * Resilient to an empty seed: verifies the page chrome (title, search
 * input) renders for an authenticated institute admin. The guardian list
 * may be empty on a fresh seed, so this spec only asserts that the page
 * renders — no row-level assertions.
 *
 * Route under test: `/en/people/guardians`.
 */
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Guardians list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/people/guardians');
    await page.waitForLoadState('networkidle');
  });

  test('list page renders the Guardians heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /^guardians$/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('search input is present', async ({ page }) => {
    await expect(page.getByPlaceholder(/search by name or phone/i)).toBeVisible();
  });

  test('search input accepts typing', async ({ page }) => {
    const search = page.getByPlaceholder(/search by name or phone/i);
    await search.fill('Suresh');
    await expect(search).toHaveValue('Suresh');
  });
});
