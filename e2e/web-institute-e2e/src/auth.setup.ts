import path from 'node:path';
import { test as setup } from '@playwright/test';
import { persistSessionStorage } from '../../shared/auth-helpers';
import { E2E_USERS } from '../../shared/e2e-users';
import { LoginPage } from '../../shared/pages/LoginPage';
import { SEED } from '../../shared/seed';

const instituteAuthFile = path.join(__dirname, '../../playwright/.auth/institute.json');

setup('authenticate as institute admin', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto('/en/login');
  await loginPage.login(E2E_USERS.INSTITUTE_ADMIN.username, E2E_USERS.INSTITUTE_ADMIN.password);
  await loginPage.selectInstitute(SEED.INSTITUTE_1.name);
  await loginPage.expectRedirectToDashboard();

  // Copy sessionStorage (access token) to localStorage so storageState captures it
  await persistSessionStorage(page);
  await page.context().storageState({ path: instituteAuthFile });
});
