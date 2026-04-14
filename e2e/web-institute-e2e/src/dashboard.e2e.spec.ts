import { expect, test } from '../../shared/console-guardian';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('shows welcome card with setup instructions', async ({ page }) => {
    await expect(page.getByTestId('dashboard-get-started')).toBeVisible();
  });

  test('Get Started section shows 3 CTAs', async ({ page }) => {
    const getStarted = page.getByTestId('dashboard-get-started');
    await expect(getStarted).toBeVisible();
    await expect(getStarted.getByText(/students/i).first()).toBeVisible();
    await expect(getStarted.getByText(/teachers/i).first()).toBeVisible();
    await expect(getStarted.getByText(/standards/i).first()).toBeVisible();
  });

  test('Quick Links section shows 4 links', async ({ page }) => {
    await expect(page.getByTestId('dashboard-quick-links')).toBeVisible();

    await expect(page.getByTestId('dashboard-quick-link-standards')).toBeVisible();
    await expect(page.getByTestId('dashboard-quick-link-subjects')).toBeVisible();
    await expect(page.getByTestId('dashboard-quick-link-users')).toBeVisible();
    await expect(page.getByTestId('dashboard-quick-link-settings')).toBeVisible();
  });

  test('quick links navigate to correct pages', async ({ page }) => {
    await page.getByTestId('dashboard-quick-link-standards').click();
    await expect(page).toHaveURL(/\/academics/, { timeout: 10_000 });

    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId('dashboard-quick-link-settings').click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });
  });
});
