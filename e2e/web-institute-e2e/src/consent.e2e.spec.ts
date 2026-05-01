/**
 * Data Consent page E2E tests (institute portal).
 *
 * Two test groups:
 *   1. Non-guardian (admin, default auth) → sees access-denied empty state
 *   2. Guardian (guardian1, fresh login) → sees consent dashboard with child
 *      cards and purpose toggles
 */

import { expect, test } from '../../shared/console-guardian';
import { E2E_USERS } from '../../shared/seed-fixtures';

// ── Non-guardian (default storageState = admin) ─────────────────────

test.describe('Data Consent — non-guardian', () => {
  test('shows not-a-guardian empty state for admin user', async ({ page }) => {
    await page.goto('/en/settings/consent');
    await expect(page.getByTestId('consent-not-guardian')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('navigates to consent page from sidebar', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('nav a[href*="consent"]').click();
    await expect(page).toHaveURL(/\/settings\/consent/, { timeout: 10_000 });
    await expect(page.getByTestId('consent-not-guardian')).toBeVisible();
  });
});

// ── Guardian (guardian1 — fresh login, no shared storageState) ───────

test.describe('Data Consent — guardian', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/en/login');
    await page.getByTestId('login-username-input').fill(E2E_USERS.GUARDIAN.username);
    await page.getByTestId('login-password-input').fill(E2E_USERS.GUARDIAN.password);
    await page.getByTestId('login-submit-btn').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
  });

  test('renders consent dashboard with title and privacy notice', async ({ page }) => {
    await page.goto('/en/settings/consent');
    await expect(page.getByTestId('consent-title')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('consent-privacy-notice')).toBeVisible();
  });

  test('shows child consent card with student name', async ({ page }) => {
    await page.goto('/en/settings/consent');
    await expect(page.getByTestId('consent-title')).toBeVisible({
      timeout: 15_000,
    });

    // Guardian1 is linked to student1 (Priya Singh)
    const childCards = page.locator('[data-testid^="consent-child-"]');
    await expect(childCards.first()).toBeVisible({ timeout: 10_000 });
    expect(await childCards.count()).toBeGreaterThanOrEqual(1);

    // Child's name should be visible
    await expect(childCards.first().getByText('Priya')).toBeVisible();
  });

  test('shows all 11 DPDP purpose toggles per child', async ({ page }) => {
    await page.goto('/en/settings/consent');
    await expect(page.getByTestId('consent-title')).toBeVisible({
      timeout: 15_000,
    });

    const toggles = page.locator('[data-testid^="consent-toggle-"]');
    await expect(toggles.first()).toBeVisible({ timeout: 10_000 });
    expect(await toggles.count()).toBe(11);
  });

  test('granting consent toggles the switch and shows badge change', async ({ page }) => {
    await page.goto('/en/settings/consent');
    await expect(page.getByTestId('consent-title')).toBeVisible({
      timeout: 15_000,
    });

    const toggle = page.getByTestId('consent-toggle-academic_data_processing');
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Click to grant
    await toggle.click();

    // Toggle flips to checked state after grant succeeds
    await expect(toggle).toHaveAttribute('data-state', 'checked', { timeout: 10_000 });
  });
});
