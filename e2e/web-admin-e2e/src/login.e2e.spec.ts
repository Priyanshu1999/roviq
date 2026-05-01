import { expect, test } from '../../shared/console-guardian';
import { LoginPage } from '../../shared/pages/LoginPage';
import { E2E_USERS } from '../../shared/seed-fixtures';

// Login tests intentionally trigger GQL errors + console errors (invalid credentials)
test.use({ failOnConsoleErrors: false });

test.describe('Admin Login Page', () => {
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
    await expect(page.getByTestId('login-error')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('admin logs in and redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(E2E_USERS.PLATFORM_ADMIN.username, E2E_USERS.PLATFORM_ADMIN.password);
    await loginPage.expectRedirectToDashboard();
  });
});
