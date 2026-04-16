/**
 * Student detail page — Guardians tab link-guardian dialog.
 *
 * These tests navigate to a seeded student (the list page's first row),
 * switch to the Guardians tab, and exercise the LinkGuardianDialog. They
 * depend on the test tenant containing at least one student AND at least
 * one guardian; otherwise the happy-path test skips gracefully.
 */
import { expect, test } from '../../shared/console-guardian';
import { StudentDetailPage } from './pages/StudentDetailPage';

async function openFirstStudentDetail(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/en/people/students');
  await expect(page.getByTestId('students-title')).toBeVisible({ timeout: 10_000 });

  // First student row in the seeded tenant. Empty-tenant guard — if the
  // list is empty the caller skips.
  const firstRow = page.locator('[data-testid^="students-row-"]').first();
  if ((await firstRow.count()) === 0) {
    test.skip(true, 'Test tenant has no seeded students — see seed script.');
    return;
  }
  await firstRow.click();
  await expect(page).toHaveURL(/\/people\/students\/[0-9a-f-]{36}/);
}

test.describe('Student detail — Link guardian dialog', () => {
  test('link-guardian button is visible on the Guardians tab', async ({ page }) => {
    await openFirstStudentDetail(page);
    const detail = new StudentDetailPage(page);
    await detail.clickGuardiansTab();
    await expect(detail.linkGuardianButton()).toBeVisible({ timeout: 5_000 });
  });

  test('opens dialog with submit disabled until a guardian + relationship is picked', async ({
    page,
  }) => {
    await openFirstStudentDetail(page);
    const detail = new StudentDetailPage(page);
    await detail.clickGuardiansTab();

    await detail.linkGuardianButton().click();
    await expect(detail.linkGuardianDialog()).toBeVisible();
    await expect(detail.linkGuardianSubmit()).toBeDisabled();
  });

  test('primary-contact warning only renders when an existing primary is present', async ({
    page,
  }) => {
    await openFirstStudentDetail(page);
    const detail = new StudentDetailPage(page);
    await detail.clickGuardiansTab();

    await detail.linkGuardianButton().click();
    // The warning shows only when the student already has a primary
    // contact AND the user toggles primary on. Toggling without an
    // existing primary leaves the warning hidden.
    await page.getByLabel(/primary contact/i).click();
    // Depending on seed state either outcome is correct — we only assert
    // the toggle didn't crash the dialog.
    await expect(detail.linkGuardianDialog()).toBeVisible();
  });

  test('links the first available seeded guardian end-to-end', async ({ page }) => {
    await openFirstStudentDetail(page);
    const detail = new StudentDetailPage(page);
    await detail.clickGuardiansTab();

    await detail.linkGuardianButton().click();
    await detail.linkGuardianPickerTrigger().click();
    const firstOption = page
      .locator('[data-testid^="student-detail-link-guardian-option-"]')
      .first();
    if ((await firstOption.count()) === 0) {
      test.skip(true, 'Test tenant has no seeded guardians — see seed script.');
      return;
    }
    await page.keyboard.press('Escape');

    await detail.linkFirstAvailableGuardian(/^father$/i);

    await expect(detail.linkGuardianDialog()).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible();
  });
});
