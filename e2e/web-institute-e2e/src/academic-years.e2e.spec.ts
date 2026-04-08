import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Academic Years', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/academic-years');
    await page.waitForLoadState('networkidle');
  });

  test('academic years page loads', async ({ page }) => {
    await expect(page.getByText(/academic year/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('active year shows current year label', async ({ page }) => {
    // The active academic year should display 2025-2026 or 2025-26 or 2026-2027
    const yearLabel = page.getByText(/2025[\s–-]+20?26/i).or(page.getByText(/2026[\s–-]+20?27/i));
    await expect(yearLabel.first()).toBeVisible({ timeout: 10_000 });
  });

  test('"New Academic Year" button is visible', async ({ page }) => {
    const newButton = page
      .getByRole('button', { name: /new academic year/i })
      .or(page.getByRole('link', { name: /new academic year/i }));
    await expect(newButton).toBeVisible({ timeout: 10_000 });
  });
});
