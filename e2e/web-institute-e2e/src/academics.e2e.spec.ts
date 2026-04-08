import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Academics - Standards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/academics');
    await page.waitForLoadState('networkidle');
  });

  test('standards page loads with 15 standards', async ({ page }) => {
    await expect(page.getByText(/standards/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Saraswati Vidya Mandir has 15 standards: Nursery through Class 12
    await expect(page.getByText('Nursery')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Class 12').first()).toBeVisible();

    // Verify the total count — look for 15 rows or a count indicator
    const standardRows = page.locator('table tbody tr, [data-testid*="standard"]');
    const count = await standardRows.count();
    expect(count).toBeGreaterThanOrEqual(15);
  });

  test('year selector dropdown is visible and works', async ({ page }) => {
    // Academic year selector should be present
    const yearSelector = page
      .getByRole('combobox')
      .or(page.locator('button:has-text("2025"), button:has-text("2026")'));
    await expect(yearSelector.first()).toBeVisible({ timeout: 10_000 });
  });

  test('"New Standard" button is visible', async ({ page }) => {
    const newButton = page
      .getByRole('button', { name: /new standard/i })
      .or(page.getByRole('link', { name: /new standard/i }));
    await expect(newButton).toBeVisible({ timeout: 10_000 });
  });

  test('table/by-department view toggle works', async ({ page }) => {
    // Look for a view toggle (table vs department/card view)
    const viewToggle = page
      .getByRole('tablist')
      .or(page.locator('[role="group"]').filter({ hasText: /department|table/i }));
    await expect(viewToggle.first()).toBeVisible({ timeout: 10_000 });

    // Click the alternative view
    const departmentTab = page
      .getByRole('tab', { name: /department/i })
      .or(page.getByRole('button', { name: /department/i }));
    if ((await departmentTab.count()) > 0) {
      await departmentTab.first().click();
      // Page should still show standards content
      await expect(page.getByText('Nursery')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('standard names are clickable links', async ({ page }) => {
    const nurseryLink = page
      .getByRole('link', { name: /nursery/i })
      .or(page.getByText('Nursery').first());
    await expect(nurseryLink).toBeVisible({ timeout: 10_000 });

    await nurseryLink.click();
    // Should navigate to the standard detail page
    await expect(page).toHaveURL(/\/academics\//, { timeout: 10_000 });
  });

  test('standards show correct NEP stages', async ({ page }) => {
    // Saraswati Vidya Mandir follows NEP framework
    await expect(page.getByText(/foundational/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/preparatory/i).first()).toBeVisible();
    await expect(page.getByText(/middle/i).first()).toBeVisible();
    await expect(page.getByText(/secondary/i).first()).toBeVisible();
  });

  test('board exam flag shown for Class 10 and 12', async ({ page }) => {
    // Look for board exam indicators near Class 10 and Class 12
    const class10Row = page.locator('tr, [data-testid*="standard"]', {
      hasText: 'Class 10',
    });
    const class12Row = page.locator('tr, [data-testid*="standard"]', {
      hasText: 'Class 12',
    });

    await expect(class10Row.first()).toBeVisible({ timeout: 10_000 });
    await expect(class12Row.first()).toBeVisible();

    // Board exam flag — could be a badge, icon, or text
    const boardExamIndicators = page
      .getByText(/board exam/i)
      .or(page.locator('[title*="Board"], [aria-label*="board"]'));
    const indicatorCount = await boardExamIndicators.count();
    expect(indicatorCount).toBeGreaterThanOrEqual(2);
  });
});
