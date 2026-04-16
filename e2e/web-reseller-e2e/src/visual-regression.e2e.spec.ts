import { expect, test } from '../../shared/console-guardian';

/**
 * Visual regression baselines for the reseller portal.
 * See admin portal spec for baseline-update workflow.
 */
test.use({ checkAccessibility: false });

test.describe('Reseller portal — visual regression (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page).toHaveScreenshot('reseller-login.png', {
      maxDiffPixels: 50,
      animations: 'disabled',
    });
  });
});

test.describe('Reseller portal — visual regression (authenticated)', () => {
  test('billing subscriptions', async ({ page }) => {
    await page.goto('/en/billing/subscriptions');
    await expect(page.getByTestId('billing-assign-plan-btn')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot('reseller-billing-subscriptions.png', {
      maxDiffPixels: 150,
      animations: 'disabled',
    });
  });

  test('billing plans data table', async ({ page }) => {
    await page.goto('/en/reseller/billing/plans');
    await expect(page.getByTestId('billing-create-plan-btn')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot('reseller-billing-plans.png', {
      maxDiffPixels: 150,
      animations: 'disabled',
    });
  });
});
