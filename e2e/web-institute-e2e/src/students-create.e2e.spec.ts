/**
 * Students create page — happy path, cancel, and validation.
 *
 * Covers /en/people/students/new:
 *   1. Fill minimum fields (academic year auto-defaults, cascading standard/section)
 *      → submit → redirect to detail page
 *   2. Back to list cancels the flow
 *   3. Empty submit surfaces validation errors
 *
 * The happy path depends on the test tenant having at least one seeded
 * standard + section under the active academic year. If the standard
 * combobox has no options, the test is skipped with a clear reason.
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Students — create page', () => {
  test('creates a student and redirects to the detail page', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Student ${unique}`;

    await page.goto('/en/people/students/new');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('textbox', { name: /first name.*english/i }).fill(firstName);

    await page.getByRole('combobox', { name: /gender/i }).click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    // Academic year auto-defaults to the active one — the standard combobox
    // should become enabled once the default year hydrates.
    const standardCombo = page.getByRole('combobox', { name: /standard/i });
    await expect(standardCombo).toBeEnabled({ timeout: 10_000 });
    await standardCombo.click();

    const firstStandard = page.getByRole('option').first();
    const standardCount = await page.getByRole('option').count();
    if (standardCount === 0) {
      test.skip(
        true,
        'Test tenant has no seeded standards under the active year — see seed script.',
      );
      return;
    }
    await firstStandard.click();

    const sectionCombo = page.getByRole('combobox', { name: /section/i });
    await expect(sectionCombo).toBeEnabled({ timeout: 10_000 });
    await sectionCombo.click();
    await page.getByRole('option').first().click();

    // Admission date — type into the input directly (Field date input).
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel(/admission date/i).fill(today);

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page).toHaveURL(/\/(institute\/)?people\/students\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('Back to students button returns to the list', async ({ page }) => {
    await page.goto('/en/people/students/new');

    await page.getByRole('textbox', { name: /first name.*english/i }).fill('Temp');

    await page.getByRole('button', { name: /back to students/i }).click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?people\/students$/);
  });

  test('blank submit shows validation errors', async ({ page }) => {
    await page.goto('/en/people/students/new');

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page).toHaveURL(/\/people\/students\/new/);
    await expect(page.getByText(/required|please/i).first()).toBeVisible();
  });

  test('newly created student appears in the list (cache freshness)', async ({ page }) => {
    const unique = Date.now();
    const firstName = `CacheFresh ${unique}`;

    await page.goto('/en/people/students/new');
    await page.getByRole('textbox', { name: /first name.*english/i }).fill(firstName);
    await page.getByRole('combobox', { name: /gender/i }).click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    const standardCombo = page.getByRole('combobox', { name: /standard/i });
    await expect(standardCombo).toBeEnabled({ timeout: 10_000 });
    await standardCombo.click();
    const standardCount = await page.getByRole('option').count();
    if (standardCount === 0) {
      test.skip(true, 'No seeded standards');
      return;
    }
    await page.getByRole('option').first().click();

    const sectionCombo = page.getByRole('combobox', { name: /section/i });
    await expect(sectionCombo).toBeEnabled({ timeout: 10_000 });
    await sectionCombo.click();
    await page.getByRole('option').first().click();

    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel(/admission date/i).fill(today);

    await page.getByRole('button', { name: /create/i }).click();
    await expect(page).toHaveURL(/\/people\/students\/[0-9a-f-]{36}/);

    // Navigate to list and search for the created student
    await page.goto('/en/people/students');
    await page.getByPlaceholder(/search by name or admission number/i).fill(firstName);
    await expect(page.getByText(firstName)).toBeVisible({ timeout: 10_000 });
  });

  test('filled fields survive validation errors', async ({ page }) => {
    const firstName = `Preserve ${Date.now()}`;

    await page.goto('/en/people/students/new');

    await page.getByRole('textbox', { name: /first name.*english/i }).fill(firstName);

    await page.getByRole('combobox', { name: /gender/i }).click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    // Submit without required fields (standard, section, admission date)
    await page.getByRole('button', { name: /create/i }).click();

    // Still on the form
    await expect(page).toHaveURL(/\/people\/students\/new/);
    await expect(page.getByText(/required|please/i).first()).toBeVisible();

    // Fields must retain their values
    await expect(page.getByRole('textbox', { name: /first name.*english/i })).toHaveValue(
      firstName,
    );
    await expect(page.getByRole('combobox', { name: /gender/i })).toContainText('Male');
  });
});
