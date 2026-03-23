import { expect, test } from '@playwright/test';

test.describe('Billing — Assign Plan Dialog', () => {
  test('plan dropdown should show active plans', async ({ page }) => {
    await page.goto('/en/billing/subscriptions');

    // Open the assign plan dialog
    await page.getByRole('button', { name: /Assign Plan/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Click the plan dropdown trigger (institute=first, plan=second)
    const planTrigger = page.getByRole('combobox').nth(1);
    await planTrigger.click();

    // Verify plan options are visible (regression: isActive filter removed all plans)
    const planOptions = page.getByRole('option');
    await expect(planOptions.first()).toBeVisible({ timeout: 5_000 });
    const count = await planOptions.count();
    expect(count).toBeGreaterThan(0);
  });
});
