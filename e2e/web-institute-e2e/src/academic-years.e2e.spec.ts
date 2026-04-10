import { expect, test } from '../../shared/console-guardian';

test.describe.configure({ mode: 'serial' });

test.describe('Academic Years', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/academic-years');
    await page.waitForLoadState('networkidle');
  });

  test('academic years page loads', async ({ page }) => {
    await expect(page.locator('[data-test-id="academic-years-title"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('active year shows current year label', async ({ page }) => {
    // The active academic year should display 2025-2026 or 2025-26 or 2026-2027
    const yearLabel = page.getByText(/2025[\s–-]+20?26/i).or(page.getByText(/2026[\s–-]+20?27/i));
    await expect(yearLabel.first()).toBeVisible({ timeout: 10_000 });
  });

  test('"New Academic Year" button is visible', async ({ page }) => {
    await expect(page.locator('[data-test-id="academic-years-new-btn"]')).toBeVisible({
      timeout: 10_000,
    });
  });
});
