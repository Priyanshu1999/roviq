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
import { expect, test } from '../../shared/console-guardian';

test.describe('Guardians list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/people/guardians');
    await expect(page.locator('[data-test-id="guardians-title"]')).toBeVisible({ timeout: 10_000 });
  });

  test('list page renders the Guardians heading', async ({ page }) => {
    await expect(page.locator('[data-test-id="guardians-title"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('search input is present', async ({ page }) => {
    await expect(page.locator('[data-test-id="guardians-search-input"]')).toBeVisible();
  });

  test('search input accepts typing', async ({ page }) => {
    const search = page.locator('[data-test-id="guardians-search-input"]');
    await search.fill('Suresh');
    await expect(search).toHaveValue('Suresh');
  });

  test('empty state renders when no guardians match filters', async ({ page }) => {
    const search = page.locator('[data-test-id="guardians-search-input"]');
    await search.fill('zzzzz-no-such-guardian');
    await expect(page.locator('[data-test-id="guardians-filtered-empty"]')).toBeVisible({
      timeout: 5_000,
    });
  });
});
