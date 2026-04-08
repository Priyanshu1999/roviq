import { expect, test } from '@playwright/test';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';
import { SEED } from '../../shared/seed';

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
    await expect(page.locator('.text-destructive').first()).toBeVisible({ timeout: 10_000 });
  });

  test('single-institute user logs in and redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(E2E_USERS.TEACHER.username, E2E_USERS.TEACHER.password);
    await loginPage.expectRedirectToDashboard();
  });

  test('multi-institute user logs in and sees institute picker', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(E2E_USERS.INSTITUTE_ADMIN.username, E2E_USERS.INSTITUTE_ADMIN.password);
    await expect(page).toHaveURL(/\/select-institute/, { timeout: 15_000 });
    await expect(page.getByText('Select Institute')).toBeVisible();
    await expect(page.getByText(SEED.INSTITUTE_1.name)).toBeVisible();
    await expect(page.getByText(SEED.INSTITUTE_2.name)).toBeVisible();
  });

  test('multi-institute user selects institute and reaches dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(E2E_USERS.INSTITUTE_ADMIN.username, E2E_USERS.INSTITUTE_ADMIN.password);
    await loginPage.selectInstitute(SEED.INSTITUTE_1.name);
    await loginPage.expectRedirectToDashboard();
  });
});
