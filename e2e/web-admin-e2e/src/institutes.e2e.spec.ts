import { testIds } from '@roviq/ui/testing/testid-registry';
import { expect, test } from '../../shared/console-guardian';
import { SEED, SEED_IDS } from '../../shared/seed-fixtures';

test.describe('Admin Institutes', () => {
  test.describe('Institutes list', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/en/admin/institutes');
    });

    test('page loads with title and description', async ({ page }) => {
      await expect(page.getByTestId(testIds.adminInstitutes.title)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstitutes.description)).toBeVisible();
    });

    test('table displays correct column headers', async ({ page }) => {
      // Wait for the table to render (either data or skeleton)
      await expect(page.getByTestId(testIds.adminInstitutes.table)).toBeVisible({
        timeout: 15_000,
      });

      await expect(page.getByTestId(testIds.adminInstitutes.colName)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstitutes.colCode)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstitutes.colType)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstitutes.colStatus)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstitutes.colReseller)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstitutes.colGroup)).toBeVisible();
    });

    test('shows at least 2 seeded institutes', async ({ page }) => {
      // Wait for table rows to load
      await expect(
        page.getByTestId(testIds.adminInstitutes.nameCell(SEED_IDS.INSTITUTE_1)),
      ).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByTestId(testIds.adminInstitutes.nameCell(SEED_IDS.INSTITUTE_2)),
      ).toBeVisible();
    });

    test('"Pending Approval" tab is visible', async ({ page }) => {
      await expect(page.getByTestId(testIds.adminInstitutes.tabPending)).toBeVisible();
    });

    test('clicking an institute row navigates to detail page', async ({ page }) => {
      const nameCell = page.getByTestId(testIds.adminInstitutes.nameCell(SEED_IDS.INSTITUTE_1));
      await expect(nameCell).toBeVisible({ timeout: 15_000 });
      await nameCell.click();
      await expect(page).toHaveURL(/\/institutes\/[a-f0-9-]+/, { timeout: 10_000 });
    });
  });

  test.describe('Institute detail', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to detail via the list to get a valid institute ID
      await page.goto('/en/admin/institutes');
      const nameCell = page.getByTestId(testIds.adminInstitutes.nameCell(SEED_IDS.INSTITUTE_1));
      await expect(nameCell).toBeVisible({ timeout: 15_000 });
      await nameCell.click();
      await expect(page).toHaveURL(/\/institutes\/[a-f0-9-]+/, { timeout: 10_000 });
    });

    test('detail page loads with institute name as heading', async ({ page }) => {
      await expect(page.getByTestId(testIds.adminInstituteDetail.title)).toBeVisible({
        timeout: 10_000,
      });
    });

    test('breadcrumb shows institute name', async ({ page }) => {
      await expect(page.getByTestId(testIds.adminInstituteDetail.title)).toBeVisible({
        timeout: 10_000,
      });
      // Breadcrumb navigation should contain the institute name. Both mobile +
      // desktop variants render in DOM (CSS hides one); scope to desktop since
      // the test runs at desktop viewport.
      const breadcrumbs = page.getByTestId(testIds.layout.breadcrumbsDesktop);
      await expect(breadcrumbs.getByText(SEED.INSTITUTE_1.name)).toBeVisible();
    });

    test('Overview tab shows Identity, Contact, and Address sections', async ({ page }) => {
      // Overview tab is active by default
      await expect(page.getByTestId(testIds.adminInstituteDetail.tabOverview)).toBeVisible({
        timeout: 10_000,
      });

      // Identity card
      await expect(page.getByTestId(testIds.adminInstituteDetail.identityTitle)).toBeVisible();

      // Contact card
      await expect(page.getByTestId(testIds.adminInstituteDetail.contactTitle)).toBeVisible();

      // Address card
      await expect(page.getByTestId(testIds.adminInstituteDetail.addressTitle)).toBeVisible();
    });

    test('has expected tabs', async ({ page }) => {
      await expect(page.getByTestId(testIds.adminInstituteDetail.tabOverview)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByTestId(testIds.adminInstituteDetail.tabAcademic)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstituteDetail.tabConfig)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstituteDetail.tabBranding)).toBeVisible();
      await expect(page.getByTestId(testIds.adminInstituteDetail.tabAudit)).toBeVisible();
      // Setup Progress tab may or may not be visible depending on institute status
    });
  });
});
