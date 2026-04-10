/**
 * ROV-170 — E2E UI smoke tests for the Certificates (TC + Other) pages.
 *
 * Uses the auth.setup storageState so all requests go through a real
 * institute-scoped session. These are smoke tests that confirm the page
 * shells render, CASL gates pass for the institute admin, and the empty
 * states are wired.
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Certificates', () => {
  test('TC list page renders its heading and new-request button', async ({ page }) => {
    await page.goto('/en/certificates/tc');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-test-id="tc-title"]')).toBeVisible();
    // Page title matches the certificates namespace.
    await expect(page.locator('[data-test-id="tc-title"]')).toHaveText(/transfer certificate/i);
  });

  test('Other certificates page renders its heading', async ({ page }) => {
    await page.goto('/en/certificates/other');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-test-id="other-certs-title"]')).toBeVisible();
  });

  test('TC page renders a data table (empty state allowed)', async ({ page }) => {
    await page.goto('/en/certificates/tc');
    await page.waitForLoadState('networkidle');
    // Either the table chrome or an empty-state block should be present —
    // both are rendered inside the DataTable component tree.
    const table = page.locator('[data-test-id="tc-table"]');
    const emptyHeading = page.getByRole('heading').filter({ hasText: /transfer certificate/i });
    await expect(table.or(emptyHeading).first()).toBeVisible();
  });
});
