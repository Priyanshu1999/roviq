import { expect, test } from '@playwright/test';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';

test.describe.configure({ mode: 'serial' });

test.describe('Admin Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/login');
  });

  test('renders login form with all fields', async ({ page }) => {
    await expect(page.getByText('Platform Admin', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Sign in to manage the Roviq platform.')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your Roviq ID')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Roviq ID is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.getByPlaceholder('Enter your Roviq ID').fill('wronguser');
    await page.getByPlaceholder('Enter your password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('.text-destructive').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('admin logs in and redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(E2E_USERS.PLATFORM_ADMIN.username, E2E_USERS.PLATFORM_ADMIN.password);
    await loginPage.expectRedirectToDashboard();
  });
});
