/**
 * My Profile page E2E tests (institute portal).
 *
 * Default auth uses the institute admin (admin/admin123). Tests verify:
 *   - Page renders with title, personal details, editable form, role section
 *   - Personal details show seeded admin user data (read-only)
 *   - Phone validation rejects invalid input
 *   - Saving valid phone succeeds with toast
 *   - Navigation from sidebar works
 */

import { expect, test } from '../../shared/console-guardian';

test.describe('My Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/profile');
    await expect(page.getByTestId('profile-title')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('renders page title and description', async ({ page }) => {
    await expect(page.getByTestId('profile-title')).toHaveText(/my profile/i);
  });

  test('shows personal details card with seeded user data', async ({ page }) => {
    const personal = page.getByTestId('profile-personal-section');
    await expect(personal).toBeVisible();

    // E2E default auth = admin user with firstName: "Admin", lastName: "Roviq", gender: "MALE"
    await expect(personal.getByText('Admin', { exact: true })).toBeVisible();
    await expect(personal.getByText('Roviq', { exact: true })).toBeVisible();
    await expect(personal.getByText('MALE', { exact: true })).toBeVisible();
  });

  test('shows editable details card with phone and image URL inputs', async ({ page }) => {
    const editable = page.getByTestId('profile-editable-section');
    await expect(editable).toBeVisible();
    await expect(page.getByTestId('profile-phone-input')).toBeVisible();
    await expect(page.getByTestId('profile-image-url-input')).toBeVisible();
    await expect(page.getByTestId('profile-save-btn')).toBeEnabled();
  });

  test('rejects invalid phone number and shows error', async ({ page }) => {
    const phoneInput = page.getByTestId('profile-phone-input');
    await phoneInput.fill('1234');
    await page.getByTestId('profile-save-btn').click();

    // Phone field should display invalid state (react-hook-form sets data-invalid on the Field)
    const phoneField = page
      .getByTestId('profile-editable-section')
      .locator('[data-invalid="true"]')
      .first();
    await expect(phoneField).toBeVisible({ timeout: 5_000 });
  });

  test('saves profile with valid phone and shows success toast', async ({ page }, testInfo) => {
    // Unique phone per worker + test run to avoid the global unique (country_code, number)
    // constraint on phone_numbers when multiple workers run this test in parallel.
    const suffix = String(testInfo.workerIndex).padStart(2, '0');
    const uniquePhone = `98765432${suffix}`;

    const phoneInput = page.getByTestId('profile-phone-input');
    await phoneInput.fill(uniquePhone);
    await page.getByTestId('profile-save-btn').click();

    // Success toast: profile.saved = "Profile updated"
    await expect(page.getByText('Profile updated').first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to profile page from sidebar', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('nav a[href*="/profile"]').first().click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 10_000 });
    await expect(page.getByTestId('profile-title')).toBeVisible();
  });
});
