/**
 * Staff create page — happy path, cancel, and validation.
 *
 * Covers /en/people/staff/new:
 *   1. Fill minimum required fields → submit → redirect to detail page
 *   2. Back to list cancels the flow
 *   3. Empty submit surfaces validation errors
 */
import { expect, test } from '../../shared/console-guardian';

test.describe('Staff — create page', () => {
  test('creates a staff member and redirects to the detail page', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Teacher ${unique}`;
    const email = `teacher.${unique}@example.test`;

    await page.goto('/en/people/staff/new');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // I18nInput renders a labeled textbox per locale; English is always required.
    await page.getByRole('textbox', { name: /first name.*english/i }).fill(firstName);

    await page.getByRole('combobox', { name: /gender/i }).click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /phone/i }).fill('9876543210');
    await page.getByRole('textbox', { name: /designation/i }).fill('Senior Teacher');

    await page.getByRole('combobox', { name: /department/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('combobox', { name: /employment type/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page).toHaveURL(/\/(institute\/)?people\/staff\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('Back to staff button returns to the list', async ({ page }) => {
    await page.goto('/en/people/staff/new');

    await page.getByRole('textbox', { name: /first name.*english/i }).fill('Temp');

    await page.getByRole('button', { name: /back to staff/i }).click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?people\/staff$/);
  });

  test('blank submit shows validation errors', async ({ page }) => {
    await page.goto('/en/people/staff/new');

    await page.getByRole('button', { name: /create/i }).click();

    // At least one field error should surface; react-hook-form exposes them via role=alert
    // or inline FieldError. Either way the page must not redirect away from /new.
    await expect(page).toHaveURL(/\/people\/staff\/new/);
    await expect(page.getByText(/required|please/i).first()).toBeVisible();
  });

  test('newly created staff appears in the list (cache freshness)', async ({ page }) => {
    const unique = Date.now();
    const firstName = `CacheFresh ${unique}`;
    const email = `cachefresh.${unique}@example.test`;

    await page.goto('/en/people/staff/new');
    await page.getByRole('textbox', { name: /first name.*english/i }).fill(firstName);
    await page.getByRole('combobox', { name: /gender/i }).click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /phone/i }).fill('9876543210');
    await page.getByRole('textbox', { name: /designation/i }).fill('Teacher');
    await page.getByRole('combobox', { name: /department/i }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('combobox', { name: /employment type/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /create/i }).click();
    await expect(page).toHaveURL(/\/people\/staff\/[0-9a-f-]{36}/);

    // Navigate to list and search for the created staff
    await page.goto('/en/people/staff');
    await page.getByPlaceholder(/search by name or employee id/i).fill(firstName);
    await expect(page.getByText(firstName)).toBeVisible({ timeout: 10_000 });
  });

  test('filled fields survive validation errors', async ({ page }) => {
    const email = `preserve.${Date.now()}@example.test`;
    const designation = 'Senior Teacher';

    await page.goto('/en/people/staff/new');

    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /phone/i }).fill('9876543210');
    await page.getByRole('textbox', { name: /designation/i }).fill(designation);

    // Submit without required fields (first name, gender, department, employment type)
    await page.getByRole('button', { name: /create/i }).click();

    // Still on the form
    await expect(page).toHaveURL(/\/people\/staff\/new/);
    await expect(page.getByText(/required|please/i).first()).toBeVisible();

    // Fields must retain their values
    await expect(page.getByRole('textbox', { name: /email/i })).toHaveValue(email);
    await expect(page.getByRole('textbox', { name: /phone/i })).toHaveValue('9876543210');
    await expect(page.getByRole('textbox', { name: /designation/i })).toHaveValue(designation);
  });
});
