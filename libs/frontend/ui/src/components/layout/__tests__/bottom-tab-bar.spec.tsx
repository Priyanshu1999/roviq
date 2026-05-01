import '@testing-library/jest-dom/vitest';
import { createMongoAbility, type RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { fireEvent, render, screen } from '@testing-library/react';
import { Home, Users } from 'lucide-react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted by vitest above static imports) ─────────────────────────
// The pathname value is swapped per-test via this mutable holder.
const pathnameHolder = { current: '/dashboard' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameHolder.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' }),
}));

vi.mock('@novu/nextjs', () => ({
  Inbox: () => <div data-testid="novu-inbox-stub" />,
}));

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock the sidebar module so we can spy on `setMobileOpen` without rendering
// the full sheet UI. Other named exports from the module are unused by
// BottomTabBar so they can stay undefined.
const setMobileOpenMock = vi.fn();
vi.mock('../sidebar', () => ({
  useSidebar: () => ({
    collapsed: false,
    setCollapsed: vi.fn(),
    mobileOpen: false,
    setMobileOpen: setMobileOpenMock,
  }),
}));

import { AbilityContext } from '../../auth/ability-provider';
import { BottomTabBar } from '../bottom-tab-bar';
import type { BottomNavConfig, NavRegistryEntry } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────────
function renderWithAbility(
  rules: RawRuleOf<AppAbility>[],
  bottomNav: BottomNavConfig,
  navRegistry: Record<string, NavRegistryEntry>,
) {
  const ability = createMongoAbility<AppAbility>(rules);
  return render(
    <AbilityContext.Provider value={ability}>
      <BottomTabBar bottomNav={bottomNav} navRegistry={navRegistry} />
    </AbilityContext.Provider>,
  );
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const fullRegistry: Record<string, NavRegistryEntry> = {
  dashboard: { href: '/dashboard', icon: Home, label: 'Dashboard' },
  students: { href: '/people/students', icon: Users, label: 'Students' },
  people: { href: '/people', icon: Users, label: 'People' },
  staff: { href: '/people/staff', icon: Users, label: 'Staff' },
  attendance: { href: '/attendance', icon: Home, label: 'Attendance' },
  reports: { href: '/reports', icon: Home, label: 'Reports' },
};

beforeEach(() => {
  setMobileOpenMock.mockClear();
  pathnameHolder.current = '/dashboard';
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe('BottomTabBar', () => {
  it('renders configured slugs in order, capped at 4 + the More button', () => {
    renderWithAbility(
      [{ action: 'manage', subject: 'all' }],
      {
        slugs: ['dashboard', 'students', 'staff', 'attendance', 'reports'],
        defaultSlugs: [],
        moreLabel: 'More',
      },
      fullRegistry,
    );

    // Exactly 4 tab links + 1 More button.
    expect(screen.getByTestId('bottom-tab-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-tab-students')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-tab-staff')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-tab-attendance')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-tab-reports')).not.toBeInTheDocument();
    expect(screen.getByTestId('bottom-tab-more')).toBeInTheDocument();
  });

  it('falls back to defaultSlugs when slugs is empty', () => {
    renderWithAbility(
      [{ action: 'manage', subject: 'all' }],
      { slugs: [], defaultSlugs: ['dashboard', 'students'], moreLabel: 'More' },
      fullRegistry,
    );

    expect(screen.getByTestId('bottom-tab-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-tab-students')).toBeInTheDocument();
  });

  it('skips slugs missing from the navRegistry', () => {
    renderWithAbility(
      [{ action: 'manage', subject: 'all' }],
      {
        slugs: ['unknownSlug', 'dashboard'],
        defaultSlugs: [],
        moreLabel: 'More',
      },
      fullRegistry,
    );

    expect(screen.queryByTestId('bottom-tab-unknownSlug')).not.toBeInTheDocument();
    expect(screen.getByTestId('bottom-tab-dashboard')).toBeInTheDocument();
  });

  it('skips slugs the user lacks ability for', () => {
    const registry: Record<string, NavRegistryEntry> = {
      dashboard: { href: '/dashboard', icon: Home, label: 'Dashboard' },
      audit: {
        href: '/audit',
        icon: Home,
        label: 'Audit',
        ability: { action: 'manage', subject: 'AuditLog' },
      },
    };

    renderWithAbility(
      [{ action: 'read', subject: 'User' }],
      {
        slugs: ['dashboard', 'audit'],
        defaultSlugs: [],
        moreLabel: 'More',
      },
      registry,
    );

    expect(screen.getByTestId('bottom-tab-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-tab-audit')).not.toBeInTheDocument();
  });

  it('marks the longest-prefix-matching slug active', () => {
    pathnameHolder.current = '/people/students/123';

    renderWithAbility(
      [{ action: 'manage', subject: 'all' }],
      {
        slugs: ['people', 'students'],
        defaultSlugs: [],
        moreLabel: 'More',
      },
      fullRegistry,
    );

    expect(screen.getByTestId('bottom-tab-students')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('bottom-tab-people')).toHaveAttribute('data-active', 'false');
  });

  it.each([
    ['without locale prefix', '/people/students/123'],
    ['with locale prefix', '/en/people/students/123'],
  ])('matches active slug %s', (_label, pathname) => {
    pathnameHolder.current = pathname;

    renderWithAbility(
      [{ action: 'manage', subject: 'all' }],
      {
        slugs: ['people', 'students'],
        defaultSlugs: [],
        moreLabel: 'More',
      },
      fullRegistry,
    );

    expect(screen.getByTestId('bottom-tab-students')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('bottom-tab-people')).toHaveAttribute('data-active', 'false');
  });

  it('skips WAAPI animations when prefers-reduced-motion is set', () => {
    // Mock matchMedia to claim the user prefers reduced motion.
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    // jsdom doesn't implement Element.prototype.animate, so stub it before
    // spying. The component's `typeof el.animate !== 'function'` guard would
    // otherwise short-circuit the call, hiding what we want to assert.
    const originalAnimate = (Element.prototype as { animate?: unknown }).animate;
    (Element.prototype as { animate: () => void }).animate = () => {};
    const animateSpy = vi.spyOn(Element.prototype, 'animate');

    pathnameHolder.current = '/dashboard';
    const ability = createMongoAbility<AppAbility>([{ action: 'manage', subject: 'all' }]);
    const bottomNav: BottomNavConfig = {
      slugs: ['dashboard', 'students'],
      defaultSlugs: [],
      moreLabel: 'More',
    };
    const { rerender } = render(
      <AbilityContext.Provider value={ability}>
        <BottomTabBar bottomNav={bottomNav} navRegistry={fullRegistry} />
      </AbilityContext.Provider>,
    );

    // Reset call count after first paint (the first-paint guard inside the
    // component already suppresses the morph, but be defensive here).
    animateSpy.mockClear();

    // Trigger an active-tab change by updating the pathname mock and re-rendering.
    pathnameHolder.current = '/people/students';
    rerender(
      <AbilityContext.Provider value={ability}>
        <BottomTabBar bottomNav={bottomNav} navRegistry={fullRegistry} />
      </AbilityContext.Provider>,
    );

    expect(animateSpy).not.toHaveBeenCalled();

    animateSpy.mockRestore();
    matchMediaSpy.mockRestore();
    if (originalAnimate === undefined) {
      delete (Element.prototype as { animate?: unknown }).animate;
    } else {
      (Element.prototype as { animate: unknown }).animate = originalAnimate;
    }
  });

  it('opens the mobile drawer when the More button is clicked', () => {
    renderWithAbility(
      [{ action: 'manage', subject: 'all' }],
      {
        slugs: ['dashboard'],
        defaultSlugs: [],
        moreLabel: 'More',
      },
      fullRegistry,
    );

    fireEvent.click(screen.getByTestId('bottom-tab-more'));

    expect(setMobileOpenMock).toHaveBeenCalledWith(true);
    expect(setMobileOpenMock).toHaveBeenCalledTimes(1);
  });
});
