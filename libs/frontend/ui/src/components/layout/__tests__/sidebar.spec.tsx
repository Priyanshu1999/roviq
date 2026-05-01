import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home, Settings } from 'lucide-react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted by vitest above static imports) ─────────────────────────
// Module-level let var used by the next/navigation mock so individual tests
// can mutate it and re-render to simulate route changes.
let currentPathname = '/en/dashboard';

// Shared router push spy — exported via the mock so individual specs can
// assert against it (e.g. B4 single-match Enter navigation).
const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: routerPush, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

import {
  DesktopSidebar,
  MobileSidebar,
  pickActiveHref,
  SidebarProvider,
  useSidebar,
} from '../sidebar';
import type { LayoutConfig } from '../types';

// ── Fixtures ───────────────────────────────────────────────────────────────
const baseConfig: LayoutConfig = {
  appName: 'Roviq',
  navGroups: [
    {
      title: 'Main',
      items: [
        { title: 'Dashboard', href: '/dashboard', icon: Home },
        { title: 'Settings', href: '/settings', icon: Settings },
        { title: 'Consent', href: '/settings/consent', icon: Settings },
      ],
    },
  ],
};

/**
 * Tap into the live SidebarContext so tests can read state across renders and
 * imperatively drive `setMobileOpen` from outside React (avoids the `useEffect`
 * timing trap where opening the sheet inside an effect doesn't flush before the
 * next assertion in synchronous test code).
 */
type Captured = {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
};
function makeContextCapture() {
  const captured: Captured = {
    mobileOpen: false,
    setMobileOpen: () => {},
  };
  const Probe: React.FC = () => {
    const ctx = useSidebar();
    captured.mobileOpen = ctx.mobileOpen;
    captured.setMobileOpen = ctx.setMobileOpen;
    return null;
  };
  return { captured, Probe };
}

beforeEach(() => {
  currentPathname = '/en/dashboard';
  // Clear localStorage between tests so collapsed/group state doesn't leak.
  window.localStorage.clear();
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe('pickActiveHref', () => {
  it('returns longest-prefix match across the supplied cases', () => {
    // /settings exact
    expect(pickActiveHref(['/settings'], '/settings', 'en')).toBe('/settings');

    // /settings/consent wins over /settings when both candidates are present
    expect(pickActiveHref(['/settings', '/settings/consent'], '/settings/consent', 'en')).toBe(
      '/settings/consent',
    );

    // /people/students wins over /people on a deep child pathname
    expect(pickActiveHref(['/people', '/people/students'], '/people/students/123', 'en')).toBe(
      '/people/students',
    );

    // Locale-prefixed pathname matches the unprefixed href
    expect(pickActiveHref(['/dashboard'], '/en/dashboard', 'en')).toBe('/dashboard');

    // No match
    expect(pickActiveHref(['/dashboard', '/settings'], '/totally/unrelated', 'en')).toBeNull();
  });
});

describe('SidebarProvider keyboard shortcut', () => {
  it('toggles collapsed when Cmd+B is pressed outside an editable target', () => {
    type Captured2 = { collapsed: boolean };
    const captured: Captured2 = { collapsed: false };
    const Probe: React.FC = () => {
      const ctx = useSidebar();
      captured.collapsed = ctx.collapsed;
      return null;
    };

    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );

    const initial = captured.collapsed;

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }));
    });
    expect(captured.collapsed).toBe(!initial);

    // Ctrl+B also toggles (cross-platform).
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    });
    expect(captured.collapsed).toBe(initial);
  });

  it('does NOT toggle when the event target is an <input>', () => {
    type Captured2 = { collapsed: boolean };
    const captured: Captured2 = { collapsed: false };
    const Probe: React.FC = () => {
      const ctx = useSidebar();
      captured.collapsed = ctx.collapsed;
      return null;
    };

    render(
      <SidebarProvider>
        <Probe />
        <input data-testid="probe-input" />
      </SidebarProvider>,
    );

    const initial = captured.collapsed;
    const input = screen.getByTestId('probe-input');

    act(() => {
      const ev = new KeyboardEvent('keydown', {
        key: 'b',
        metaKey: true,
        bubbles: true,
      });
      input.dispatchEvent(ev);
    });

    expect(captured.collapsed).toBe(initial);
  });
});

