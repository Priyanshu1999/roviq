/**
 * Guardian detail page — rendering, tab switching, edit, dropdown, and
 * not-found empty state.
 *
 * Prereq: each test creates a fresh guardian via the UI so there is no
 * shared state with other specs. We do not use the GraphQL helper here
 * because a reliable helper does not exist in this project yet.
 */
import { expect, test } from '../../shared/console-guardian';
import { EDUCATION_LEVEL_LABELS_EN, GuardianCreatePage } from './pages/GuardianCreatePage';
import { GuardianDetailPage } from './pages/GuardianDetailPage';

async function createGuardianViaUI(
  page: import('@playwright/test').Page,
  firstName: string,
): Promise<string> {
  const create = new GuardianCreatePage(page);
  await create.goto('en');
  await create.fillFirstNameEnglish(firstName);
  await create.submit();
  await create.expectRedirectedToDetail();
  const url = new URL(page.url());
  const segments = url.pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1];
  if (!id) {
    throw new Error(`Could not extract guardian id from URL: ${page.url()}`);
  }
  return id;
}

test.describe('Guardians — detail page', () => {
  test('detail page renders name, sidebar, and three tabs', async ({ page }) => {
    const firstName = `Detail ${Date.now()}`;
    await createGuardianViaUI(page, firstName);

    const detail = new GuardianDetailPage(page);
    // Already on detail page after create redirect.
    await expect(detail.profileTab()).toBeVisible();
    await expect(detail.childrenTab()).toBeVisible();
    await expect(detail.auditTab()).toBeVisible();
    await detail.expectProfileTabActive();

    // Sidebar shows the guardian's name.
    await expect(page.locator('[data-test-id="guardian-detail-title"]')).toContainText(firstName);
  });

  test('tab switching activates each tab', async ({ page }) => {
    const id = await createGuardianViaUI(page, `TabSwitch ${Date.now()}`);

    const detail = new GuardianDetailPage(page);
    await detail.gotoById(id, 'en');

    await detail.clickChildrenTab();
    await detail.expectChildrenTabActive();

    await detail.clickAuditTab();
    await detail.expectAuditTabActive();

    await detail.clickProfileTab();
    await detail.expectProfileTabActive();
  });

  test('editing occupation persists after save and reload', async ({ page }) => {
    const _id = await createGuardianViaUI(page, `Edit ${Date.now()}`);
    const detail = new GuardianDetailPage(page);

    const newOccupation = `Architect ${Date.now()}`;
    await detail.occupationInput().fill(newOccupation);
    await detail.saveButton().click();

    // Success toast — use stable sonner toast attribute.
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();

    // Reload and verify persistence.
    await page.reload();
    await expect(detail.occupationInput()).toHaveValue(newOccupation);
  });

  test('education level on detail page is a Select with all 6 options', async ({ page }) => {
    const id = await createGuardianViaUI(page, `EduDetail ${Date.now()}`);
    const detail = new GuardianDetailPage(page);
    await detail.gotoById(id, 'en');

    // After the dropdown fix lands, the education level control is a
    // combobox. This test asserts that shape — it is the canonical guard
    // against regressing back to a plain text input.
    const combobox = detail.educationLevelCombobox();
    await expect(combobox).toBeVisible();
    await combobox.click();

    for (const [, label] of Object.entries(EDUCATION_LEVEL_LABELS_EN)) {
      await expect(page.getByRole('option', { name: label, exact: true })).toBeVisible();
    }
  });

  test('not-found UUID renders the empty state', async ({ page }) => {
    const detail = new GuardianDetailPage(page);
    // Random UUID that will not exist.
    await detail.gotoById('00000000-0000-0000-0000-000000000000', 'en');
    await expect(detail.notFoundTitle()).toBeVisible();
  });
});
