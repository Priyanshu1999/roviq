import { expect, test } from '../../shared/console-guardian';

/**
 * Smoke + regression tests for the forms refactored to comply with
 * `.claude/rules/frontend-ux.md`. Each test is intentionally narrow and
 * verifies one observable behavior so failures point at a specific gap.
 */

test.describe('Admin account page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/account');
  });

  test('renders profile section with masked email by default', async ({ page }) => {
    await expect(page.getByTestId('account-title')).toBeVisible();

    // Profile group is rendered as a FieldSet (CLFYD)
    await expect(page.getByTestId('account-profile-fieldset')).toBeVisible();

    // Email is masked by default (ZKFQP) — never the raw value on first render
    const email = page.getByTestId('account-email-value');
    await expect(email).toBeVisible();
    await expect(email).toContainText('***');
  });

  test('reveal toggle exposes the raw email and updates aria-pressed', async ({ page }) => {
    const reveal = page.getByTestId('account-email-reveal-btn');
    await expect(reveal).toHaveAttribute('aria-pressed', 'false');

    await reveal.click();

    // After click, aria-pressed flips to true
    await expect(reveal).toHaveAttribute('aria-pressed', 'true');

    // And the email is now shown without the mask
    const email = page.getByTestId('account-email-value');
    await expect(email).not.toContainText('***');
  });

  test('copy email button is present with accessible label', async ({ page }) => {
    await expect(page.getByTestId('account-email-copy-btn')).toBeVisible();
  });
});

test.describe('Admin · new institute form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/institutes/new');
  });

  test('renders all six logical sections', async ({ page }) => {
    // FXPFP — sectioned with FieldSet/FieldLegend
    await expect(page.getByTestId('institute-form-section-basic')).toBeVisible();
    await expect(page.getByTestId('institute-form-section-board')).toBeVisible();
    await expect(page.getByTestId('institute-form-section-ownership')).toBeVisible();
    await expect(page.getByTestId('institute-form-section-contact')).toBeVisible();
    await expect(page.getByTestId('institute-form-section-address')).toBeVisible();
    await expect(page.getByTestId('institute-form-section-advanced')).toBeVisible();
  });

  test('blank submit surfaces translated field errors and marks inputs invalid', async ({
    page,
  }) => {
    await page.getByTestId('create-institute-submit-btn').click();

    // FJPME / NGIAC — translated, not raw zod default messages
    // At least one field-error should surface after blank submit
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();

    // Regression — empty lat/lng must NOT surface raw "expected number, received NaN"
    await expect(
      page
        .locator('[data-slot="field-error"]')
        .filter({ hasText: 'expected number, received NaN' }),
    ).toHaveCount(0);
  });

  test('filled fields survive validation errors', async ({ page }) => {
    const code = `TST${Date.now()}`;
    const phone = '9876543210';

    const codeInput = page.getByTestId('admin-institute-new-code-input');
    const phoneInput = page.getByTestId('admin-institute-new-phone-0-input');

    // Wait for the submit button to settle into its pristine enabled state
    // (form.canSubmit is true before any onChange fires). Under heavy parallel
    // load the form's lazy data fetches can briefly disable the button.
    const submit = page.getByTestId('create-institute-submit-btn');
    await expect(submit).toBeEnabled({ timeout: 10_000 });

    // Click submit on the blank form first to mark all required fields touched
    // and surface their errors.
    await submit.click();
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();

    // Now fill two fields and blur the phone so `formatIndianMobile` runs.
    await codeInput.fill(code);
    await phoneInput.fill(phone);
    await phoneInput.blur();

    // Filled fields keep their values across the validation pass; errors remain.
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();
    await expect(codeInput).toHaveValue(code);
    await expect(phoneInput).toHaveValue('98765 43210');
  });

  test('PIN code 122001 auto-fills city and district (HBCFO)', async ({ page }) => {
    const pin = page.getByTestId('admin-institute-new-postal-code-input');
    await pin.fill('122001');
    await pin.blur();

    // The lookup hits a public API; allow up to 8s
    await expect(page.getByTestId('admin-institute-new-city-input')).not.toHaveValue('', {
      timeout: 8_000,
    });
    await expect(page.getByTestId('admin-institute-new-district-input')).not.toHaveValue('', {
      timeout: 8_000,
    });
  });
});

test.describe('Admin · new institute group form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/institute-groups/new');
  });

  test('renders all four logical sections', async ({ page }) => {
    await expect(page.getByTestId('institute-group-form-section-basic')).toBeVisible();
    await expect(page.getByTestId('institute-group-form-section-registration')).toBeVisible();
    await expect(page.getByTestId('institute-group-form-section-contact')).toBeVisible();
    await expect(page.getByTestId('institute-group-form-section-address')).toBeVisible();
  });

  test('blank submit surfaces only the two real required errors (NaN regression)', async ({
    page,
  }) => {
    await page.getByTestId('institute-group-create-submit-btn').click();

    // At least one field-error should surface after blank submit (name + code required)
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();

    // Regression — empty lat/lng coordinates must NOT surface raw zod NaN errors.
    // Before the preprocess fix, two "expected number, received NaN" errors leaked.
    await expect(
      page
        .locator('[data-slot="field-error"]')
        .filter({ hasText: 'expected number, received NaN' }),
    ).toHaveCount(0);
  });

  test('filled fields survive validation errors', async ({ page }) => {
    const regNo = `REG${Date.now()}`;
    const regNoInput = page.getByTestId('institute-group-registration-number-input');

    // Wait for the submit button to settle into its pristine enabled state.
    const submit = page.getByTestId('institute-group-create-submit-btn');
    await expect(submit).toBeEnabled({ timeout: 10_000 });

    // Click submit on the blank form first to surface required-field errors.
    await submit.click();
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();

    await regNoInput.fill(regNo);

    // Filled field keeps its value across the validation pass; errors remain.
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();
    await expect(regNoInput).toHaveValue(regNo);
  });
});
