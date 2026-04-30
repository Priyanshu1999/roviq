/**
 * ROV-236 — Tenant-admin Role Bottom Nav settings page (`/settings/roles`).
 *
 * Verifies:
 *   1. Page renders for institute_admin and lists seeded roles.
 *   2. Customize sheet opens for the principal row and shows the picker
 *      with the seeded selection (dashboard, students, academics, audit).
 *   3. Saving an edited selection round-trips through the API: removing
 *      "audit" + adding "groups" persists across a page reload.
 *   4. The 4-slug cap surfaces a "Pick at most {max}" toast when the user
 *      tries to select a 5th destination.
 *   5. CASL gating — the same page rendered as a non-admin (teacher) shows
 *      the forbidden empty state instead of the role list.
 *
 * Reorder is deliberately NOT tested — dnd-kit drag interactions are too
 * flaky under Playwright; that interaction belongs in a focused component
 * test with a manual `onDragEnd` event. See ROV-236 spec: only add / remove
 * / save are covered here.
 */
import path from 'node:path';
import { test as baseTest, type Page } from '@playwright/test';
import { persistSessionStorage } from '../../shared/auth-helpers';
import { expect, test } from '../../shared/console-guardian';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';
import { SEED } from '../../shared/seed';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the role row whose visible label matches `roleName` (the seeded
 * `name.en` value, e.g. "principal"). Each row's `data-testid` is
 * `role-row-{uuid}`, so we filter by text content. Returns the locator and
 * the parsed role id so the caller can address the customize button.
 */
async function findRoleRow(
  page: Page,
  roleName: string,
): Promise<{ row: ReturnType<Page['getByTestId']>; roleId: string }> {
  const row = page
    .locator('[data-testid^="role-row-"]')
    .filter({ hasText: new RegExp(`^\\s*${roleName}\\b`, 'i') })
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });

  const testId = await row.getAttribute('data-testid');
  if (!testId) throw new Error(`Could not read data-testid for role "${roleName}"`);
  const roleId = testId.replace(/^role-row-/, '');
  return { row, roleId };
}

