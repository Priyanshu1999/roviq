import path from 'node:path';
import { test as setup } from '@playwright/test';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';

const resellerAuthFile = path.join(__dirname, '../playwright/.auth/reseller.json');

setup('authenticate as reseller', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto('/en/login');
  await loginPage.login(E2E_USERS.RESELLER.username, E2E_USERS.RESELLER.password);
  await loginPage.expectRedirectToDashboard();

  await page.context().storageState({ path: resellerAuthFile });
});
