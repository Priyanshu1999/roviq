import { expect, test } from '../../shared/console-guardian';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';

test.describe.configure({ mode: 'serial' });

test.describe('Admin Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/login');
  });

  test('renders login form with all fields', async ({ page }) => {
    await expect(page.locator('[data-test-id="login-title"]')).toBeVisible();
    await expect(page.locator('[data-test-id="login-description"]')).toBeVisible();
    await expect(page.locator('[data-test-id="login-username-input"]')).toBeVisible();
    await expect(page.locator('[data-test-id="login-password-input"]')).toBeVisible();
    await expect(page.locator('[data-test-id="login-submit-btn"]')).toBeVisible();
  });

  test('shows validation errors for empty submission', async ({ page }) => {
    await page.locator('[data-test-id="login-submit-btn"]').click();
    await expect(page.locator('[data-test-id="login-username-error"]')).toBeVisible();
    await expect(page.locator('[data-test-id="login-password-error"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('[data-test-id="login-username-input"]').fill('wronguser');
    await page.locator('[data-test-id="login-password-input"]').fill('wrongpassword');
    await page.locator('[data-test-id="login-submit-btn"]').click();
    await expect(page.locator('[data-test-id="login-error"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('admin logs in and redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(E2E_USERS.PLATFORM_ADMIN.username, E2E_USERS.PLATFORM_ADMIN.password);
    await loginPage.expectRedirectToDashboard();
  });
});
