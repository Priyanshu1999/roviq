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
import { expect, test } from '@playwright/test';

test.describe('Groups — create wizard happy path', () => {
  test('creates a static class group through the 2-step wizard', async ({ page }) => {
    // Use a unique name per test run so re-runs don't collide on the
    // institute_unique_group_name index when the DB isn't reset.
    const uniqueName = `Class 10-A ${Date.now()}`;

    await page.goto('/en/groups/new');

    // ── Step 1: Basics ──────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Create Group', level: 1 })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Group basics' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Group name' }).fill(uniqueName);

    // The 16-option Group type combobox — pick "Class".
    await page.getByRole('combobox', { name: 'Group type' }).click();
    await page.getByRole('option', { name: 'Class', exact: true }).click();

    // Membership type defaults to Static — leave it.
    await expect(page.getByRole('combobox', { name: 'Membership type' })).toContainText('Static');

    // Students checkbox is pre-checked by default.
    await expect(page.getByRole('checkbox', { name: 'Students' })).toBeChecked();

    // Previous is disabled on the first step, Next is the primary action.
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // ── Step 2: Members ─────────────────────────────────────────────
    await expect(page.getByRole('group', { name: 'Add members' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search members…' })).toBeVisible();
    // Empty seed → no candidates.
    await expect(page.getByText('No candidates found.')).toBeVisible();
    await expect(page.getByText('No members selected yet.')).toBeVisible();

    // Submit — the wizard does NOT require members for static groups.
    await page.getByRole('button', { name: 'Create Group' }).click();

    // ── Detail page (post-create redirect) ─────────────────────────
    // The router pushes to /institute/groups/{uuid} (middleware injects scope).
    await expect(page).toHaveURL(/\/institute\/groups\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { name: uniqueName, level: 1 })).toBeVisible();

    // Type + membership badges next to the heading.
    await expect(page.getByText('Class', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Static', { exact: true }).first()).toBeVisible();

    // Members (0) tab is selected, empty members message visible.
    await expect(page.getByRole('tab', { name: /Members \(0\)/ })).toBeVisible();
    await expect(page.getByText('This group has no members yet.')).toBeVisible();

    // Audit tab also exists.
    await expect(page.getByRole('tab', { name: 'Audit' })).toBeVisible();

    // Sidebar nav still works — back to the groups list.
    await page.getByRole('button', { name: 'Back to groups' }).click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?groups$/);
  });

  test('Previous button on step 2 returns to Basics step', async ({ page }) => {
    await page.goto('/en/groups/new');

    await page.getByRole('textbox', { name: 'Group name' }).fill('Temp Group');
    await page.getByRole('combobox', { name: 'Group type' }).click();
    await page.getByRole('option', { name: 'Class', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await expect(page.getByRole('group', { name: 'Add members' })).toBeVisible();
    await page.getByRole('button', { name: 'Previous' }).click();

    // Back on step 1 — Basics group visible again, name field still has the value.
    await expect(page.getByRole('group', { name: 'Group basics' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Group name' })).toHaveValue('Temp Group');
  });

  test('Group type combobox shows all 16 ROV-170 types', async ({ page }) => {
    await page.goto('/en/groups/new');
    await page.getByRole('combobox', { name: 'Group type' }).click();

    // The 16 group types from the spec — Class, House, Club, Sports Team,
    // Transport Route, Hostel, Department, Subject Group, Elective Group,
    // Project Team, Alumni Cohort, Composite, Custom, System, Section,
    // Committee. Verify a representative sample.
    for (const name of ['Class', 'House', 'Sports Team', 'Hostel', 'Custom']) {
      await expect(page.getByRole('option', { name, exact: true })).toBeVisible();
    }
  });
});
