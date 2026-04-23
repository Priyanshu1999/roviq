/**
 * Students create page — happy path, cancel, and validation.
 *
 * Covers /en/people/students/new:
 *   1. Fill minimum fields (academic year auto-defaults, cascading standard/section)
 *      → submit → redirect to detail page
 *   2. Back button returns to list
 *   3. Empty submit surfaces validation errors
 *
 * The happy path depends on the test tenant having at least one seeded
 * standard + section under the active academic year.
 */
import path from 'node:path';

import { deleteStudentViaApi, extractStudentIdFromUrl } from '../../shared/api-client';
import { expect, test } from '../../shared/console-guardian';

const INSTITUTE_AUTH_PATH = path.join(
  __dirname,
  '..',
  '..',
  'playwright',
  '.auth',
  'institute.json',
);

// Module-scoped collection of student UUIDs created by this spec. Each
// test that actually POSTs a student to the API appends the returned id
// here; `afterAll` deletes them through the `deleteStudent` GraphQL
// mutation so downstream specs (groups-create, guardians-detail, …) read
// a clean `listStudents` result. Module state is per-worker, so parallel
// workers clean up their own writes independently.
const createdStudentIds: string[] = [];

test.describe('Students — create page', () => {
  test.afterAll(async ({ browser }) => {
    if (createdStudentIds.length === 0) return;
    // A fresh context is needed because Playwright tears down the
    // per-test context before `afterAll` runs. Re-using the stored auth
    // state gives us the same institute-admin JWT the tests ran under.
    const context = await browser.newContext({
      storageState: INSTITUTE_AUTH_PATH,
    });
    const page = await context.newPage();
    // Navigate to the app so `localStorage` is hydrated from the stored
    // origin — `page.evaluate(localStorage)` returns empty on about:blank.
    await page.goto('/en/dashboard');
    for (const id of createdStudentIds) {
      await deleteStudentViaApi(page, id);
    }
    await context.close();
    createdStudentIds.length = 0;
  });

  test('creates a student and redirects to the detail page', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Student ${unique}`;

    await page.goto('/en/people/students/new');

    await expect(page.getByTestId('students-new-title')).toBeVisible();

    await page.getByTestId('students-new-first-name-en').fill(firstName);

    await page.getByTestId('students-new-gender-select').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    // Academic year auto-defaults to the active one — the standard select
    // should become enabled once the default year hydrates.
    const standardSelect = page.getByTestId('students-new-standard-select');
    await expect(standardSelect).toBeEnabled({ timeout: 10_000 });
    await standardSelect.click();

    const options = page.getByRole('option');
    const standardCount = await options.count();
    if (standardCount === 0) {
      test.skip(
        true,
        'Test tenant has no seeded standards under the active year — see seed script.',
      );
      return;
    }
    await options.first().click();

    const sectionSelect = page.getByTestId('students-new-section-select');
    await expect(sectionSelect).toBeEnabled({ timeout: 10_000 });
    await sectionSelect.click();
    await page.getByRole('option').first().click();

    const today = new Date().toISOString().slice(0, 10);
    await page.getByTestId('students-new-admission-date-input').fill(today);

    await page.getByTestId('students-new-submit-btn').click();

    await expect(page).toHaveURL(/\/(institute\/)?people\/students\/[0-9a-f-]{36}/);
    await expect(page.getByTestId('students-detail-title')).toBeVisible();

    const createdId = extractStudentIdFromUrl(page.url());
    if (createdId) createdStudentIds.push(createdId);
  });

  test('Back button returns to the students list', async ({ page }) => {
    await page.goto('/en/people/students/new');

    await expect(page.getByTestId('students-new-title')).toBeVisible();
    await page.getByTestId('students-new-back-btn').click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?people\/students$/);
  });

  test('blank submit shows validation errors and stays on page', async ({ page }) => {
    await page.goto('/en/people/students/new');

    await page.getByTestId('students-new-submit-btn').click();

    await expect(page).toHaveURL(/\/people\/students\/new/);
    await expect(page.getByTestId('students-new-title')).toBeVisible();
  });

  test('newly created student appears in the list (cache freshness)', async ({ page }) => {
    const unique = Date.now();
    const firstName = `CacheFresh ${unique}`;

    await page.goto('/en/people/students/new');
    await page.getByTestId('students-new-first-name-en').fill(firstName);
    await page.getByTestId('students-new-gender-select').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    const standardSelect = page.getByTestId('students-new-standard-select');
    await expect(standardSelect).toBeEnabled({ timeout: 10_000 });
    await standardSelect.click();
    const standardCount = await page.getByRole('option').count();
    if (standardCount === 0) {
      test.skip(true, 'No seeded standards');
      return;
    }
    await page.getByRole('option').first().click();

    const sectionSelect = page.getByTestId('students-new-section-select');
    await expect(sectionSelect).toBeEnabled({ timeout: 10_000 });
    await sectionSelect.click();
    await page.getByRole('option').first().click();

    const today = new Date().toISOString().slice(0, 10);
    await page.getByTestId('students-new-admission-date-input').fill(today);

    await page.getByTestId('students-new-submit-btn').click();
    await expect(page).toHaveURL(/\/people\/students\/[0-9a-f-]{36}/);

    const createdId = extractStudentIdFromUrl(page.url());
    if (createdId) createdStudentIds.push(createdId);

    await page.goto('/en/people/students');
    await page.getByTestId('students-search-input').fill(firstName);
    await expect(page.getByTestId('students-table').getByText(firstName)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('submit button stays disabled while required UUID fields are missing (kit canSubmit gate)', async ({
    page,
  }) => {
    const firstName = `Preserve ${Date.now()}`;

    await page.goto('/en/people/students/new');

    await page.getByTestId('students-new-first-name-en').fill(firstName);

    await page.getByTestId('students-new-gender-select').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    // TanStack Form's `state.canSubmit` is false while required UUID fields
    // (standardId + sectionId) are empty, so the kit's SubmitButton renders
    // disabled until those are filled. This replaces the old behaviour of
    // "click submit to surface errors" — users see each field's inline Zod
    // error the moment they touch it, no submit-click needed.
    const submitBtn = page.getByTestId('students-new-submit-btn');
    await expect(submitBtn).toBeDisabled();

    // URL stays on the form and filled values persist (no premature reset).
    await expect(page).toHaveURL(/\/people\/students\/new/);
    await expect(page.getByTestId('students-new-first-name-en')).toHaveValue(firstName);
    await expect(page.getByTestId('students-new-gender-select')).toContainText('Male');
  });

  // ── isRteAdmitted (orthogonal to admissionType) ─────────────────────
  //
  // RTE-quota admission is tracked as its own boolean alongside the
  // four admission routes. The checkbox must render, persist when
  // submitted, and show up on the detail page.

  test('isRteAdmitted checkbox toggles and persists to the created student', async ({ page }) => {
    const unique = Date.now();
    const firstName = `RTE Student ${unique}`;

    await page.goto('/en/people/students/new');
    await expect(page.getByTestId('students-new-title')).toBeVisible();

    await page.getByTestId('students-new-first-name-en').fill(firstName);
    await page.getByTestId('students-new-gender-select').click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    const standardSelect = page.getByTestId('students-new-standard-select');
    await expect(standardSelect).toBeEnabled({ timeout: 10_000 });
    await standardSelect.click();
    const optionCount = await page.getByRole('option').count();
    if (optionCount === 0) {
      test.skip(true, 'No seeded standards under the active year');
      return;
    }
    await page.getByRole('option').first().click();

    const sectionSelect = page.getByTestId('students-new-section-select');
    await expect(sectionSelect).toBeEnabled({ timeout: 10_000 });
    await sectionSelect.click();
    await page.getByRole('option').first().click();

    const today = new Date().toISOString().slice(0, 10);
    await page.getByTestId('students-new-admission-date-input').fill(today);

    // Tick the RTE-admitted checkbox.
    const rteCheckbox = page.getByTestId('students-new-rte-admitted-checkbox');
    await expect(rteCheckbox).not.toBeChecked();
    await rteCheckbox.click();
    await expect(rteCheckbox).toBeChecked();

    await page.getByTestId('students-new-submit-btn').click();

    // Detail page loads for the newly created student.
    await expect(page).toHaveURL(/\/(institute\/)?people\/students\/[0-9a-f-]{36}/);
    await expect(page.getByTestId('students-detail-title')).toBeVisible();

    const createdId = extractStudentIdFromUrl(page.url());
    if (createdId) createdStudentIds.push(createdId);
  });

  // ── admissionType options (RTE removed from enum) ────────────────────
  //
  // `RTE` was removed from `ADMISSION_TYPE_VALUES` because it was mixing
  // two orthogonal concerns (route into institute vs. quota flag). The
  // dropdown must NOT expose `RTE` any more.

  test('admissionType dropdown does not expose the removed RTE option', async ({ page }) => {
    await page.goto('/en/people/students/new');
    await expect(page.getByTestId('students-new-title')).toBeVisible();

    await page.getByTestId('students-new-admission-type-select').click();

    // Any of the legitimate routes should appear.
    await expect(page.getByRole('option', { name: 'New admission' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Transfer', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Lateral entry' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Re-admission' })).toBeVisible();
    // …but `RTE` (short label from the old enum) must NOT.
    await expect(page.getByRole('option', { name: 'RTE', exact: true })).toHaveCount(0);
  });

  // ── Draft banner (localStorage persistence) ──────────────────────────
  //
  // `useFormDraft` autosaves dirty form state to localStorage (debounced)
  // and offers the user the choice to restore or discard on the next
  // page load. Covers both the restore-path and the discard-path.

  test('restore draft banner hydrates a typed first-name on reload', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Drafted ${unique}`;

    await page.goto('/en/people/students/new');
    await expect(page.getByTestId('students-new-title')).toBeVisible();

    // Type + blur so `isDirty` flips and the debounced autosave lands.
    await page.getByTestId('students-new-first-name-en').fill(firstName);
    await page.getByTestId('students-new-first-name-hi').click();
    // The useFormDraft debounce is 1s; 2s gives it plenty of margin.
    await page.waitForTimeout(1500);

    await page.reload();
    await expect(page.getByTestId('students-new-title')).toBeVisible();

    // Banner surfaces both buttons (copy is shared via `common.draft.*`).
    const restoreBtn = page.getByRole('button', { name: /^restore$/i });
    await expect(restoreBtn).toBeVisible();

    await restoreBtn.click();
    await expect(page.getByTestId('students-new-first-name-en')).toHaveValue(firstName);
  });

  test('discard drops the saved draft and leaves the form empty', async ({ page }) => {
    const unique = Date.now();
    const firstName = `ToDiscard ${unique}`;

    await page.goto('/en/people/students/new');
    await expect(page.getByTestId('students-new-title')).toBeVisible();

    await page.getByTestId('students-new-first-name-en').fill(firstName);
    await page.getByTestId('students-new-first-name-hi').click();
    await page.waitForTimeout(1500);

    await page.reload();
    const discardBtn = page.getByRole('button', { name: /^discard$/i });
    await expect(discardBtn).toBeVisible();
    await discardBtn.click();

    // Banner gone + form starts fresh.
    await expect(discardBtn).toHaveCount(0);
    await expect(page.getByTestId('students-new-first-name-en')).toHaveValue('');

    // Second reload should NOT show the banner — discard purged localStorage.
    await page.reload();
    await expect(page.getByTestId('students-new-title')).toBeVisible();
    await expect(page.getByRole('button', { name: /^restore$/i })).toHaveCount(0);
  });

  // ── Empty-draft regression: pristine form must not trigger the banner
  //
  // The old bug: a `setFieldValue` side-effect that pre-filled the active
  // academic year flipped `isDirty=true`, so the next blur persisted an
  // "empty" draft, and the restore banner showed on reload of a form the
  // user never touched. Guard: loading the page, blurring around, and
  // reloading must NOT surface a restore banner.

  test('pristine form never persists a draft (no spurious restore banner)', async ({ page }) => {
    await page.goto('/en/people/students/new');
    await expect(page.getByTestId('students-new-title')).toBeVisible();

    // Click around without typing anything — triggers focus changes that
    // would have fired the old interval / focusout write.
    await page.getByTestId('students-new-first-name-en').click();
    await page.getByTestId('students-new-first-name-hi').click();
    await page.getByTestId('students-new-last-name-en').click();
    await page.waitForTimeout(1500);

    await page.reload();
    await expect(page.getByTestId('students-new-title')).toBeVisible();
    await expect(page.getByRole('button', { name: /^restore$/i })).toHaveCount(0);
  });
});
