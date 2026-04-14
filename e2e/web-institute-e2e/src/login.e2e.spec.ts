import { expect, test } from '../../shared/console-guardian';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';
import { SEED } from '../../shared/seed';

// Login tests intentionally trigger GQL errors (invalid credentials)
test.use({ failOnConsoleErrors: false });

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/login');
  });

  test('renders login form with all fields', async ({ page }) => {
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page.getByTestId('login-description')).toBeVisible();
    await expect(page.getByTestId('login-username-input')).toBeVisible();
    await expect(page.getByTestId('login-password-input')).toBeVisible();
    await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.getByTestId('login-submit-btn').click();
    await expect(page.getByTestId('login-username-error')).toBeVisible();
    await expect(page.getByTestId('login-password-error')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.getByTestId('login-username-input').fill('wronguser');
    await page.getByTestId('login-password-input').fill('wrongpassword');
    await page.getByTestId('login-submit-btn').click();
    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10_000 });
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
    await expect(page.getByTestId('select-institute-title')).toBeVisible();
    await expect(page.locator(`[data-institute-name="${SEED.INSTITUTE_1.name}"]`)).toBeVisible();
    await expect(page.locator(`[data-institute-name="${SEED.INSTITUTE_2.name}"]`)).toBeVisible();
  });

  test('multi-institute user selects institute and reaches dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(E2E_USERS.INSTITUTE_ADMIN.username, E2E_USERS.INSTITUTE_ADMIN.password);
    await loginPage.selectInstitute(SEED.INSTITUTE_1.name);
    await loginPage.expectRedirectToDashboard();
  });
});
