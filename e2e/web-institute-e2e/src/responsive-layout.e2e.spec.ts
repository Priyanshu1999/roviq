/**
 * Responsive layout — ROV-236 Phase 4 verification.
 *
 * Asserts the responsive shell behaves correctly across phone (375 × 812),
 * tablet (820 × 1100), and desktop (1440 × 900):
 *   - Phone: bottom-tab bar visible, desktop sidebar hidden, no horizontal
 *     page scroll, bottom-tab routes work, "More" opens the mobile drawer,
 *     drawer is scrollable + the in-drawer Search button opens the
 *     CommandPalette WITHOUT closing the drawer; selecting a palette item
 *     navigates and auto-closes the drawer.
 *   - Tablet: bottom-tab + drawer are still the only nav surfaces (sidebar
 *     is xl-only).
 *   - Desktop: sidebar is the primary nav, bottom bar is hidden.
 *   - Sidebar active highlight uses longest-prefix matching so a child
 *     route does not light up its parent group.
 *
 * Auth: relies on the shared institute storageState produced by
 * `auth.setup.ts` (admin / admin123, institute = Saraswati Vidya Mandir).
 */
import { expect, test } from '../../shared/console-guardian';

const PHONE = { width: 375, height: 812 } as const;
const TABLET = { width: 820, height: 1100 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;

/** True when the document has no horizontal page scroll (1px tolerance for sub-pixel rounding). */
async function noHorizontalScroll(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

test.describe('Responsive layout — phone (375x812)', () => {
  test.use({ viewport: PHONE });

  test('shows bottom-tab bar, hides desktop sidebar, no horizontal scroll, tabs navigate', async ({
    page,
  }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 15_000 });

    // Bottom bar is the primary nav surface on phones.
    await expect(page.getByTestId('bottom-tab-bar')).toBeVisible();
    // Desktop sidebar is gated behind the `xl` breakpoint (1280 px).
    await expect(page.getByTestId('desktop-sidebar')).toBeHidden();

    expect(await noHorizontalScroll(page)).toBe(true);

    // Tap the Students tab → URL updates AND that tab is the only active one.
    await page.getByTestId('bottom-tab-students').click();
    await expect(page).toHaveURL(/\/people\/students/, { timeout: 10_000 });

    const studentsTab = page.getByTestId('bottom-tab-students');
    await expect(studentsTab).toHaveAttribute('data-active', 'true');

    // No other bottom-tab link should claim active. Count active tabs inside the bar.
    const activeCount = await page
      .locator('[data-testid="bottom-tab-bar"] [data-testid^="bottom-tab-"][data-active="true"]')
      .count();
    expect(activeCount).toBe(1);
  });

  test('mobile drawer scrolls; in-drawer Search opens CommandPalette over the drawer', async ({
    page,
  }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 15_000 });

    // Open the drawer via the "More" tab.
    await page.getByTestId('bottom-tab-more').click();
    const drawer = page.getByTestId('mobile-sidebar-sheet');
    await expect(drawer).toBeVisible();

    // The drawer's nav uses Radix ScrollArea. Scroll its viewport to the bottom.
    const viewport = page.locator(
      '[data-testid="mobile-sidebar-sheet"] [data-radix-scroll-area-viewport]',
    );
    await expect(viewport).toBeVisible();
    await viewport.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // The "Account" link sits near the bottom of the nav and should now be in view.
    await expect(drawer.getByRole('link', { name: /account/i }).first()).toBeInViewport();

    // Tap the in-drawer Search entry. The drawer must STAY visible; the palette
    // layers above it (no close-then-open jank).
    await page
      .locator('[data-testid="mobile-sidebar-sheet"] [data-testid="sidebar-search"]')
      .click();

    await expect(drawer).toBeVisible();

    // CommandPalette is a Radix Dialog wrapping cmdk. Match either marker.
    const palette = page.locator('[role="dialog"]:has([cmdk-root])').first();
    await expect(palette).toBeVisible({ timeout: 5_000 });
  });

  test('selecting a CommandPalette item navigates AND closes the drawer + palette', async ({
    page,
  }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 15_000 });

    // Set up: open the drawer, then open the palette from inside it.
    await page.getByTestId('bottom-tab-more').click();
    const drawer = page.getByTestId('mobile-sidebar-sheet');
    await expect(drawer).toBeVisible();
    await page
      .locator('[data-testid="mobile-sidebar-sheet"] [data-testid="sidebar-search"]')
      .click();
    const palette = page.locator('[role="dialog"]:has([cmdk-root])').first();
    await expect(palette).toBeVisible({ timeout: 5_000 });

    // Filter the list to surface Students at the top.
    const input = palette.locator('[cmdk-input]').first();
    await input.fill('students');

    // Click the first matching cmdk item. cmdk auto-selects the first match.
    const firstItem = palette.locator('[cmdk-item]').first();
    await expect(firstItem).toBeVisible();
    await firstItem.click();

    await expect(page).toHaveURL(/\/people\/students/, { timeout: 10_000 });
    // Drawer auto-closes on route change (see SidebarProvider effect on pathname).
    await expect(drawer).toBeHidden();
    // Palette closes on item select.
    await expect(palette).toBeHidden();
  });
});

test.describe('Responsive layout — tablet (820x1100)', () => {
  test.use({ viewport: TABLET });

  test('drawer + bottom bar present, no always-on sidebar, no horizontal scroll', async ({
    page,
  }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 15_000 });

    // Sidebar is xl-only (>= 1280 px). At 820 px it must remain hidden.
    await expect(page.getByTestId('desktop-sidebar')).toBeHidden();
    // Bottom bar covers the sub-xl range.
    await expect(page.getByTestId('bottom-tab-bar')).toBeVisible();

    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

test.describe('Responsive layout — desktop (1440x900)', () => {
  test.use({ viewport: DESKTOP });

  test('sidebar visible, bottom bar hidden, no horizontal scroll', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.getByTestId('dashboard-welcome-card')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId('desktop-sidebar')).toBeVisible();
    await expect(page.getByTestId('bottom-tab-bar')).toBeHidden();

    expect(await noHorizontalScroll(page)).toBe(true);
  });

  test('sidebar uses longest-prefix active match (Data Consent on /settings/consent)', async ({
    page,
  }) => {
    await page.goto('/en/settings/consent');
    // Wait for the sidebar to render with at least one link present.
    const sidebar = page.getByTestId('desktop-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await expect(sidebar.locator('a[data-active]').first()).toBeVisible({ timeout: 15_000 });

    const activeLinks = sidebar.locator('a[data-active="true"]');
    await expect(activeLinks).toHaveCount(1);

    // The single active link must be the Data Consent link — its localized
    // href ends with `/settings/consent` (NOT `/settings`).
    const activeHref = await activeLinks.first().getAttribute('href');
    expect(activeHref).toMatch(/\/settings\/consent$/);
  });
});
