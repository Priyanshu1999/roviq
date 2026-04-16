import { expect, test } from '../../shared/console-guardian';

/**
 * Visual regression baselines for the reseller portal.
 * See admin spec for rationale and baseline-update workflow.
 *
 * The reseller portal has no dedicated dashboard — the landing surface is
 * the billing subscriptions page. Dynamic timestamp columns are absent
 * from the hero card, so the page above the fold screenshots stably.
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
  test('billing subscriptions landing', async ({ page }) => {
    await page.goto('/en/billing/subscriptions');
    await expect(page.getByTestId('billing-assign-plan-btn')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot('reseller-billing-subscriptions.png', {
      maxDiffPixels: 100,
      animations: 'disabled',
    });
  });
});
