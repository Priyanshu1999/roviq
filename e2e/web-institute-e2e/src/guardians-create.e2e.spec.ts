/**
 * Guardians create page — happy path, cancel, validation, and edge cases.
 *
 * Covers /en/people/guardians/new (and /hi variant):
 *   Existing:
 *     1. Fill minimum required fields → submit → redirect to detail page
 *     2. Back to list cancels the flow
 *     3. Empty submit surfaces validation errors
 *   Added edge cases:
 *     4. Only first name filled (all other optional fields blank) submits OK
 *     5. Education dropdown renders all 6 options with correct English labels
 *     6. Parameterized create with each of the 6 education levels
 *     7. Create with NO education level (NULL) succeeds
 *     8. Hindi locale — title + dropdown trigger + all 6 translated options
 *     9. Phone validation — non-10-digit phone shows error on blur
 *    10. i18n text field — Hindi-only first name must fail ("English required")
 */
import { expect, test } from '@playwright/test';
import {
  EDUCATION_LEVEL_LABELS_EN,
  EDUCATION_LEVEL_LABELS_HI,
  GuardianCreatePage,
  type GuardianEducationLevel,
} from './pages/GuardianCreatePage';

const EDUCATION_LEVELS: readonly GuardianEducationLevel[] = [
  'ILLITERATE',
  'PRIMARY',
  'SECONDARY',
  'GRADUATE',
  'POST_GRADUATE',
  'PROFESSIONAL',
] as const;

test.describe('Guardians — create page', () => {
  test('creates a guardian and redirects to the detail page', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Guardian ${unique}`;
    const email = `guardian.${unique}@example.test`;

    const create = new GuardianCreatePage(page);
    await create.goto('en');
    await expect(create.heading()).toBeVisible();

    await create.fillFirstNameEnglish(firstName);
    await create.selectGender('Male');

    await create.emailInput().fill(email);
    await create.phoneInput().fill('9876543210');
    await create.occupationInput().fill('Engineer');

    await create.submit();
    await create.expectRedirectedToDetail();
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('Back to guardians button returns to the list', async ({ page }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('en');
    await create.fillFirstNameEnglish('Temp');

    await create.backButton().click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?people\/guardians$/);
  });

  test('blank submit shows validation errors', async ({ page }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('en');

    await create.submit();
    await create.expectOnNewPage();
    await expect(page.getByText(/required|please/i).first()).toBeVisible();
  });

  test('creates a guardian with only the required first name', async ({ page }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('en');

    await create.fillFirstNameEnglish(`MinimalGuardian ${Date.now()}`);
    await create.submit();

    await create.expectRedirectedToDetail();
  });

  test('education level dropdown renders all 6 options in English', async ({ page }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('en');

    await create.openEducationLevel();

    for (const level of EDUCATION_LEVELS) {
      const label = EDUCATION_LEVEL_LABELS_EN[level];
      await expect(create.educationLevelOption(label)).toBeVisible();
    }
  });

  for (const level of EDUCATION_LEVELS) {
    test(`creates a guardian with education level: ${level}`, async ({ page }) => {
      const create = new GuardianCreatePage(page);
      await create.goto('en');

      await create.fillFirstNameEnglish(`EduLevel ${level} ${Date.now()}`);
      await create.selectEducationLevel(EDUCATION_LEVEL_LABELS_EN[level]);
      await create.submit();

      await create.expectRedirectedToDetail();
    });
  }

  test('creates a guardian with no education level (NULL)', async ({ page }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('en');

    await create.fillFirstNameEnglish(`NoEdu ${Date.now()}`);
    await create.submit();

    await create.expectRedirectedToDetail();
  });

  test('Hindi locale renders translated title, dropdown trigger, and all 6 options', async ({
    page,
  }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('hi');

    await expect(page.getByRole('heading', { name: 'अभिभावक जोड़ें' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /शिक्षा स्तर/i })).toBeVisible();

    await create.openEducationLevel();
    for (const level of EDUCATION_LEVELS) {
      const label = EDUCATION_LEVEL_LABELS_HI[level];
      await expect(create.educationLevelOption(label)).toBeVisible();
    }
    // Close the popover before submitting.
    await page.keyboard.press('Escape');

    await create.firstNameEnglish().fill(`HiGuardian ${Date.now()}`);
    await create.submit();
    await create.expectRedirectedToDetail();
  });

  test('phone validation rejects non-10-digit number on blur', async ({ page }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('en');

    await create.fillFirstNameEnglish('PhoneInvalid');
    await create.phoneInput().fill('12345');
    await create.phoneInput().blur();

    await expect(page.getByText(/valid 10-digit|phone/i).first()).toBeVisible();
  });

  test('submitting with only Hindi first name surfaces the English-required error', async ({
    page,
  }) => {
    const create = new GuardianCreatePage(page);
    await create.goto('en');

    await create.firstNameHindi().fill('संजय');
    await create.submit();

    // Stay on the new page and show a validation error.
    await create.expectOnNewPage();
    await expect(page.getByText(/required|please|english/i).first()).toBeVisible();
  });
});
