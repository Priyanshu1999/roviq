/**
 * Guardians create page — happy path, cancel, and validation.
 *
 * Covers /en/people/guardians/new:
 *   1. Fill minimum required fields → submit → redirect to detail page
 *   2. Back to list cancels the flow
 *   3. Empty submit surfaces validation errors
 */
import { expect, test } from '@playwright/test';

test.describe('Guardians — create page', () => {
  test('creates a guardian and redirects to the detail page', async ({ page }) => {
    const unique = Date.now();
    const firstName = `Guardian ${unique}`;
    const email = `guardian.${unique}@example.test`;

    await page.goto('/en/people/guardians/new');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('textbox', { name: /first name.*english/i }).fill(firstName);

    await page.getByRole('combobox', { name: /gender/i }).click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /phone/i }).fill('9876543210');
    await page.getByRole('textbox', { name: /occupation/i }).fill('Engineer');

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page).toHaveURL(/\/(institute\/)?people\/guardians\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('Back to guardians button returns to the list', async ({ page }) => {
    await page.goto('/en/people/guardians/new');

    await page.getByRole('textbox', { name: /first name.*english/i }).fill('Temp');

    await page.getByRole('button', { name: /back to guardians/i }).click();
    await expect(page).toHaveURL(/\/(en\/)?(institute\/)?people\/guardians$/);
  });

  test('blank submit shows validation errors', async ({ page }) => {
    await page.goto('/en/people/guardians/new');

    await page.getByRole('button', { name: /create/i }).click();

    await expect(page).toHaveURL(/\/people\/guardians\/new/);
    await expect(page.getByText(/required|please/i).first()).toBeVisible();
  });
});