async function openCustomizeSheet(page: Page, roleName: string): Promise<string> {
  const { roleId } = await findRoleRow(page, roleName);
  await page.getByTestId(`role-customize-${roleId}`).click();
  await expect(page.getByTestId('customize-sheet')).toBeVisible();
  return roleId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated suite — institute_admin storage state from auth.setup.ts
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Settings — Role Bottom Nav (/settings/roles)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/settings/roles');
    // The PageHeader title doubles as the load signal.
    await expect(page.getByRole('heading', { name: 'Role Bottom Nav' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('renders the seeded role list for an institute admin', async ({ page }) => {
    const rows = page.locator('[data-testid^="role-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('opens the customize sheet for the principal row and shows seeded slugs', async ({
    page,
  }) => {
    await openCustomizeSheet(page, 'principal');

    // Picker should expose every NAV_SLUGS entry as a checkbox; bare
    // minimum we want to see more than 4 to prove the picker is rendered.
    const checkboxes = page.locator('[data-testid^="slug-checkbox-"]');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThan(4);

    // The seeded selection for principal is dashboard/students/academics/audit.
    // `slug-position-{slug}` is rendered ONLY for selected rows, so its mere
    // presence proves the row is in the selected bucket with a position.
    for (const slug of ['dashboard', 'students', 'academics', 'audit']) {
      await expect(page.getByTestId(`slug-position-${slug}`)).toBeVisible();
    }
  });

  test('saving add/remove changes round-trips through the API', async ({ page }) => {
    await openCustomizeSheet(page, 'principal');

    // Capture the initial state to allow the test to be self-restoring at
    // the end — `roviq_test` is shared across the suite, so leaving the
    // principal row mutated would leak into other specs (and the snapshot
    // for #2 above would drift on re-runs against a non-reset DB).
    const wasAuditSelected = await page.getByTestId('slug-position-audit').isVisible();
    const wasGroupsSelected = await page.getByTestId('slug-position-groups').isVisible();

    // Apply: remove "audit", add "groups".
    if (wasAuditSelected) await page.getByTestId('slug-checkbox-audit').click();
    if (!wasGroupsSelected) await page.getByTestId('slug-checkbox-groups').click();

    await page.getByTestId('customize-save').click();

    // Sheet closes on a successful save. The Radix Sheet unmounts the
    // SheetContent when `open === false`, so the testid disappears entirely.
    await expect(page.getByTestId('customize-sheet')).toBeHidden();

    // Reload and re-open to prove the change actually persisted server-side
    // rather than only living in the local component state.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Role Bottom Nav' })).toBeVisible({
      timeout: 15_000,
    });
    await openCustomizeSheet(page, 'principal');

    await expect(page.getByTestId('slug-position-groups')).toBeVisible();
    await expect(page.getByTestId('slug-position-audit')).toHaveCount(0);

    // Restore so the row matches its seeded state for downstream specs.
    await page.getByTestId('slug-checkbox-audit').click();
    await page.getByTestId('slug-checkbox-groups').click();
    await page.getByTestId('customize-save').click();
    await expect(page.getByTestId('customize-sheet')).toBeHidden();
  });

  test('selecting a 5th slug surfaces the "Pick at most 4" toast', async ({ page }) => {
    await openCustomizeSheet(page, 'principal');

    // Principal is seeded with exactly 4 selected (the cap). Picking any
    // currently-unselected slug should trip MAX_PRIMARY_NAV_SLUGS in the
    // sheet's `toggle()` and call `toast.error(t('maxFour', { max: 4 }))`.
    // We pick "groups" because it's not in the seeded selection.
    const cap = page.locator('[data-testid="customize-selected-count"]');
    await expect(cap).toContainText('4 of 4');

    await page.getByTestId('slug-checkbox-groups').click();

    // sonner renders into a portal at `[data-sonner-toaster]`. The error
    // toast has the localized "Pick at most {max}" string from
    // `messages/en/settings.json` -> `roles.maxFour`.
    const toast = page.locator('[data-sonner-toaster]').getByText(/Pick at most 4/i);
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // The selection must remain at 4 — toggle was rejected.
    await expect(page.getByTestId('slug-position-groups')).toHaveCount(0);
    await expect(cap).toContainText('4 of 4');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CASL gating — separate `test()` block with a fresh, scope-limited login.
// We can't reuse the suite-wide institute-admin storage state, so we do a
// one-off interactive login as `teacher1`. This block opts out of the shared
// `storageState` so the LoginPage flow starts from a clean session.
// ─────────────────────────────────────────────────────────────────────────────

const teacherTest = baseTest.extend({});
teacherTest.use({ storageState: { cookies: [], origins: [] } });

teacherTest('renders the forbidden state for a non-admin (teacher) role', async ({ page }) => {
  const teacherAuthFile = path.join(
    __dirname,
    '../../playwright/.auth/institute-teacher-roles.json',
  );

  // Fresh login as teacher1 against the same institute. Mirrors the auth
  // setup pattern in `auth.setup.ts` so the access token ends up in
  // localStorage where `console-guardian` can rehydrate it.
  const loginPage = new LoginPage(page);
  await loginPage.goto('/en/login');
  await loginPage.login(E2E_USERS.TEACHER.username, E2E_USERS.TEACHER.password);
  await loginPage.selectInstitute(SEED.INSTITUTE_1.name);
  await loginPage.expectRedirectToDashboard();
  await persistSessionStorage(page);
  await page.context().storageState({ path: teacherAuthFile });

  await page.goto('/en/settings/roles');

  // The page renders the PageHeader for everyone, then either the role
  // table (for `update Role` ability) or the friendly forbidden empty
  // state. A teacher lacks `update Role`, so the forbidden state must
  // appear and the table must NOT.
  await baseTest.expect(page.getByTestId('role-nav-forbidden')).toBeVisible({ timeout: 15_000 });
  await baseTest.expect(page.locator('[data-testid^="role-row-"]')).toHaveCount(0);
});
