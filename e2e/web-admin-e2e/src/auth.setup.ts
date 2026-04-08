import path from 'node:path';
import { test as setup } from '@playwright/test';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';

const adminAuthFile = path.join(__dirname, '../playwright/.auth/admin.json');

// Platform admin portal at admin.localhost:4200 uses the `adminLogin`
// mutation (platform scope) — no institute selection step.
setup('authenticate as platform admin', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto('/en/login');
  await loginPage.login(E2E_USERS.PLATFORM_ADMIN.username, E2E_USERS.PLATFORM_ADMIN.password);
  await loginPage.expectRedirectToDashboard();

  await page.context().storageState({ path: adminAuthFile });
});
