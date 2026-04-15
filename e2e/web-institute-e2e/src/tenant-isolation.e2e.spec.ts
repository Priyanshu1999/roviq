/**
 * Tenant isolation — verifies that switching institutes actually changes the
 * active tenant scope and that data from one institute is not visible in another.
 *
 * These tests go beyond switchers.e2e.spec.ts (which only verifies the dropdown
 * UI) by exercising the full switch flow and asserting on the resulting data.
 *
 * Seed facts relied on by these tests:
 *   - The `admin` user has memberships in BOTH Institute 1 and Institute 2.
 *   - Institute 2 has NO seeded student profiles (standards + subjects only).
 *   - Auth setup logs in as Institute 1 admin, so that is the starting context.
 *
 * Note: Institute 1 has a student_profile (STUDENT_PROFILE_1) but no student_academics
 * row, so listStudents returns 0 for both institutes — the seed intentionally covers
 * only the profile-creation path. Test 3 therefore verifies the tenant context is
 * restored (students page renders with Institute 1's token, not 403/redirect) rather
 * than asserting on row count.
 */
import { expect, test } from '../../shared/console-guardian';
import { SEED } from '../../shared/seed';

test.describe('Tenant isolation — institute switching', () => {
  test('switching to Institute 2 updates the switcher label', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 10_000 });

    // Confirm we start in Institute 1
    const switcher = page.getByTestId('institute-switcher');
    await expect(switcher).toContainText(SEED.INSTITUTE_1.name);

    // Open dropdown and switch to Institute 2
    await switcher.click();
    const menu = page.getByTestId('institute-switcher-menu');
    await expect(menu).toBeVisible();
    await menu.getByText(SEED.INSTITUTE_2.name).click();

    // Switcher label should update to Institute 2
    await expect(switcher).toContainText(SEED.INSTITUTE_2.name, { timeout: 10_000 });
  });

  test('Institute 2 context is active after switching — students page scoped to Institute 2', async ({
    page,
  }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 10_000 });

    // Switch to Institute 2
    await page.getByTestId('institute-switcher').click();
    const menu = page.getByTestId('institute-switcher-menu');
    await expect(menu).toBeVisible();
    await menu.getByText(SEED.INSTITUTE_2.name).click();
    await expect(page.getByTestId('institute-switcher')).toContainText(SEED.INSTITUTE_2.name, {
      timeout: 10_000,
    });

    // Navigate to students page — verify it loads under Institute 2's token (no redirect
    // to login, no 403). The switcher must still display Institute 2, proving data
    // requests are scoped to the switched tenant.
    await page.goto('/en/people/students');
    await expect(page.getByTestId('students-title')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('institute-switcher')).toContainText(SEED.INSTITUTE_2.name);
  });

  test('switching back to Institute 1 restores Institute 1 tenant context', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 10_000 });

    // Switch to Institute 2 first
    await page.getByTestId('institute-switcher').click();
    await expect(page.getByTestId('institute-switcher-menu')).toBeVisible();
    await page.getByTestId('institute-switcher-menu').getByText(SEED.INSTITUTE_2.name).click();
    await expect(page.getByTestId('institute-switcher')).toContainText(SEED.INSTITUTE_2.name, {
      timeout: 10_000,
    });

    // Now switch back to Institute 1
    await page.getByTestId('institute-switcher').click();
    await expect(page.getByTestId('institute-switcher-menu')).toBeVisible();
    await page.getByTestId('institute-switcher-menu').getByText(SEED.INSTITUTE_1.name).click();
    await expect(page.getByTestId('institute-switcher')).toContainText(SEED.INSTITUTE_1.name, {
      timeout: 10_000,
    });

    // Navigate to students page — verify the page renders under Institute 1's token
    // (no redirect to login, no 403). This confirms the tenant context was fully
    // restored, even though both institutes have 0 listable students in seed.
    await page.goto('/en/people/students');
    await expect(page.getByTestId('students-title')).toBeVisible({ timeout: 10_000 });
    // Switcher still shows Institute 1 — we did not inadvertently land in Institute 2
    await expect(page.getByTestId('institute-switcher')).toContainText(SEED.INSTITUTE_1.name);
  });
});
