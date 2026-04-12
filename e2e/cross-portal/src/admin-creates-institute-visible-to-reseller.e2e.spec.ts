import path from 'node:path';
import { expect, test } from '@playwright/test';
import { SEED } from '../../shared/seed';

/**
 * Cross-portal test: verifies that a seeded institute created by the platform
 * admin is visible in the reseller portal's institute list.
 *
 * This test switches between two portals (admin and reseller) using separate
 * browser contexts with pre-authenticated storageState files produced by the
 * setup projects.
 */

const adminAuth = path.join(__dirname, '../../playwright/.auth/admin.json');
const resellerAuth = path.join(__dirname, '../../playwright/.auth/reseller.json');

const ADMIN_URL = 'http://admin.localhost:4201';
const RESELLER_URL = 'http://reseller.localhost:4201';

test.describe('Cross-portal: institute visibility', () => {
  test('seeded institute visible to admin is also listed for reseller', async ({ browser }) => {
    // ── Admin portal: confirm institute exists ──
    const adminCtx = await browser.newContext({ storageState: adminAuth });
    const adminPage = await adminCtx.newPage();

    await adminPage.goto(`${ADMIN_URL}/en/admin/institutes`);
    await expect(adminPage.locator('[data-test-id="institutes-title"]')).toBeVisible({
      timeout: 15_000,
    });

    const adminRow = adminPage.locator(
      `[data-test-id="institute-name-cell-${SEED.INSTITUTE_1.id}"]`,
    );
    await expect(adminRow).toBeVisible({ timeout: 10_000 });
    await expect(adminRow).toContainText(SEED.INSTITUTE_1.name);
    await adminCtx.close();

    // ── Reseller portal: same institute appears ──
    const resellerCtx = await browser.newContext({ storageState: resellerAuth });
    const resellerPage = await resellerCtx.newPage();

    await resellerPage.goto(`${RESELLER_URL}/en/reseller/institutes`);
    await expect(resellerPage.locator('[data-test-id="reseller-institutes-title"]')).toBeVisible({
      timeout: 15_000,
    });

    const resellerRow = resellerPage.locator(
      `[data-test-id="institute-name-cell-${SEED.INSTITUTE_1.id}"]`,
    );
    await expect(resellerRow).toBeVisible({ timeout: 10_000 });
    await expect(resellerRow).toContainText(SEED.INSTITUTE_1.name);
    await resellerCtx.close();
  });
});
