import { expect, test } from '../../shared/console-guardian';

test.describe('Admin Institute Groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/institute-groups');
  });

  test('page loads with title and description', async ({ page }) => {
    await expect(page.getByTestId('institute-groups-title')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('institute-groups-description')).toBeVisible();
  });

  test('table shows correct column headers', async ({ page }) => {
    // Wait for the page content to render
    await expect(page.getByTestId('institute-groups-title')).toBeVisible({
      timeout: 15_000,
    });

    // The table may be empty (showing empty state) or have data.
    // Check for column headers if the table is present.
    const table = page.getByTestId('institute-groups-table');
    const tableVisible = await table.isVisible().catch(() => false);

    if (tableVisible) {
      await expect(page.getByTestId('institute-groups-table-col-name')).toBeVisible();
      await expect(page.getByTestId('institute-groups-table-col-code')).toBeVisible();
      await expect(page.getByTestId('institute-groups-table-col-type')).toBeVisible();
      await expect(page.getByTestId('institute-groups-table-col-registrationNumber')).toBeVisible();
      await expect(page.getByTestId('institute-groups-table-col-status')).toBeVisible();
    } else {
      // Empty state is also valid — the page still loaded successfully
      await expect(page.getByTestId('institute-groups-empty')).toBeVisible();
    }
  });

  test('"New Group" button is visible', async ({ page }) => {
    await expect(page.getByTestId('institute-groups-title')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('institute-groups-new-btn')).toBeVisible();
  });
});