describe('SidebarProvider', () => {
  it('auto-closes the mobile drawer on route change', () => {
    const { captured, Probe } = makeContextCapture();

    currentPathname = '/en/dashboard';
    const { rerender } = render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );

    // Imperatively open the drawer from outside React, wrapped in act() so the
    // resulting state update flushes synchronously before our next assertion.
    act(() => {
      captured.setMobileOpen(true);
    });
    expect(captured.mobileOpen).toBe(true);

    // Simulate a route change and re-render. The provider's
    // useEffect([pathname]) should reset mobileOpen → false.
    currentPathname = '/en/settings';
    act(() => {
      rerender(
        <SidebarProvider>
          <Probe />
        </SidebarProvider>,
      );
    });

    expect(captured.mobileOpen).toBe(false);
  });
});

describe('MobileSidebar Search button', () => {
  it('calls config.onSearch when provided and keeps the drawer open', async () => {
    const onSearch = vi.fn();
    const { captured, Probe } = makeContextCapture();
    const config: LayoutConfig = {
      ...baseConfig,
      searchEnabled: true,
      onSearch,
    };

    render(
      <SidebarProvider>
        <Probe />
        <MobileSidebar config={config} />
      </SidebarProvider>,
    );

    act(() => {
      captured.setMobileOpen(true);
    });
    expect(captured.mobileOpen).toBe(true);

    // Wait for the Sheet's portaled content (which holds the search button) to mount.
    const searchBtn = await screen.findByTestId('sidebar-search');

    act(() => {
      fireEvent.click(searchBtn);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    // Drawer remained open — handler returned early without flipping state.
    expect(captured.mobileOpen).toBe(true);
  });

  it('falls back to dispatching Cmd+K + Ctrl+K on document when onSearch is undefined', async () => {
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
    const { captured, Probe } = makeContextCapture();
    const config: LayoutConfig = {
      ...baseConfig,
      searchEnabled: true,
    };

    render(
      <SidebarProvider>
        <Probe />
        <MobileSidebar config={config} />
      </SidebarProvider>,
    );

    act(() => {
      captured.setMobileOpen(true);
    });

    const searchBtn = await screen.findByTestId('sidebar-search');

    act(() => {
      fireEvent.click(searchBtn);
    });

    const keyboardCalls = dispatchSpy.mock.calls.filter(
      (call) => call[0] instanceof KeyboardEvent && (call[0] as KeyboardEvent).key === 'k',
    );
    expect(keyboardCalls.length).toBeGreaterThanOrEqual(1);
    const ev = keyboardCalls[0]?.[0] as KeyboardEvent;
    expect(ev.key).toBe('k');
    expect(ev.metaKey).toBe(true);
    expect(ev.ctrlKey).toBe(true);

    dispatchSpy.mockRestore();
  });
});

describe('MobileSidebar nav active state', () => {
  it('uses the longest-prefix match for data-active', async () => {
    currentPathname = '/en/settings/consent';
    const { captured, Probe } = makeContextCapture();

    render(
      <SidebarProvider>
        <Probe />
        <MobileSidebar config={baseConfig} />
      </SidebarProvider>,
    );

    act(() => {
      captured.setMobileOpen(true);
    });

    // Wait for the portaled drawer body (with nav links) to mount.
    await waitFor(() => {
      const links = document.querySelectorAll<HTMLAnchorElement>('a[href]');
      expect(links.length).toBeGreaterThan(0);
    });

    const allLinks = document.querySelectorAll<HTMLAnchorElement>('a[href]');
    const settingsLink = Array.from(allLinks).find(
      (a) => a.getAttribute('href') === '/en/settings',
    );
    const consentLink = Array.from(allLinks).find(
      (a) => a.getAttribute('href') === '/en/settings/consent',
    );

    expect(settingsLink).toBeDefined();
    expect(consentLink).toBeDefined();
    expect(consentLink?.getAttribute('data-active')).toBe('true');
    expect(settingsLink?.getAttribute('data-active')).toBe('false');
  });
});

describe('MobileSidebar nav click', () => {
  it('closes the drawer when a nav link is clicked', async () => {
    const { captured, Probe } = makeContextCapture();

    render(
      <SidebarProvider>
        <Probe />
        <MobileSidebar config={baseConfig} />
      </SidebarProvider>,
    );

    act(() => {
      captured.setMobileOpen(true);
    });
    expect(captured.mobileOpen).toBe(true);

    await waitFor(() => {
      const links = document.querySelectorAll<HTMLAnchorElement>('a[href]');
      expect(links.length).toBeGreaterThan(0);
    });

    const allLinks = document.querySelectorAll<HTMLAnchorElement>('a[href]');
    const dashboardLink = Array.from(allLinks).find(
      (a) => a.getAttribute('href') === '/en/dashboard',
    );
    expect(dashboardLink).toBeDefined();

    act(() => {
      if (dashboardLink) fireEvent.click(dashboardLink);
    });

    // The link's onClick wired in SidebarNavContent calls setMobileOpen(false).
    expect(captured.mobileOpen).toBe(false);
  });
});

// ── A9: DesktopSidebar compact rail + tooltip ──────────────────────────────
// The compact rail renders icon-only RailItem components (no visible label
// text). Hovering an icon should surface a Radix tooltip whose content is the
// item's title — and `(badge)` when an item has a badge.
describe('DesktopSidebar compact rail (collapsed)', () => {
  beforeEach(() => {
    // Force the SidebarProvider's lazy state initializer to start collapsed.
    window.localStorage.setItem('roviq:sidebar-collapsed', '1');
  });

  it('renders RailItem icons with no visible label text per item', async () => {
    render(
      <SidebarProvider>
        <DesktopSidebar config={baseConfig} />
      </SidebarProvider>,
    );

    // Scope all queries to the desktop sidebar shell to avoid catching any
    // portaled tooltip content that may attach elsewhere in the DOM.
    const sidebar = await screen.findByTestId('desktop-sidebar');
    const railLinks = sidebar.querySelectorAll<HTMLAnchorElement>('a[aria-label]');
    const firstGroup = baseConfig.navGroups[0];
    if (!firstGroup) throw new Error('baseConfig.navGroups[0] missing');
    expect(railLinks.length).toBe(firstGroup.items.length);

    // Each rail link should have NO visible label text inside — only the icon
    // (lucide renders an <svg>). `aria-label` provides the a11y name.
    for (const link of Array.from(railLinks)) {
      // textContent of an svg-only anchor should be empty/whitespace.
      expect(link.textContent?.trim() ?? '').toBe('');
      // svg child must exist as the icon visual.
      expect(link.querySelector('svg')).not.toBeNull();
    }
  });

  it('shows a tooltip with the item title on hover of the first rail link', async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <DesktopSidebar config={baseConfig} />
      </SidebarProvider>,
    );

    const sidebar = await screen.findByTestId('desktop-sidebar');
    const firstLink = sidebar.querySelector<HTMLAnchorElement>('a[aria-label]');
    expect(firstLink).not.toBeNull();

    await user.hover(firstLink as HTMLAnchorElement);

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 2_000 });
    // First rail item in baseConfig is the Dashboard entry.
    const firstGroup = baseConfig.navGroups[0];
    const firstItem = firstGroup?.items[0];
    if (!firstItem) throw new Error('baseConfig.navGroups[0].items[0] missing');
    expect(tooltip.textContent ?? '').toContain(firstItem.title);
  });

  it('renders tooltip text containing `(badge)` for items with a badge', async () => {
    const user = userEvent.setup();
    const badgeConfig: LayoutConfig = {
      appName: 'Roviq',
      navGroups: [
        {
          title: 'Main',
          items: [{ title: 'Inbox', href: '/inbox', icon: Home, badge: '3' }],
        },
      ],
    };

    render(
      <SidebarProvider>
        <DesktopSidebar config={badgeConfig} />
      </SidebarProvider>,
    );

    const sidebar = await screen.findByTestId('desktop-sidebar');
    const link = sidebar.querySelector<HTMLAnchorElement>('a[aria-label="Inbox"]');
    expect(link).not.toBeNull();

    await user.hover(link as HTMLAnchorElement);

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 2_000 });
    expect(tooltip.textContent ?? '').toContain('Inbox');
    expect(tooltip.textContent ?? '').toContain('(3)');
  });
});

