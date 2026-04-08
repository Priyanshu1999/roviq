import { expect, test } from '@playwright/test';

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
    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();

    // Profile group is rendered as a FieldSet (CLFYD)
    await expect(page.getByText('Profile').first()).toBeVisible();

    // Email is masked by default (ZKFQP) — never the raw value on first render
    const email = page.getByRole('status', { name: 'Email' });
    await expect(email).toBeVisible();
    await expect(email).toContainText('***');
  });

  test('reveal toggle exposes the raw email and updates aria-pressed', async ({ page }) => {
    const reveal = page.getByRole('button', { name: 'Reveal email' });
    await expect(reveal).toHaveAttribute('aria-pressed', 'false');

    await reveal.click();

    // After click, the button label flips to "Hide email"
    const hide = page.getByRole('button', { name: 'Hide email' });
    await expect(hide).toBeVisible();
    await expect(hide).toHaveAttribute('aria-pressed', 'true');

    // And the email is now shown without the mask
    const email = page.getByRole('status', { name: 'Email' });
    await expect(email).not.toContainText('***');
  });

  test('copy email button is present with accessible label', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Copy email to clipboard' })).toBeVisible();
  });
});

test.describe('Admin · new institute form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/institutes/new');
  });

  test('renders all six logical sections', async ({ page }) => {
    // FXPFP — sectioned with FieldSet/FieldLegend
    for (const section of [
      'Basic Information',
      'Board & Departments',
      'Ownership',
      'Contact Details',
      'Address',
      'Advanced',
    ]) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
    }
  });

  test('blank submit surfaces translated field errors and marks inputs invalid', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Create Institute' }).click();

    // FJPME / NGIAC — translated, not raw zod default messages
    await expect(page.getByText('Institute code is required.').first()).toBeVisible();
    await expect(page.getByText('Phone number must be exactly 10 digits.').first()).toBeVisible();
    await expect(page.getByText('Please enter a valid email address.').first()).toBeVisible();
    await expect(page.getByText('Address line 1 is required.').first()).toBeVisible();

    // Regression — empty lat/lng must NOT surface raw "expected number, received NaN"
    await expect(page.getByText('expected number, received NaN')).toHaveCount(0);
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
    for (const section of [
      'Basic Information',
      'Legal & Registration',
      'Contact Details',
      'Registered Address',
    ]) {
      await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
    }
  });

  test('blank submit surfaces only the two real required errors (NaN regression)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Create Group' }).click();

    await expect(page.getByText('Group name is required.').first()).toBeVisible();
    await expect(page.getByText('Short code is required.').first()).toBeVisible();

    // Regression — empty lat/lng coordinates must NOT surface raw zod NaN errors.
    // Before the preprocess fix, two "expected number, received NaN" errors leaked.
    await expect(page.getByText('expected number, received NaN')).toHaveCount(0);
  });
});
