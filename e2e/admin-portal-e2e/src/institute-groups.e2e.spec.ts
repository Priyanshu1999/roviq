import { expect, test } from '@playwright/test';

test.describe('Admin Institute Groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/admin/institute-groups');
  });

  test('page loads with title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Institute Groups' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText('Manage trusts, societies, and chains that operate institutes.'),
    ).toBeVisible();
  });

  test('table shows correct column headers', async ({ page }) => {
    // Wait for the page content to render
    await expect(page.getByRole('heading', { name: 'Institute Groups' })).toBeVisible({
      timeout: 15_000,
    });

    // The table may be empty (showing empty state) or have data.
    // Check for column headers if the table is present.
    const table = page.locator('table');
    const tableVisible = await table.isVisible().catch(() => false);

    if (tableVisible) {
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Registration No.' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    } else {
      // Empty state is also valid — the page still loaded successfully
      await expect(page.getByText(/No institute groups/)).toBeVisible();
    }
  });

  test('"New Group" button is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Institute Groups' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /New Group/ })).toBeVisible();
  });
});
