import { expect, type Page } from '@playwright/test';

/**
 * Page object for the unified `/en/login` form.
 *
 * Selectors mirror the actual placeholder text in `apps/web` — keep in sync
 * with that form. Used by all 3 portal projects (web-admin-e2e,
 * web-institute-e2e, web-reseller-e2e) since they all hit the same login UI
 * at different subdomains.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(path = '/en/login') {
    await this.page.goto(path);
  }

  async fill(username: string, password: string) {
    await this.page.getByPlaceholder('Enter your Roviq ID').fill(username);
    await this.page.getByPlaceholder('Enter your password').fill(password);
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }

  /** Convenience: fill + submit. Does NOT wait for redirect. */
  async login(username: string, password: string) {
    await this.fill(username, password);
    await this.submit();
  }

  /**
   * Multi-institute institute-scoped users are redirected to `/select-institute`
   * after login. Click the institute by its display name to complete the flow.
   *
   * Note: platform (admin) scope login uses the `adminLogin` mutation and does
   * NOT go through institute selection — do not call this helper from the
   * admin portal auth flow.
   */
  async selectInstitute(instituteName: string | RegExp) {
    await this.page.waitForURL(/\/select-institute/, { timeout: 15_000 });
    await this.page.getByRole('button', { name: instituteName }).click();
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  }

  async expectError(message: string | RegExp) {
    await expect(this.page.getByRole('alert')).toContainText(message);
  }
}
