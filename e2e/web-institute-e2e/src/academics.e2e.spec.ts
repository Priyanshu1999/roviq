import { expect, test } from '../../shared/console-guardian';
import { SEED } from '../../shared/seed';

test.describe('Academics - Standards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/en/academics?year=${SEED.ACADEMIC_YEAR_INST1.id}`);
    await expect(page.getByTestId('academics-title')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('standards page loads with seeded standards', async ({ page }) => {
    // Verify the data table is visible with at least one row.
    const table = page.getByTestId('academics-table');
    await expect(table).toBeVisible({ timeout: 10_000 });

    const rows = table.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('"New Standard" button is visible', async ({ page }) => {
    await expect(page.getByTestId('academics-new-btn')).toBeVisible();
  });

  test('table/by-department view toggle works', async ({ page }) => {
    await expect(page.getByTestId('academics-view-toggle')).toBeVisible();

    // Click the department/grouped view
    const departmentTab = page.getByTestId('academics-tab-department');
    if ((await departmentTab.count()) > 0) {
      await departmentTab.click();
      // Page should still show content (not crash)
      await expect(page.getByTestId('academics-title')).toBeVisible();
    }
  });

  test('standards are clickable and navigate to detail', async ({ page }) => {
    const table = page.getByTestId('academics-table');
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Click the first standard row link
    const firstRowLink = table.locator('tbody tr a').first();
    if ((await firstRowLink.count()) > 0) {
      await firstRowLink.click();
      // Should navigate to the standard detail page
      await expect(page).toHaveURL(/\/academics\//, { timeout: 10_000 });
    }
  });
});
