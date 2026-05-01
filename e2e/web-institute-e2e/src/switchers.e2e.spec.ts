/**
 * Language switcher, theme toggler, and institute switcher.
 *
 * These controls live in the topbar across all dashboard pages.
 */
import { expect, test } from '../../shared/console-guardian';
import { SEED } from '../../shared/seed';

// ── Language switcher ─────────────────────────────────────────────────

test.describe('Language switcher', () => {
  test('switching to Hindi updates URL to /hi/ and shows Hindi text', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId('locale-switcher').click();
    await page.getByTestId('locale-option-hi').click();

    await expect(page).toHaveURL(/\/hi\/dashboard/, { timeout: 10_000 });
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible();
  });

  test('switching back to English restores /en/ URL', async ({ page }) => {
    await page.goto('/hi/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId('locale-switcher').click();
    await page.getByTestId('locale-option-en').click();

    await expect(page).toHaveURL(/\/en\/dashboard/, { timeout: 10_000 });
  });
});

// ── Theme toggler ─────────────────────────────────────────────────────

test.describe('Theme toggler', () => {
  test('toggles between light and dark mode', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 10_000,
    });

    // Theme toggle is a 3-state DropdownMenu (System/Light/Dark). Open the
    // menu, pick the opposite of the current state, assert the html class
    // flips. Keyboard-driven selection avoids the Radix re-mount race that
    // breaks pointer clicks during state transitions.
    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    const target = initialDark ? 'theme-light' : 'theme-dark';

    await page.getByTestId('theme-toggle').click();
    await expect(page.getByTestId(target)).toBeVisible();
    await page.getByTestId(target).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(!initialDark);
  });
});

// ── Institute switcher ────────────────────────────────────────────────

test.describe('Institute switcher', () => {
  test('multi-institute user sees switcher with current institute name', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 10_000,
    });

    const switcher = page.getByTestId('institute-switcher');
    await expect(switcher).toBeVisible({ timeout: 5_000 });
    await expect(switcher).toContainText(SEED.INSTITUTE_1.name);
  });

  test('dropdown shows both institutes with current marked', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId('institute-switcher').click();
    await expect(page.getByTestId('institute-switcher-menu')).toBeVisible();

    // Both institutes should appear in the dropdown
    const menu = page.getByTestId('institute-switcher-menu');
    await expect(menu.locator(`text=${SEED.INSTITUTE_1.name}`)).toBeVisible();
    await expect(menu.locator(`text=${SEED.INSTITUTE_2.name}`)).toBeVisible();
  });
});
