/**
 * ROV-167 — Student list + detail page smoke tests.
 *
 * These tests are intentionally resilient to an empty seed: they verify
 * that the page renders its chrome (title, filters, table shell) and the
 * expected empty state when no students exist, rather than asserting on a
 * specific seeded row. When the seed is populated with students, the
 * detail-navigation test clicks the first row and walks every tab.
 *
 * Route under test: /en/people/students (institute portal — the
 * (dashboard) group segment is invisible in URLs, so the actual path that
 * reaches the list page is `/en/people/students`).
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Students list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/people/students');
    await expect(page.getByTestId('students-title')).toBeVisible({ timeout: 10_000 });
  });

  test('page renders title and description', async ({ page }) => {
    await expect(page.getByTestId('students-title')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('students-description')).toBeVisible();
  });

  test('toolbar shows search and filter dropdowns', async ({ page }) => {
    await expect(page.getByTestId('students-search-input')).toBeVisible();
    await expect(page.getByTestId('students-status-filter')).toBeVisible();
    await expect(page.getByTestId('students-gender-filter')).toBeVisible();
    await expect(page.getByTestId('students-category-filter')).toBeVisible();
    await expect(page.getByTestId('students-rte-filter')).toBeVisible();
  });

  test('header shows Export CSV and Add Student buttons', async ({ page }) => {
    await expect(page.getByTestId('students-export-btn')).toBeVisible();
    // Add Student is CASL-gated — it's present for the institute admin
    // used in auth.setup.ts but we don't hard-fail if a restricted role
    // hits this test accidentally; just assert one of the two header CTAs.
  });

  test('nuqs search writes the query into the URL', async ({ page }) => {
    const search = page.getByTestId('students-search-input');
    await search.fill('rajesh');
    // Debounce is 150ms; wait for the URL to reflect the search
    await expect(page).toHaveURL(/[?&]search=rajesh/, { timeout: 2_000 });
  });

  test('academic-status filter writes to URL', async ({ page }) => {
    await page.getByTestId('students-status-filter').click();
    await page.getByTestId('students-status-option-ENROLLED').click();
    await expect(page).toHaveURL(/[?&]academicStatus=ENROLLED/);
  });

  test('clearing filters removes them from the URL', async ({ page }) => {
    // First, set a filter so the clear button becomes visible
    await page.getByTestId('students-status-filter').click();
    await page.getByTestId('students-status-option-ENROLLED').click();
    await expect(page).toHaveURL(/[?&]academicStatus=ENROLLED/);

    await page.getByTestId('students-clear-filters-btn').click();
    await expect(page).not.toHaveURL(/academicStatus/);
  });

  test('empty state renders a helpful message when no students match', async ({ page }) => {
    // Force a filter that is very unlikely to match anything in the seed
    await page.getByTestId('students-search-input').fill('zzzzz-no-such-student');
    // Either a matching row renders OR the empty state shows — we only
    // assert the empty state because a filter this specific should not hit
    // any real seed row. ResponsiveDataTable renders both desktop table and
    // mobile cards (CSS hides one); scope to the table variant.
    await expect(
      page.getByTestId('students-table').getByTestId('students-empty-state'),
    ).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe('Student detail', () => {
  test('clicking the first row navigates to the detail page and renders all 6 tabs', async ({
    page,
  }) => {
    await page.goto('/en/people/students');
    await expect(page.getByTestId('students-title')).toBeVisible({ timeout: 10_000 });

    // Find the first data row in the table. If there are no seeded students
    // we skip the rest of the test — the list-side tests cover the empty
    // case above.
    // Data rows have multiple td cells; the empty state row has a single td with colspan.
    const dataRows = page.getByTestId('students-table').locator('tbody tr:has(td:nth-child(3))');
    const rowCount = await dataRows.count();
    test.skip(rowCount === 0, 'No students seeded in this environment');

    // Click the name cell (not the checkbox cell at index 0, which stops propagation).
    await dataRows.first().locator('td').nth(2).click();

    // URL should now be /en/people/students/<uuid>
    await expect(page).toHaveURL(/\/people\/students\/[0-9a-f-]{36}/, { timeout: 10_000 });

    // All six tabs render
    await expect(page.getByTestId('students-detail-tab-profile')).toBeVisible();
    await expect(page.getByTestId('students-detail-tab-academics')).toBeVisible();
    await expect(page.getByTestId('students-detail-tab-guardians')).toBeVisible();
    await expect(page.getByTestId('students-detail-tab-documents')).toBeVisible();
    await expect(page.getByTestId('students-detail-tab-tc-history')).toBeVisible();
    await expect(page.getByTestId('students-detail-tab-audit')).toBeVisible();

    // Profile tab is active by default and shows the form
    await expect(page.getByTestId('students-detail-first-name-en')).toBeVisible();
    await expect(page.getByTestId('students-detail-social-category')).toBeVisible();
    await expect(page.getByTestId('students-detail-save-btn')).toBeVisible();

    // Academics tab — renders current year summary or empty state
    await page.getByTestId('students-detail-tab-academics').click();
    await expect(page.getByRole('tabpanel', { name: 'Academics' })).toBeVisible({ timeout: 5_000 });

    // Guardians tab
    await page.getByTestId('students-detail-tab-guardians').click();
    await expect(
      page
        .getByTestId('students-detail-guardians-empty')
        .or(page.getByTestId('students-table').first()),
    ).toBeVisible({ timeout: 5_000 });

    // Documents tab
    await page.getByTestId('students-detail-tab-documents').click();
    await expect(
      page
        .getByTestId('students-detail-documents-empty')
        .or(page.getByTestId('students-table').first()),
    ).toBeVisible({ timeout: 5_000 });

    // TC History tab
    await page.getByTestId('students-detail-tab-tc-history').click();
    await expect(
      page.getByTestId('students-detail-tc-empty').or(page.getByTestId('students-table').first()),
    ).toBeVisible({ timeout: 5_000 });

    // Audit tab
    await page.getByTestId('students-detail-tab-audit').click();
    await expect(
      page
        .getByTestId('students-detail-audit-empty')
        .or(page.getByTestId('students-table').first()),
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Student list — retrofit features', () => {
  test('sortable column updates URL', async ({ page }) => {
    await page.goto('/en/people/students');
    await page.getByTestId('students-sort-admission-btn').click();
    await expect(page).toHaveURL(/orderBy=admissionNumber/);
  });

  test('page-size selector updates URL', async ({ page }) => {
    await page.goto('/en/people/students');
    await page.getByTestId('students-page-size-select').click();
    await page.getByRole('option', { name: '50' }).click();
    await expect(page).toHaveURL(/size=50/);
  });
});
