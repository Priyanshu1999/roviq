import path from 'node:path';
import { expect, test as setup } from '@playwright/test';

const adminAuthFile = path.join(__dirname, '../playwright/.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/en/login');
  await page.getByPlaceholder('Enter your Roviq ID').fill('admin');
  await page.getByPlaceholder('Enter your password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/select-institute/, { timeout: 15_000 });
  await page.getByRole('button', { name: /Demo Institute/ }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.context().storageState({ path: adminAuthFile });
});
