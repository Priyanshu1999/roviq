/**
 * ROV-170 Groups create wizard — full end-to-end happy path.
 *
 * Verified manually via the playwright MCP browser against a live api-gateway:
 *   1. Navigate to /en/groups/new
 *   2. Step 1 (Basics): fill name, pick type "Class", default Static membership,
 *      Students checkbox already pre-checked → Next
 *   3. Step 2 (Members): empty member picker for static/no-seed → Create Group
 *   4. Server returns a real UUIDv7, router pushes to /institute/groups/{id}
 *   5. Detail page renders heading, type/membership badges, "Members (0)" tab,
 *      "This group has no members yet." empty state.
 *
 * This spec re-runs that flow against any environment that has the
 * institute-admin auth state stored in `playwright/.auth/institute.json`
 * (set up by `auth.setup.ts`).
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Groups — create wizard happy path', () => {
  test('creates a static class group through the 2-step wizard', async ({ page }) => {
    // Use a unique name per test run so re-runs don't collide on the
    // institute_unique_group_name index when the DB isn't reset.
    const uniqueName = `Class 10-A ${Date.now()}`;

    await page.goto('/en/groups/new');

    // ── Step 1: Basics ──────────────────────────────────────────────
    await expect(page.getByTestId('groups-new-title')).toBeVisible();

    await page.getByTestId('groups-new-name-input').fill(uniqueName);

    // The Group type combobox — pick "Class".
    await page.getByTestId('groups-new-type-select').click();
    await page.getByRole('option', { name: 'Class', exact: true }).click();

    // Membership type defaults to Static — verify.
    await expect(page.getByTestId('groups-new-membership-type-select')).toContainText('Static');

    // Students checkbox is pre-checked by default.
    await expect(page.getByTestId('groups-new-member-type-student')).toBeChecked();

    // Previous is disabled on the first step, Next is the primary action.
    await expect(page.getByTestId('groups-new-prev-btn')).toBeDisabled();
    await page.getByTestId('groups-new-next-btn').click();

    // ── Step 2: Members ─────────────────────────────────────────────
    await expect(page.getByTestId('groups-new-members-search')).toBeVisible();
    // Empty seed → no candidates.
    await expect(page.getByTestId('groups-new-no-candidates').first()).toBeVisible();
    await expect(page.getByTestId('groups-new-no-selection')).toBeVisible();

    // Submit — the wizard does NOT require members for static groups.
    await page.getByTestId('groups-new-submit-btn').click();

    // ── Detail page (post-create redirect) ─────────────────────────
    // The router pushes to /institute/groups/{uuid} (middleware injects scope).
    await expect(page).toHaveURL(/\/institute\/groups\/[0-9a-f-]{36}/);
    await expect(page.getByTestId('groups-detail-title')).toHaveText(uniqueName);

    // Type + membership badges next to the heading.
    await expect(page.getByTestId('groups-detail-type-badge')).toBeVisible();
    await expect(page.getByTestId('groups-detail-membership-badge')).toBeVisible();

    // Members tab is selected, empty members message visible.
    await expect(page.getByTestId('groups-detail-tab-members')).toBeVisible();
    await expect(page.getByTestId('groups-members-empty')).toBeVisible();

    // Audit tab also exists.
    await expect(page.getByTestId('groups-detail-tab-audit')).toBeVisible();

    // Sidebar nav still works — back to the groups list.
    await page.getByTestId('groups-detail-back-btn').click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?groups$/);
  });

  test('Previous button on step 2 returns to Basics step', async ({ page }) => {
    await page.goto('/en/groups/new');

    await page.getByTestId('groups-new-name-input').fill('Temp Group');
    await page.getByTestId('groups-new-type-select').click();
    await page.getByRole('option', { name: 'Class', exact: true }).click();
    await page.getByTestId('groups-new-next-btn').click();

    await expect(page.getByTestId('groups-new-members-search')).toBeVisible();
    await page.getByTestId('groups-new-prev-btn').click();

    // Back on step 1 — name field still has the value.
    await expect(page.getByTestId('groups-new-name-input')).toHaveValue('Temp Group');
  });

  test('Group type combobox shows representative types', async ({ page }) => {
    await page.goto('/en/groups/new');
    await page.getByTestId('groups-new-type-select').click();

    // Representative sample of the DomainGroupType values.
    for (const name of ['Class', 'House', 'Sports Team', 'Bus Route', 'Custom']) {
      await expect(page.getByRole('option', { name, exact: true })).toBeVisible();
    }
  });
});
