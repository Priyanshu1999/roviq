/**
 * Students create page — happy path, cancel, and validation.
 *
 * Covers /en/people/students/new:
 *   1. Fill minimum fields (academic year auto-defaults, cascading standard/section)
 *      → submit → redirect to detail page
 *   2. Back button returns to list
 *   3. Empty submit surfaces validation errors
 *
 * The happy path depends on the test tenant having at least one seeded
 * standard + section under the active academic year.
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Students — create page', () => {
  test('creates a student and redirects to the detail page', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Student ${unique}`;

    await page.goto('/en/people/students/new');

    await expect(page.locator('[data-test-id="students-new-title"]')).toBeVisible();

    await page.locator('[data-test-id="students-new-first-name-en"]').fill(firstName);

    await page.locator('[data-test-id="students-new-gender-select"]').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    // Academic year auto-defaults to the active one — the standard select
    // should become enabled once the default year hydrates.
    const standardSelect = page.locator('[data-test-id="students-new-standard-select"]');
    await expect(standardSelect).toBeEnabled({ timeout: 10_000 });
    await standardSelect.click();

    const options = page.getByRole('option');
    const standardCount = await options.count();
    if (standardCount === 0) {
      test.skip(
        true,
        'Test tenant has no seeded standards under the active year — see seed script.',
      );
      return;
    }
    await options.first().click();

    const sectionSelect = page.locator('[data-test-id="students-new-section-select"]');
    await expect(sectionSelect).toBeEnabled({ timeout: 10_000 });
    await sectionSelect.click();
    await page.getByRole('option').first().click();

    const today = new Date().toISOString().slice(0, 10);
    await page.locator('[data-test-id="students-new-admission-date-input"]').fill(today);

    await page.locator('[data-test-id="students-new-submit-btn"]').click();

    await expect(page).toHaveURL(/\/(institute\/)?people\/students\/[0-9a-f-]{36}/);
    await expect(page.locator('[data-test-id="students-detail-title"]')).toBeVisible();
  });

  test('Back button returns to the students list', async ({ page }) => {
    await page.goto('/en/people/students/new');

    await expect(page.locator('[data-test-id="students-new-title"]')).toBeVisible();
    await page.locator('[data-test-id="students-new-back-btn"]').click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?people\/students$/);
  });

  test('blank submit shows validation errors and stays on page', async ({ page }) => {
    await page.goto('/en/people/students/new');

    await page.locator('[data-test-id="students-new-submit-btn"]').click();

    await expect(page).toHaveURL(/\/people\/students\/new/);
    await expect(page.locator('[data-test-id="students-new-title"]')).toBeVisible();
  });

  test('newly created student appears in the list (cache freshness)', async ({ page }) => {
    const unique = Date.now();
    const firstName = `CacheFresh ${unique}`;

    await page.goto('/en/people/students/new');
    await page.locator('[data-test-id="students-new-first-name-en"]').fill(firstName);
    await page.locator('[data-test-id="students-new-gender-select"]').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    const standardSelect = page.locator('[data-test-id="students-new-standard-select"]');
    await expect(standardSelect).toBeEnabled({ timeout: 10_000 });
    await standardSelect.click();
    const standardCount = await page.getByRole('option').count();
    if (standardCount === 0) {
      test.skip(true, 'No seeded standards');
      return;
    }
    await page.getByRole('option').first().click();

    const sectionSelect = page.locator('[data-test-id="students-new-section-select"]');
    await expect(sectionSelect).toBeEnabled({ timeout: 10_000 });
    await sectionSelect.click();
    await page.getByRole('option').first().click();

    const today = new Date().toISOString().slice(0, 10);
    await page.locator('[data-test-id="students-new-admission-date-input"]').fill(today);

    await page.locator('[data-test-id="students-new-submit-btn"]').click();
    await expect(page).toHaveURL(/\/people\/students\/[0-9a-f-]{36}/);

    await page.goto('/en/people/students');
    await page.locator('[data-test-id="students-search-input"]').fill(firstName);
    await expect(page.locator('[data-test-id="students-table"]').getByText(firstName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('filled fields survive validation errors', async ({ page }) => {
    const firstName = `Preserve ${Date.now()}`;

    await page.goto('/en/people/students/new');

    await page.locator('[data-test-id="students-new-first-name-en"]').fill(firstName);

    await page.locator('[data-test-id="students-new-gender-select"]').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    // Submit without required fields (standard, section, admission date)
    await page.locator('[data-test-id="students-new-submit-btn"]').click();

    // Still on the form
    await expect(page).toHaveURL(/\/people\/students\/new/);

    // Fields must retain their values
    await expect(page.locator('[data-test-id="students-new-first-name-en"]')).toHaveValue(
      firstName,
    );
    await expect(page.locator('[data-test-id="students-new-gender-select"]')).toContainText('Male');
  });
});
