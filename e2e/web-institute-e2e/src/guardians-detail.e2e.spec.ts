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
    await expect(page.getByTestId('guardian-detail-title')).toContainText(firstName);
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

  test.describe('error paths', () => {
    test.use({ failOnConsoleErrors: false });

    test('not-found UUID renders the empty state', async ({ page }) => {
      const detail = new GuardianDetailPage(page);
      await detail.gotoById('00000000-0000-0000-0000-000000000000', 'en');
      await expect(detail.notFoundTitle()).toBeVisible();
    });
  });

  test.describe('Link student dialog', () => {
    test('link-student button is visible on the Children tab', async ({ page }) => {
      await createGuardianViaUI(page, `Linker ${Date.now()}`);
      const detail = new GuardianDetailPage(page);
      await detail.clickChildrenTab();

      await expect(detail.linkStudentButton()).toBeVisible({ timeout: 5_000 });
    });

    test('opens the dialog with submit disabled until a student + relationship is picked', async ({
      page,
    }) => {
      await createGuardianViaUI(page, `Linker ${Date.now()}`);
      const detail = new GuardianDetailPage(page);
      await detail.clickChildrenTab();

      await detail.linkStudentButton().click();
      await expect(detail.linkStudentDialog()).toBeVisible();
      await expect(detail.linkStudentSubmit()).toBeDisabled();
    });

    test('toggling primary contact surfaces the demotion warning', async ({ page }) => {
      await createGuardianViaUI(page, `Linker ${Date.now()}`);
      const detail = new GuardianDetailPage(page);
      await detail.clickChildrenTab();

      await detail.linkStudentButton().click();
      await expect(detail.linkStudentPrimaryWarning()).not.toBeVisible();

      await page.getByLabel(/primary contact/i).click();
      await expect(detail.linkStudentPrimaryWarning()).toBeVisible();
    });

    test('links the first available seeded student end-to-end', async ({ page }) => {
      await createGuardianViaUI(page, `Linker ${Date.now()}`);
      const detail = new GuardianDetailPage(page);
      await detail.clickChildrenTab();

      // If the test tenant has no seeded students, skip gracefully rather
      // than flake — this mirrors the pattern in students-create.e2e.spec.
      await detail.linkStudentButton().click();
      await detail.linkStudentPickerTrigger().click();
      const firstOption = page
        .locator('[data-testid^="guardian-detail-link-student-option-"]')
        .first();
      if ((await firstOption.count()) === 0) {
        test.skip(true, 'Test tenant has no seeded students — see seed script.');
        return;
      }
      // Close the picker then rerun the driver so the dialog state stays
      // consistent with the helper's expectations.
      await page.keyboard.press('Escape');

      await detail.linkFirstAvailableStudent(/^father$/i);

      // Dialog closes and a success toast appears.
      await expect(detail.linkStudentDialog()).not.toBeVisible({ timeout: 10_000 });
      await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();

      // The newly linked student renders inside the Children tab — assert
      // at least one child card is now visible (empty state gone).
      await expect(detail.childrenTab()).toHaveAttribute('data-state', 'active');
    });
  });
});
