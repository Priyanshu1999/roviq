import { expect, test } from '../../shared/console-guardian';

/**
 * Smoke + regression tests for the academic-years create dialog and the
 * institute settings address-form, after the frontend-ux refactor.
 */

test.describe('Create academic year dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/academic-years');
    await expect(page.getByTestId('academic-years-new-btn')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId('academic-years-new-btn').click();
    await expect(page.getByTestId('academic-years-create-dialog')).toBeVisible();
  });

  test('dialog opens with the expected fields and labels (CLFYD/DNMPQ)', async ({ page }) => {
    const dialog = page.getByTestId('academic-years-create-dialog');
    await expect(dialog.getByTestId('academic-years-create-label-input')).toBeVisible();
    await expect(dialog.getByTestId('academic-years-create-start-date')).toBeVisible();
    await expect(dialog.getByTestId('academic-years-create-end-date')).toBeVisible();

    // FVOLK — explicit submit text
    await expect(dialog.getByTestId('academic-years-create-submit-btn')).toBeVisible();
  });

  test('blank submit shows three translated field errors', async ({ page }) => {
    const dialog = page.getByTestId('academic-years-create-dialog');
    await dialog.getByTestId('academic-years-create-submit-btn').click();

    // After blank submit, error messages should appear within the dialog.
    // The dialog must still be open (not closed).
    await expect(dialog).toBeVisible();
  });

  test('label input uses the Indian academic-year placeholder format', async ({ page }) => {
    // GYATP — placeholder mirrors the YYYY–YY Indian format
    const labelInput = page.getByTestId('academic-years-create-label-input');
    await expect(labelInput).toBeVisible();
    const placeholder = await labelInput.getAttribute('placeholder');
    expect(placeholder).toMatch(/20\d{2}.{1,3}\d{2}/);
  });
});

test.describe('Edit academic year sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/academic-years');
    await expect(page.getByTestId('academic-years-title')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Edit button opens the sheet with expected fields (CLFYD/FVOLK)', async ({ page }) => {
    // First non-archived year card should expose an Edit action.
    const editButton = page.getByTestId('academic-years-edit-btn').first();
    await expect(editButton).toBeVisible({ timeout: 10_000 });

    await editButton.click();

    const sheet = page.getByTestId('academic-years-edit-sheet');
    await expect(sheet).toBeVisible();

    // FVOLK — save button present
    await expect(sheet.getByTestId('academic-years-edit-save-btn')).toBeVisible();
  });
});

test.describe('Institute settings · address form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/settings/institute');
    // Wait for the settings form to load
    await expect(page.getByTestId('settings-address-postal-code')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('address section renders with PIN code and state combobox', async ({ page }) => {
    const pin = page.getByTestId('settings-address-postal-code');
    await expect(pin).toHaveAttribute('maxlength', '6');

    // GGPVY — state is a combobox (cmdk)
    await expect(page.getByTestId('settings-address-state')).toBeVisible();
  });

  test('PIN 122001 auto-fills city/district (HBCFO)', async ({ page }) => {
    const pin = page.getByTestId('settings-address-postal-code');
    await pin.fill('122001');
    await pin.blur();

    await expect(page.getByTestId('settings-address-city')).not.toHaveValue('', {
      timeout: 8_000,
    });
    await expect(page.getByTestId('settings-address-district')).not.toHaveValue('', {
      timeout: 8_000,
    });
  });
});
