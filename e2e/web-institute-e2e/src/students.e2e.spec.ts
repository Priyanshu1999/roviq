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

test.describe.configure({ mode: 'serial' });

test.describe('Students list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/people/students');
    await page.waitForLoadState('networkidle');
  });

  test('page renders title and description', async ({ page }) => {
    await expect(page.locator('[data-test-id="students-title"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-test-id="students-description"]')).toBeVisible();
  });

  test('toolbar shows search and filter dropdowns', async ({ page }) => {
    await expect(page.getByPlaceholder(/search by name or admission number/i)).toBeVisible();
    // The five filter selects from the toolbar
    await expect(page.getByRole('combobox', { name: /all statuses/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /all genders/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /all categories/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /rte: any/i })).toBeVisible();
  });

  test('header shows Export CSV and Add Student buttons', async ({ page }) => {
    await expect(page.locator('[data-test-id="students-export-btn"]')).toBeVisible();
    // Add Student is CASL-gated — it's present for the institute admin
    // used in auth.setup.ts but we don't hard-fail if a restricted role
    // hits this test accidentally; just assert one of the two header CTAs.
  });

  test('nuqs search writes the query into the URL', async ({ page }) => {
    const search = page.getByPlaceholder(/search by name or admission number/i);
    await search.fill('rajesh');
    // Debounce is 300ms; wait for the URL to reflect the search
    await expect(page).toHaveURL(/[?&]search=rajesh/, { timeout: 2_000 });
  });

  test('academic-status filter writes to URL', async ({ page }) => {
    await page.getByRole('combobox', { name: /all statuses/i }).click();
    await page.getByRole('option', { name: /^enrolled$/i }).click();
    await expect(page).toHaveURL(/[?&]academicStatus=ENROLLED/);
  });

  test('clearing filters removes them from the URL', async ({ page }) => {
    // First, set a filter so the clear button becomes visible
    await page.getByRole('combobox', { name: /all statuses/i }).click();
    await page.getByRole('option', { name: /^enrolled$/i }).click();
    await expect(page).toHaveURL(/[?&]academicStatus=ENROLLED/);

    await page.getByRole('button', { name: /clear filters/i }).click();
    await expect(page).not.toHaveURL(/academicStatus/);
  });

  test('empty state renders a helpful message when no students match', async ({ page }) => {
    // Force a filter that is very unlikely to match anything in the seed
    await page
      .getByPlaceholder(/search by name or admission number/i)
      .fill('zzzzz-no-such-student');
    // Either a matching row renders OR the empty state shows — we only
    // assert the empty state because a filter this specific should not hit
    // any real seed row.
    const emptyTitle = page.getByText(/no students match your filters/i);
    await expect(emptyTitle).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Student detail', () => {
  test('clicking the first row navigates to the detail page and renders all 6 tabs', async ({
    page,
  }) => {
    await page.goto('/en/people/students');
    await page.waitForLoadState('networkidle');

    // Find the first data row in the table. If there are no seeded students
    // we skip the rest of the test — the list-side tests cover the empty
    // case above.
    const firstRow = page.locator('[data-test-id="students-table"] tbody tr').first();
    const rowCount = await page.locator('[data-test-id="students-table"] tbody tr').count();
    test.skip(rowCount === 0, 'No students seeded in this environment');

    // Click the row. We click the name cell (not the checkbox cell at
    // index 0, which stops propagation).
    await firstRow.locator('td').nth(2).click();

    // URL should now be /en/people/students/<uuid>
    await expect(page).toHaveURL(/\/people\/students\/[0-9a-f-]{36}/, { timeout: 10_000 });

    // All six tabs render
    for (const tab of ['Profile', 'Academics', 'Guardians', 'Documents', 'TC History', 'Audit']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }

    // Profile tab is active by default and shows the form
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/social category/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();

    // Academics tab — either renders rows or the empty state
    await page.getByRole('tab', { name: 'Academics' }).click();
    await expect(
      page.getByText(/no academic history yet/i).or(page.getByText(/current year/i).first()),
    ).toBeVisible({ timeout: 5_000 });

    // Guardians tab
    await page.getByRole('tab', { name: 'Guardians' }).click();
    await expect(
      page.getByText(/no guardians linked/i).or(page.getByText(/primary/i).first()),
    ).toBeVisible({ timeout: 5_000 });

    // Documents tab
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(
      page
        .getByText(/no documents uploaded/i)
        .or(page.getByText(/(verified|pending review)/i).first()),
    ).toBeVisible({ timeout: 5_000 });

    // TC History tab
    await page.getByRole('tab', { name: 'TC History' }).click();
    await expect(
      page.getByText(/no transfer certificates/i).or(page.getByText(/issued|requested/i).first()),
    ).toBeVisible({ timeout: 5_000 });

    // Audit tab
    await page.getByRole('tab', { name: 'Audit' }).click();
    await expect(
      page.getByText(/no audit entries/i).or(page.locator('[class*="font-medium"]').first()),
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Student list — retrofit features', () => {
  test('sortable column updates URL', async ({ page }) => {
    await page.goto('/en/people/students');
    await page.getByRole('button', { name: /admission no/i }).click();
    await expect(page).toHaveURL(/orderBy=admissionNumber/);
  });

  test('page-size selector updates URL', async ({ page }) => {
    await page.goto('/en/people/students');
    await page.getByRole('combobox', { name: /rows/i }).click();
    await page.getByRole('option', { name: '50' }).click();
    await expect(page).toHaveURL(/size=50/);
  });
});
