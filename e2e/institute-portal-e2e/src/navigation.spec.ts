import { expect, type Page, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function loginAsAdmin(page: Page) {
  await page.goto('/en/login');
  await page.getByPlaceholder('Enter your Roviq ID').fill('admin');
  await page.getByPlaceholder('Enter your password').fill('admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/select-institute/, { timeout: 15_000 });
  await page.getByRole('button', { name: /Saraswati Vidya Mandir/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

const navRoutes = [
  { path: '/en/dashboard', label: 'Dashboard' },
  { path: '/en/users', label: 'Users' },
  { path: '/en/academic-years', label: 'Academic Years' },
  { path: '/en/academics', label: 'Academics' },
  { path: '/en/timetable', label: 'Timetable' },
  { path: '/en/billing', label: 'Billing' },
  { path: '/en/billing/invoices', label: 'Invoices' },
  { path: '/en/billing/payments', label: 'Payments' },
  { path: '/en/audit', label: 'Audit' },
  { path: '/en/settings', label: 'Settings' },
  { path: '/en/settings/notifications', label: 'Notifications' },
  { path: '/en/account', label: 'Account' },
];

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of navRoutes) {
    test(`${route.label} page loads without 404 at ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      // Page should not show a 404 error
      const notFoundText = page.getByText(/not found|404/i);
      const notFoundCount = await notFoundText.count();
      // Allow the text to not exist at all, but if it does, it should be hidden
      if (notFoundCount > 0) {
        await expect(notFoundText.first()).not.toBeVisible();
      }

      // Page should have meaningful content (not a blank error page)
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(50);
    });
  }

  test('breadcrumbs render on subpages', async ({ page }) => {
    // Check a few subpages for breadcrumb presence
    const subpages = ['/en/settings', '/en/billing/invoices', '/en/academics'];

    for (const subpage of subpages) {
      await page.goto(subpage);
      await page.waitForLoadState('networkidle');

      const breadcrumb = page
        .locator(
          'nav[aria-label*="breadcrumb" i], nav[aria-label*="Breadcrumb" i], [data-testid="breadcrumbs"]',
        )
        .or(
          page
            .locator('ol')
            .filter({ has: page.locator('li a') })
            .first(),
        );
      await expect(breadcrumb.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
