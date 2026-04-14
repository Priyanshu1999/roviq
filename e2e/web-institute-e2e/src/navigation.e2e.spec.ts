import { expect, test } from '../../shared/console-guardian';

// Only test routes that have actual page.tsx files implemented
const navRoutes = [
  { path: '/en/dashboard', label: 'Dashboard' },
  { path: '/en/academic-years', label: 'Academic Years' },
  { path: '/en/academics', label: 'Academics' },
  { path: '/en/billing', label: 'Billing' },
  { path: '/en/billing/invoices', label: 'Invoices' },
  { path: '/en/billing/payments', label: 'Payments' },
  { path: '/en/audit', label: 'Audit' },
  { path: '/en/settings/institute', label: 'Institute Settings' },
  { path: '/en/settings/notifications', label: 'Notifications' },
  { path: '/en/settings/sessions', label: 'Sessions' },
  { path: '/en/account', label: 'Account' },
];

test.describe('Navigation', () => {
  for (const route of navRoutes) {
    test(`${route.label} page loads without 404 at ${route.path}`, async ({ page }) => {
      await page.goto(route.path);

      // Wait for page to have meaningful content
      await expect(page.locator('body')).not.toBeEmpty({ timeout: 15_000 });

      // Page should not show a 404 error
      const notFoundTitle = page.getByTestId('not-found-title');
      const notFoundCount = await notFoundTitle.count();
      if (notFoundCount > 0) {
        await expect(notFoundTitle.first()).not.toBeVisible();
      }

      // Page should have meaningful content (not a blank error page)
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(50);
    });
  }

  test('breadcrumbs render on subpages', async ({ page }) => {
    const subpages = ['/en/settings/institute', '/en/billing/invoices', '/en/academics'];

    for (const subpage of subpages) {
      await page.goto(subpage);

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
      await expect(breadcrumb.first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
