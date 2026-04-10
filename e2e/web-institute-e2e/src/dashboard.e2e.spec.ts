import { expect, test } from '../../shared/console-guardian';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('shows welcome card with setup instructions', async ({ page }) => {
    await expect(page.locator('[data-test-id="dashboard-welcome-card"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-test-id="dashboard-get-started"]')).toBeVisible();
  });

  test('Get Started section shows 3 CTAs', async ({ page }) => {
    const getStarted = page.locator('[data-test-id="dashboard-get-started"]');
    await expect(getStarted).toBeVisible({ timeout: 10_000 });
    await expect(getStarted.getByText(/students/i).first()).toBeVisible();
    await expect(getStarted.getByText(/teachers/i).first()).toBeVisible();
    await expect(getStarted.getByText(/standards/i).first()).toBeVisible();
  });

  test('Quick Links section shows 4 links', async ({ page }) => {
    const quickLinksSection = page.locator('[data-test-id="dashboard-quick-links"]');
    await expect(quickLinksSection).toBeVisible({ timeout: 10_000 });

    await expect(quickLinksSection.getByRole('link', { name: /standards/i })).toBeVisible();
    await expect(quickLinksSection.getByRole('link', { name: /subjects/i })).toBeVisible();
    await expect(quickLinksSection.getByRole('link', { name: /users/i })).toBeVisible();
    await expect(quickLinksSection.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('quick links navigate to correct pages', async ({ page }) => {
    const quickLinksSection = page.locator('[data-test-id="dashboard-quick-links"]');
    await quickLinksSection
      .getByRole('link', { name: /standards/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/academics/, { timeout: 10_000 });

    await page.goto('/en/dashboard');
    await page.waitForLoadState('networkidle');

    const quickLinksSectionAgain = page.locator('[data-test-id="dashboard-quick-links"]');
    await quickLinksSectionAgain
      .getByRole('link', { name: /settings/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });
  });
});
