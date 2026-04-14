import { expect, test } from '../../shared/console-guardian';

test.describe('Billing — Assign Plan Dialog', () => {
  test('plan dropdown should show active plans', async ({ page }) => {
    await page.goto('/en/billing/subscriptions');

    // Open the assign plan dialog
    await page.getByTestId('billing-assign-plan-btn').click();
    await expect(page.getByTestId('billing-assign-plan-dialog')).toBeVisible({
      timeout: 5_000,
    });

    // Click the plan dropdown trigger — identified by its data-testid
    const planTrigger = page.getByTestId('billing-assign-plan-select');
    await planTrigger.click();

    // Verify plan options are visible (regression: isActive filter removed all plans)
    const planOptions = page.getByRole('option');
    await expect(planOptions.first()).toBeVisible({ timeout: 5_000 });
    const count = await planOptions.count();
    expect(count).toBeGreaterThan(0);
  });
});
