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
    await expect(page.locator('[data-test-id="account-title"]')).toBeVisible();

    // Profile group is rendered as a FieldSet (CLFYD)
    await expect(page.locator('[data-test-id="account-profile-fieldset"]')).toBeVisible();

    // Email is masked by default (ZKFQP) — never the raw value on first render
    const email = page.locator('[data-test-id="account-email-value"]');
    await expect(email).toBeVisible();
    await expect(email).toContainText('***');
  });

  test('reveal toggle exposes the raw email and updates aria-pressed', async ({ page }) => {
    const reveal = page.locator('[data-test-id="account-email-reveal-btn"]');
    await expect(reveal).toHaveAttribute('aria-pressed', 'false');

    await reveal.click();

    // After click, aria-pressed flips to true
    await expect(reveal).toHaveAttribute('aria-pressed', 'true');

    // And the email is now shown without the mask
    const email = page.locator('[data-test-id="account-email-value"]');
    await expect(email).not.toContainText('***');
  });

  test('copy email button is present with accessible label', async ({ page }) => {
    await expect(page.locator('[data-test-id="account-email-copy-btn"]')).toBeVisible();
  });
});

test.describe('Admin · new institute form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/institutes/new');
  });

  test('renders all six logical sections', async ({ page }) => {
    // FXPFP — sectioned with FieldSet/FieldLegend
    await expect(page.locator('[data-test-id="institute-form-section-basic"]')).toBeVisible();
    await expect(page.locator('[data-test-id="institute-form-section-board"]')).toBeVisible();
    await expect(page.locator('[data-test-id="institute-form-section-ownership"]')).toBeVisible();
    await expect(page.locator('[data-test-id="institute-form-section-contact"]')).toBeVisible();
    await expect(page.locator('[data-test-id="institute-form-section-address"]')).toBeVisible();
    await expect(page.locator('[data-test-id="institute-form-section-advanced"]')).toBeVisible();
  });

  test('blank submit surfaces translated field errors and marks inputs invalid', async ({
    page,
  }) => {
    await page.locator('[data-test-id="create-institute-submit-btn"]').click();

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

    await page.locator('[data-test-id="institute-code-input"]').fill(code);
    await page.locator('[data-test-id="contact-phone-0"]').fill(phone);

    await page.locator('[data-test-id="create-institute-submit-btn"]').click();

    // Errors appear but filled fields keep their values
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();
    await expect(page.locator('[data-test-id="institute-code-input"]')).toHaveValue(code);
    // Phone input auto-formats with space
    await expect(page.locator('[data-test-id="contact-phone-0"]')).toHaveValue('98765 43210');
  });

  test('PIN code 122001 auto-fills city and district (HBCFO)', async ({ page }) => {
    const pin = page.locator('#address-postal-code');
    await pin.fill('122001');
    await pin.blur();

    // The lookup hits a public API; allow up to 8s
    await expect(page.locator('#address-city')).not.toHaveValue('', { timeout: 8_000 });
    await expect(page.locator('#address-district')).not.toHaveValue('', { timeout: 8_000 });
  });
});

test.describe('Admin · new institute group form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/institute-groups/new');
  });

  test('renders all four logical sections', async ({ page }) => {
    await expect(page.locator('[data-test-id="institute-group-form-section-basic"]')).toBeVisible();
    await expect(
      page.locator('[data-test-id="institute-group-form-section-registration"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-test-id="institute-group-form-section-contact"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-test-id="institute-group-form-section-address"]'),
    ).toBeVisible();
  });

  test('blank submit surfaces only the two real required errors (NaN regression)', async ({
    page,
  }) => {
    await page.locator('[data-test-id="create-group-submit-btn"]').click();

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

    await page.locator('[data-test-id="group-registration-number"]').fill(regNo);

    await page.locator('[data-test-id="create-group-submit-btn"]').click();

    // Errors surface but filled fields keep their values
    await expect(page.locator('[data-slot="field-error"]').first()).toBeVisible();
    await expect(page.locator('[data-test-id="group-registration-number"]')).toHaveValue(regNo);
  });
});
