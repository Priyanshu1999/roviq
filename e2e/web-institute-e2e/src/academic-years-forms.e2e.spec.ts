import { expect, test } from '@playwright/test';

/**
 * Smoke + regression tests for the academic-years create dialog and the
 * institute settings address-form, after the frontend-ux refactor.
 */

test.describe('Create academic year dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/academic-years');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /new academic year/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('dialog opens with the expected fields and labels (CLFYD/DNMPQ)', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Academic Year Label')).toBeVisible();
    await expect(dialog.getByText('Session Start Date')).toBeVisible();
    await expect(dialog.getByText('Session End Date')).toBeVisible();
    await expect(dialog.getByText('Term Structure')).toBeVisible();

    // FVOLK — explicit submit text, not generic "Submit"
    await expect(dialog.getByRole('button', { name: 'Create Academic Year' })).toBeVisible();
  });

  test('blank submit shows three translated field errors', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Create Academic Year' }).click();

    await expect(
      dialog.getByText('Please enter a label for this academic year.'),
    ).toBeVisible();
    await expect(dialog.getByText('Please select a start date.')).toBeVisible();
    await expect(dialog.getByText('Please select an end date.')).toBeVisible();
  });

  test('label input uses the Indian academic-year placeholder format', async ({ page }) => {
    // GYATP — placeholder mirrors the YYYY–YY Indian format
    const labelInput = page.getByPlaceholder(/20\d{2}.{1,3}\d{2}/);
    await expect(labelInput).toBeVisible();
  });
});

test.describe('Institute settings · address form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/settings/institute');
    await page.waitForLoadState('networkidle');
  });

  test('address section renders with PIN code and state combobox', async ({ page }) => {
    // The institute info tab is active by default. Address fields are inside it.
    const pin = page.locator('#address-postal-code');
    await expect(pin).toBeVisible({ timeout: 15_000 });
    await expect(pin).toHaveAttribute('maxlength', '6');

    // GGPVY — state is a combobox (cmdk), not a plain select
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });

  test('PIN 122001 auto-fills city/district (HBCFO)', async ({ page }) => {
    const pin = page.locator('#address-postal-code');
    await expect(pin).toBeVisible({ timeout: 15_000 });
    await pin.fill('122001');
    await pin.blur();

    await expect(page.locator('#address-city')).not.toHaveValue('', { timeout: 8_000 });
    await expect(page.locator('#address-district')).not.toHaveValue('', { timeout: 8_000 });
  });
});
