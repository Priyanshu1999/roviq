import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function loginAsAdmin(page: Page) {
  await page.goto('/en/login');
  await page.getByPlaceholder('Enter your Roviq ID').fill('admin');
  await page.getByPlaceholder('Enter your password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/select-institute/, { timeout: 15_000 });
  await page.getByRole('button', { name: /Saraswati Vidya Mandir/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Settings - Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/en/settings/sessions');
    await page.waitForLoadState('networkidle');
  });

  test('sessions page loads', async ({ page }) => {
    await expect(page.getByText(/session/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('sessions list shows at least one entry', async ({ page }) => {
    // After logging in, there should be at least one active session
    const sessionEntries = page
      .locator('table tbody tr')
      .or(page.locator('[data-testid*="session"], .session-item, [class*="session"]'));

    await expect(sessionEntries.first()).toBeVisible({ timeout: 10_000 });
    const count = await sessionEntries.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('each session shows user agent and IP', async ({ page }) => {
    // Wait for session data to load
    await page.waitForLoadState('networkidle');

    // Sessions should display browser/user-agent info
    const userAgentText = page
      .getByText(/chrome|firefox|safari|edge|playwright/i)
      .or(page.getByText(/headless/i));
    await expect(userAgentText.first()).toBeVisible({ timeout: 10_000 });

    // Sessions should display IP address (localhost in test: 127.0.0.1 or ::1)
    const ipText = page
      .getByText(/127\.0\.0\.1/)
      .or(page.getByText(/::1/))
      .or(page.getByText(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/));
    await expect(ipText.first()).toBeVisible({ timeout: 10_000 });
  });
});
