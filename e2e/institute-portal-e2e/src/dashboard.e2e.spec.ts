import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function loginAsAdmin(page: Page) {
  await page.goto('/en/login');
  await page.getByPlaceholder('Enter your Roviq ID').fill('admin');
  await page.getByPlaceholder('Enter your password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/select-institute/, { timeout: 15_000 });
  await page.getByRole('button', { name: /Saraswati Vidya Mandir/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('shows welcome card with setup instructions', async ({ page }) => {
    await expect(page.getByText(/welcome/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/get started/i)).toBeVisible();
  });

  test('Get Started section shows 3 CTAs', async ({ page }) => {
    await expect(page.getByText(/students/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/teachers/i).first()).toBeVisible();
    await expect(page.getByText(/standards/i).first()).toBeVisible();
  });

  test('Quick Links section shows 4 links', async ({ page }) => {
    const quickLinksSection = page.getByText(/quick links/i);
    await expect(quickLinksSection).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('link', { name: /standards/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /subjects/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /users/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('quick links navigate to correct pages', async ({ page }) => {
    await page
      .getByRole('link', { name: /standards/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/academics/, { timeout: 10_000 });

    await page.goto('/en/dashboard');
    await page.waitForLoadState('networkidle');

    await page
      .getByRole('link', { name: /settings/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });
  });
});
