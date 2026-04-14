import { expect, test } from '../../shared/console-guardian';

test.describe('Academic Years', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/academic-years');
    await expect(page.getByTestId('academic-years-title')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('academic years page loads', async ({ page }) => {
    await expect(page.getByTestId('academic-years-title')).toBeVisible();
  });

  test('active year shows current year label', async ({ page }) => {
    // The active academic year card should display a year label
    await expect(page.getByTestId('academic-year-label').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('"New Academic Year" button is visible', async ({ page }) => {
    await expect(page.getByTestId('academic-years-new-btn')).toBeVisible();
  });
});
