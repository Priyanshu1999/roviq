import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/login');
  });

  test('renders login form with all fields', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Sign in to your account to continue')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your Roviq ID')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Roviq ID is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.getByPlaceholder('Enter your Roviq ID').fill('wronguser');
    await page.getByPlaceholder('Enter your password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('.text-destructive').first()).toBeVisible({ timeout: 10_000 });
  });

  test('single-org user logs in and redirects to dashboard', async ({ page }) => {
    await page.getByPlaceholder('Enter your Roviq ID').fill('teacher1');
    await page.getByPlaceholder('Enter your password').fill('teacher123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('multi-org user logs in and sees org picker', async ({ page }) => {
    await page.getByPlaceholder('Enter your Roviq ID').fill('admin');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/select-org/, { timeout: 15_000 });
    await expect(page.getByText('Select Organization')).toBeVisible();
    await expect(page.getByText('Demo Institute')).toBeVisible();
    await expect(page.getByText('Second Institute')).toBeVisible();
  });

  test('multi-org user selects org and reaches dashboard', async ({ page }) => {
    await page.getByPlaceholder('Enter your Roviq ID').fill('admin');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/select-org/, { timeout: 15_000 });
    await page.getByRole('button', { name: /Demo Institute/ }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});