// ── B2: Collapsible groups + auto-expand on active ─────────────────────────
const groupedConfig: LayoutConfig = {
  appName: 'Roviq',
  navGroups: [
    {
      title: 'Overview',
      items: [{ title: 'Dashboard', href: '/dashboard', icon: Home }],
    },
    {
      title: 'Academic',
      items: [
        { title: 'Academics', href: '/academics', icon: Settings },
        { title: 'Subjects', href: '/academics/subjects', icon: Settings },
      ],
    },
  ],
};

describe('FullNavContent collapsible groups (B2)', () => {
  it('toggles a group on heading click and persists collapsed state to localStorage', async () => {
    const user = userEvent.setup();
    const { captured, Probe } = makeContextCapture();

    const { unmount } = render(
      <SidebarProvider>
        <Probe />
        <MobileSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    act(() => {
      captured.setMobileOpen(true);
    });

    const toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('false');

    // The group's nav items are visible before collapse.
    expect(document.querySelector<HTMLAnchorElement>('a[href="/en/academics"]')).not.toBeNull();

    await user.click(toggle);

    // Now collapsed: data attribute flips and localStorage persisted.
    await waitFor(() => {
      expect(screen.getByTestId('nav-group-toggle-Academic').getAttribute('data-collapsed')).toBe(
        'true',
      );
    });
    const stored = window.localStorage.getItem('roviq:nav-group-collapsed');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}')).toEqual({ Academic: true });

    // Re-mount to simulate reload — the collapsed state still applies.
    unmount();
    const { captured: c2, Probe: P2 } = makeContextCapture();
    render(
      <SidebarProvider>
        <P2 />
        <MobileSidebar config={groupedConfig} />
      </SidebarProvider>,
    );
    act(() => {
      c2.setMobileOpen(true);
    });
    const toggle2 = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle2.getAttribute('data-collapsed')).toBe('true');
  });

  // ── Active-group auto-expand scenarios ──────────────────────────────────
  // Spec:
  //   1. Persisted collapsed = "default state when user is NOT on this group"
  //   2. When the active route lives in a collapsed group → auto-expand
  //      (applies on first mount AND on in-session navigation)
  //   3. User can click toggle to override the auto-expand → collapses; sticks
  //      while they remain in the group
  //   4. Navigation away from the group clears the override; revisiting the
  //      group later re-auto-expands
  //   5. Navigation away from a group that was passively (no-override)
  //      auto-expanded → group reverts to its persisted (collapsed) state

  it('auto-expands a persisted-collapsed group on initial mount when active route is inside it', async () => {
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));
    currentPathname = '/en/academics';

    render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    const toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('false');
    // Persisted preference survives untouched.
    expect(JSON.parse(window.localStorage.getItem('roviq:nav-group-collapsed') ?? '{}')).toEqual({
      Academic: true,
    });
  });

  it('keeps a persisted-collapsed group collapsed on initial mount when active route is elsewhere', async () => {
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));
    currentPathname = '/en/dashboard';

    render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    const toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('true');
  });

  it('auto-expands when navigation moves into a persisted-collapsed group', async () => {
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));
    currentPathname = '/en/dashboard';

    const { rerender } = render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    let toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('true');

    currentPathname = '/en/academics';
    act(() => {
      rerender(
        <SidebarProvider>
          <DesktopSidebar config={groupedConfig} />
        </SidebarProvider>,
      );
    });

    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('false');
    });
    expect(JSON.parse(window.localStorage.getItem('roviq:nav-group-collapsed') ?? '{}')).toEqual({
      Academic: true,
    });
  });

  it('auto-collapses a passively-auto-expanded group when navigation leaves it', async () => {
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));
    currentPathname = '/en/academics';

    const { rerender } = render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    let toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('false');

    currentPathname = '/en/dashboard';
    act(() => {
      rerender(
        <SidebarProvider>
          <DesktopSidebar config={groupedConfig} />
        </SidebarProvider>,
      );
    });

    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('true');
    });
  });

  it('user-collapsing an auto-expanded active group sticks while in the group', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));
    currentPathname = '/en/academics';

    render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    let toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('false');

    await user.click(toggle);

    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('true');
    });
    // Persisted preference still says collapsed.
    expect(JSON.parse(window.localStorage.getItem('roviq:nav-group-collapsed') ?? '{}')).toEqual({
      Academic: true,
    });
  });

  it('user-collapsed active group → leaving + revisiting re-auto-expands (override is per-visit)', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));
    currentPathname = '/en/academics';

    const { rerender } = render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    // Auto-expanded on mount; user collapses it.
    let toggle = await screen.findByTestId('nav-group-toggle-Academic');
    await user.click(toggle);
    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('true');
    });

    // Navigate away.
    currentPathname = '/en/dashboard';
    act(() => {
      rerender(
        <SidebarProvider>
          <DesktopSidebar config={groupedConfig} />
        </SidebarProvider>,
      );
    });
    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('true');
    });

    // Revisit — should re-auto-expand because override is cleared on leave.
    currentPathname = '/en/academics/subjects';
    act(() => {
      rerender(
        <SidebarProvider>
          <DesktopSidebar config={groupedConfig} />
        </SidebarProvider>,
      );
    });
    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('false');
    });
  });

  it('user-expanding the active group while it was auto-expanded clears the persisted preference', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));
    currentPathname = '/en/academics';

    const { rerender } = render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    // Auto-expanded; user collapses (persisted=true, override=Academic).
    let toggle = await screen.findByTestId('nav-group-toggle-Academic');
    await user.click(toggle);
    await waitFor(() => {
      expect(screen.getByTestId('nav-group-toggle-Academic').getAttribute('data-collapsed')).toBe(
        'true',
      );
    });

    // User now expands again — should clear override AND clear persisted.
    await user.click(screen.getByTestId('nav-group-toggle-Academic'));
    await waitFor(() => {
      expect(screen.getByTestId('nav-group-toggle-Academic').getAttribute('data-collapsed')).toBe(
        'false',
      );
    });
    expect(window.localStorage.getItem('roviq:nav-group-collapsed')).toBeNull();

    // Navigate away — group should now stay expanded (no persisted, no active).
    currentPathname = '/en/dashboard';
    act(() => {
      rerender(
        <SidebarProvider>
          <DesktopSidebar config={groupedConfig} />
        </SidebarProvider>,
      );
    });
    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('false');
    });
  });

  it('toggling an inactive group flips its persisted state in place', async () => {
    const user = userEvent.setup();
    currentPathname = '/en/dashboard';

    render(
      <SidebarProvider>
        <DesktopSidebar config={groupedConfig} />
      </SidebarProvider>,
    );

    // Initially expanded (no persisted).
    let toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('false');

    await user.click(toggle);

    await waitFor(() => {
      toggle = screen.getByTestId('nav-group-toggle-Academic');
      expect(toggle.getAttribute('data-collapsed')).toBe('true');
    });
    expect(JSON.parse(window.localStorage.getItem('roviq:nav-group-collapsed') ?? '{}')).toEqual({
      Academic: true,
    });
  });

  it('toggling a collapsed group back open clears its storage entry', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('roviq:nav-group-collapsed', JSON.stringify({ Academic: true }));

    const { captured, Probe } = makeContextCapture();
    render(
      <SidebarProvider>
        <Probe />
        <MobileSidebar config={groupedConfig} />
      </SidebarProvider>,
    );
    act(() => {
      captured.setMobileOpen(true);
    });

    const toggle = await screen.findByTestId('nav-group-toggle-Academic');
    expect(toggle.getAttribute('data-collapsed')).toBe('true');

    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByTestId('nav-group-toggle-Academic').getAttribute('data-collapsed')).toBe(
        'false',
      );
    });
    // Sparse map: opening the only collapsed entry removes the key entirely.
    expect(window.localStorage.getItem('roviq:nav-group-collapsed')).toBeNull();
  });
});
