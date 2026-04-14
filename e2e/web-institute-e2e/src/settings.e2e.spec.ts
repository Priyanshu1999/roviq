import { expect, test } from '../../shared/console-guardian';

test.describe('Settings - Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/settings/sessions');
    await expect(page.getByTestId('sessions-title')).toBeVisible({ timeout: 15_000 });
  });

  test('sessions page loads', async ({ page }) => {
    await expect(page.getByTestId('sessions-title')).toBeVisible();
  });

  test('sessions list shows at least one entry', async ({ page }) => {
    // After logging in, there should be at least one active session
    const sessionEntries = page.getByTestId('session-item');

    await expect(sessionEntries.first()).toBeVisible({ timeout: 10_000 });
    const count = await sessionEntries.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('each session shows user agent and IP', async ({ page }) => {
    // Sessions should display browser/user-agent info
    const userAgent = page.getByTestId('session-user-agent').first();
    await expect(userAgent).toBeVisible({ timeout: 10_000 });

    // Sessions should display IP address (localhost in test: 127.0.0.1 or ::1)
    const ipAddress = page.getByTestId('session-ip-address').first();
    await expect(ipAddress).toBeVisible({ timeout: 10_000 });
  });
});
