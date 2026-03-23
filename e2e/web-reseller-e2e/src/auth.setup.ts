import path from 'node:path';
import { expect, test as setup } from '@playwright/test';

const resellerAuthFile = path.join(__dirname, '../playwright/.auth/reseller.json');

setup('authenticate as reseller', async ({ page }) => {
  await page.goto('/en/login');
  await page.getByPlaceholder('Enter your Roviq ID').fill('reseller1');
  await page.getByPlaceholder('Enter your password').fill('reseller123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.context().storageState({ path: resellerAuthFile });
});
