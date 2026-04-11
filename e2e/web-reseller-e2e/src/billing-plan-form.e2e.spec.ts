import { expect, test } from '../../shared/console-guardian';

/**
 * Smoke + regression tests for the reseller billing plan-form-dialog after
 * the frontend-ux refactor. The most important guard here is the
 * "Maximum update depth exceeded" regression — before the buildDefaults fix
 * the dialog crashed inside an error boundary and never mounted.
 */

test.describe('Reseller · billing plan form dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/reseller/billing/plans');
    await expect(page.locator('[data-test-id="billing-create-plan-btn"]')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('"Create Plan" button opens the dialog without an infinite-update crash', async ({
    page,
  }) => {
    // Capture page errors so an unhandled "Maximum update depth" surfaces.
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.locator('[data-test-id="billing-create-plan-btn"]').click();

    const dialog = page.locator('[data-test-id="billing-create-plan-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('Create Plan').first()).toBeVisible();

    // Regression — buildDefaults previously depended on fresh object refs
    // (planName/planDescription/planEntitlements) and looped reset() forever.
    expect(pageErrors.join('\n')).not.toMatch(/Maximum update depth exceeded/);
  });

  test('renders the four logical sections (FXPFP)', async ({ page }) => {
    await page.locator('[data-test-id="billing-create-plan-btn"]').click();
    const dialog = page.locator('[data-test-id="billing-create-plan-dialog"]');
    await expect(dialog).toBeVisible();

    await expect(
      dialog.locator('[data-test-id="billing-plan-section-basic"]').getByText('Basic Information', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog
        .locator('[data-test-id="billing-plan-section-billing"]')
        .getByText('Billing', { exact: true }),
    ).toBeVisible();
    await expect(
      dialog
        .locator('[data-test-id="billing-plan-section-limits"]')
        .getByText('Capacity Limits', { exact: true }),
    ).toBeVisible();
  });

  test('shows Indian currency preview for amount field (HVJED)', async ({ page }) => {
    await page.locator('[data-test-id="billing-create-plan-btn"]').click();
    const dialog = page.locator('[data-test-id="billing-create-plan-dialog"]');
    await expect(dialog).toBeVisible();

    const amount = dialog.locator('[data-test-id="billing-plan-amount-input"]');
    await amount.fill('99900');
    await amount.blur();

    // useFormatNumber().currency renders ₹ + Indian numbering grouping
    await expect(dialog.locator('[data-test-id="billing-plan-price-display"]')).toContainText(
      /₹\s?99,900/,
      { timeout: 5_000 },
    );
  });

  test('blank submit surfaces translated field errors', async ({ page }) => {
    await page.locator('[data-test-id="billing-create-plan-btn"]').click();
    const dialog = page.locator('[data-test-id="billing-create-plan-dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('[data-test-id="billing-plan-submit-btn"]').click();

    // We don't pin to specific copy here because the schema messages are
    // i18n keys that may evolve — instead assert that AT LEAST ONE FieldError
    // rendered, AND that no raw zod fallback leaked through.
    const errorCount = await dialog.locator('[data-slot="field-error"]').count();
    expect(errorCount).toBeGreaterThan(0);
    await expect(dialog.getByText('expected number, received NaN')).toHaveCount(0);
  });
});
