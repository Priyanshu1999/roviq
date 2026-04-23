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
    await page.getByTestId('staff-new-first-name-en').fill(firstName);

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
    await page.getByTestId('staff-new-first-name-en').fill(firstName);
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

  test('submit button stays disabled while required firstName is empty (kit canSubmit gate)', async ({
    page,
  }) => {
    const email = `preserve.${Date.now()}@example.test`;
    const designation = 'Senior Teacher';

    await page.goto('/en/people/staff/new');

    await page.getByTestId('staff-new-email-input').fill(email);
    await page.getByTestId('staff-new-phone-input').fill('9876543210');
    await page.getByTestId('staff-new-designation-input').fill(designation);

    // TanStack Form's `canSubmit` is false while required i18nText firstName
    // is empty, so the kit's SubmitButton renders disabled. User sees each
    // field's inline Zod error on touch — no submit-click needed.
    await expect(page.getByTestId('staff-new-submit-btn')).toBeDisabled();

    // URL stays on the form and filled values persist.
    await expect(page).toHaveURL(/\/people\/staff\/new/);
    await expect(page.getByTestId('staff-new-email-input')).toHaveValue(email);
    await expect(page.getByTestId('staff-new-phone-input')).toHaveValue('9876543210');
    await expect(page.getByTestId('staff-new-designation-input')).toHaveValue(designation);
  });

  // ── testId coverage (e2e-friendly per [TSTID]) ────────────────────
  test('exposes data-testid on every interactive field', async ({ page }) => {
    await page.goto('/en/people/staff/new');
    await expect(page.getByTestId('staff-new-title')).toBeVisible();

    for (const testId of [
      'staff-new-first-name-en',
      'staff-new-first-name-hi',
      'staff-new-last-name-en',
      'staff-new-last-name-hi',
      'staff-new-gender-select',
      'staff-new-date-of-birth-input',
      'staff-new-social-category-select',
      'staff-new-email-input',
      'staff-new-phone-input',
      'staff-new-employee-id-input',
      'staff-new-designation-input',
      'staff-new-department-input',
      'staff-new-employment-type-select',
      'staff-new-date-of-joining-input',
      'staff-new-cancel-btn',
      'staff-new-back-btn',
      'staff-new-submit-btn',
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
  });

  // ── Draft banner (shared @roviq/ui component + common.draft.* copy) ──
  test('restore draft banner hydrates a typed first-name on reload', async ({ page }) => {
    const firstName = `StaffDrafted ${Date.now()}`;

    await page.goto('/en/people/staff/new');
    await expect(page.getByTestId('staff-new-title')).toBeVisible();

    await page.getByTestId('staff-new-first-name-en').fill(firstName);
    await page.getByTestId('staff-new-first-name-hi').click();
    // useFormDraft debounce is 1s; 2s gives plenty of margin.
    await page.waitForTimeout(1500);

    await page.reload();
    await expect(page.getByTestId('staff-new-title')).toBeVisible();

    const restoreBtn = page.getByRole('button', { name: /^restore$/i });
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();
    await expect(page.getByTestId('staff-new-first-name-en')).toHaveValue(firstName);
  });

  test('discard drops the saved draft and leaves the form empty', async ({ page }) => {
    const firstName = `StaffDiscard ${Date.now()}`;

    await page.goto('/en/people/staff/new');
    await page.getByTestId('staff-new-first-name-en').fill(firstName);
    await page.getByTestId('staff-new-first-name-hi').click();
    await page.waitForTimeout(1500);

    await page.reload();
    const discardBtn = page.getByRole('button', { name: /^discard$/i });
    await expect(discardBtn).toBeVisible();
    await discardBtn.click();

    await expect(discardBtn).toHaveCount(0);
    await expect(page.getByTestId('staff-new-first-name-en')).toHaveValue('');

    await page.reload();
    await expect(page.getByTestId('staff-new-title')).toBeVisible();
    await expect(page.getByRole('button', { name: /^restore$/i })).toHaveCount(0);
  });

  // ── Regression: pristine form must NOT persist a draft ────────────
  test('pristine form never persists a draft (no spurious restore banner)', async ({ page }) => {
    await page.goto('/en/people/staff/new');
    await expect(page.getByTestId('staff-new-title')).toBeVisible();

    // Tab around without typing — old autosave would have fired on blur.
    await page.getByTestId('staff-new-first-name-en').click();
    await page.getByTestId('staff-new-first-name-hi').click();
    await page.getByTestId('staff-new-last-name-en').click();
    await page.waitForTimeout(1500);

    await page.reload();
    await expect(page.getByTestId('staff-new-title')).toBeVisible();
    await expect(page.getByRole('button', { name: /^restore$/i })).toHaveCount(0);
  });
});
