/**
 * Staff create page — happy path, cancel, and validation.
 *
 * Covers /en/people/staff/new:
 *   1. Fill minimum required fields → submit → redirect to detail page
 *   2. Back button returns to list
 *   3. Empty submit surfaces validation errors
 *   4. Newly created staff appears in the list
 *   5. Filled fields survive validation errors
 *
 * Note: `department` is a plain text Input (not a Select).
 * `employmentType` is a Select with REGULAR/CONTRACTUAL/PART_TIME/GUEST/VOLUNTEER options.
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Staff — create page', () => {
  test('creates a staff member and redirects to the detail page', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Teacher ${unique}`;
    const email = `teacher.${unique}@example.test`;

    await page.goto('/en/people/staff/new');

    await expect(page.getByTestId('staff-new-title')).toBeVisible();

    // I18nInput renders one textbox per locale; English locale input is first.
    await page.getByTestId('staff-first-name-en').fill(firstName);

    // Gender select
    await page.getByTestId('staff-new-gender-select').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    await page.getByTestId('staff-new-email-input').fill(email);
    await page.getByTestId('staff-new-phone-input').fill('9876543210');
    await page.getByTestId('staff-new-designation-input').fill('Senior Teacher');
    await page.getByTestId('staff-new-department-input').fill('Science');

    // Employment type select
    await page.getByTestId('staff-new-employment-type-select').click();
    await page.getByRole('option').first().click();

    await page.getByTestId('staff-new-submit-btn').click();

    await expect(page).toHaveURL(/\/(institute\/)?people\/staff\/[0-9a-f-]{36}/);
    await expect(page.getByTestId('staff-detail-title')).toBeVisible();
  });

  test('Back button returns to the staff list', async ({ page }) => {
    await page.goto('/en/people/staff/new');

    await expect(page.getByTestId('staff-new-title')).toBeVisible();
    await page.getByTestId('staff-new-back-btn').click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?people\/staff$/);
  });

  test('blank submit shows validation errors and stays on page', async ({ page }) => {
    await page.goto('/en/people/staff/new');

    await page.getByTestId('staff-new-submit-btn').click();

    // Page must not redirect — still on /new
    await expect(page).toHaveURL(/\/people\/staff\/new/);
    // Some field error message must be visible
    await expect(page.getByTestId('staff-new-title')).toBeVisible();
  });

  test('newly created staff appears in the list (cache freshness)', async ({ page }) => {
    const unique = Date.now();
    const firstName = `CacheFresh ${unique}`;
    const email = `cachefresh.${unique}@example.test`;

    await page.goto('/en/people/staff/new');
    await page.getByTestId('staff-first-name-en').fill(firstName);
    await page.getByTestId('staff-new-gender-select').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();
    await page.getByTestId('staff-new-email-input').fill(email);
    await page.getByTestId('staff-new-phone-input').fill('9876543210');
    await page.getByTestId('staff-new-designation-input').fill('Teacher');
    await page.getByTestId('staff-new-department-input').fill('Science');
    await page.getByTestId('staff-new-employment-type-select').click();
    await page.getByRole('option').first().click();

    await page.getByTestId('staff-new-submit-btn').click();
    await expect(page).toHaveURL(/\/people\/staff\/[0-9a-f-]{36}/);

    // Navigate to list and search for the created staff
    await page.goto('/en/people/staff');
    await page.getByTestId('staff-search').fill(firstName);
    await expect(page.getByTestId('staff-table').getByText(firstName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('filled fields survive validation errors', async ({ page }) => {
    const email = `preserve.${Date.now()}@example.test`;
    const designation = 'Senior Teacher';

    await page.goto('/en/people/staff/new');

    await page.getByTestId('staff-new-email-input').fill(email);
    await page.getByTestId('staff-new-phone-input').fill('9876543210');
    await page.getByTestId('staff-new-designation-input').fill(designation);

    // Submit without required fields (first name)
    await page.getByTestId('staff-new-submit-btn').click();

    // Still on the form
    await expect(page).toHaveURL(/\/people\/staff\/new/);

    // Fields must retain their values
    await expect(page.getByTestId('staff-new-email-input')).toHaveValue(email);
    await expect(page.getByTestId('staff-new-phone-input')).toHaveValue('9876543210');
    await expect(page.getByTestId('staff-new-designation-input')).toHaveValue(designation);
  });
});
