/**
 * Mobile viewport tests — 360 × 800 (entry-level Android phone, India market).
 *
 * These tests run in the `mobile` Playwright project (see e2e/playwright.config.ts)
 * which overrides viewport to { width: 360, height: 800 }. They verify:
 *   - No horizontal page overflow (body scrollWidth ≤ clientWidth + 5px tolerance)
 *   - Data tables scroll INSIDE their container; the page body itself does not scroll
 *   - Key interactive controls (language switcher, navigation) remain reachable
 *
 * Authentication: unauthenticated describe blocks test public pages (login).
 * Authenticated blocks opt-in via test.use({ storageState }) so the login test
 * doesn't need a pre-existing session.
 */
import * as path from 'node:path';
import { expect, test } from '../../shared/console-guardian';

const INSTITUTE_AUTH = path.join(__dirname, '../../playwright/.auth/institute.json');

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Returns true when the page body has no horizontal scroll (within a 5px tolerance
 * to account for sub-pixel rounding differences across platforms).
 */
async function hasNoHorizontalScroll(
  page: Parameters<typeof expect>[0] extends never ? never : import('@playwright/test').Page,
): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth <= el.clientWidth + 5;
  });
}

// ── Login page (unauthenticated) ──────────────────────────────────────────────
// The chromium project sets storageState at the project level, which would
// redirect an authenticated user away from /en/login. Override to no session.

test.describe('Mobile — login page (360px)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login form renders without horizontal overflow', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByTestId('login-title')).toBeVisible({ timeout: 10_000 });

    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });

  test('login form fields and submit button are reachable within viewport', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByTestId('login-title')).toBeVisible({ timeout: 10_000 });

    // All critical form controls must be within the visible viewport
    await expect(page.getByTestId('login-username-input')).toBeInViewport();
    await expect(page.getByTestId('login-password-input')).toBeInViewport();
    await expect(page.getByTestId('login-submit-btn')).toBeInViewport();
  });
});

// ── Authenticated pages ───────────────────────────────────────────────────────

test.describe('Mobile — authenticated pages (360px)', () => {
  test.use({ storageState: INSTITUTE_AUTH });

  test('dashboard renders without horizontal overflow', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 10_000 });

    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });

  test('students list table — body does not scroll horizontally, table may', async ({ page }) => {
    await page.goto('/en/people/students');
    await expect(page.getByTestId('students-title')).toBeVisible({ timeout: 10_000 });

    // The page body must NOT overflow horizontally — any horizontal scroll should
    // be scoped to the table's own overflow container
    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });

  test('academics/standards list renders without horizontal overflow', async ({ page }) => {
    await page.goto('/en/academics');
    await expect(page.getByTestId('academics-title')).toBeVisible({ timeout: 10_000 });

    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });

  test('language switcher is reachable within viewport', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId('locale-switcher')).toBeInViewport();
  });

  test('Hindi locale renders dashboard without horizontal overflow', async ({ page }) => {
    await page.goto('/hi/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 10_000 });

    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });
});
