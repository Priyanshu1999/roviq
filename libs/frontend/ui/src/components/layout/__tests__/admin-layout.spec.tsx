import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted by vitest above static imports) ─────────────────────────
// next/navigation is exercised by Topbar, Sidebar, Breadcrumbs and the
// BottomTabBar. Stub the hooks so the module renders without a real router.
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// next-intl provides locale + translations to multiple layout children.
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

// next-themes' real ThemeProvider relies on `localStorage` and `matchMedia`.
// Stub to a passthrough.
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' }),
}));

// @novu/nextjs Inbox is a heavy widget that opens a websocket. Stub it.
vi.mock('@novu/nextjs', () => ({
  Inbox: () => <div data-testid="novu-inbox-stub" />,
}));

// next/image
vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

// next/link → plain anchor.
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AdminLayout } from '../admin-layout';
import type { LayoutConfig, NavRegistryEntry } from '../types';

// ── Fixtures ───────────────────────────────────────────────────────────────
const baseConfig: LayoutConfig = {
  appName: 'Roviq',
  navGroups: [
    {
      title: 'Main',
      items: [{ title: 'Dashboard', href: '/dashboard', icon: Home }],
    },
  ],
};

const navRegistry: Record<string, NavRegistryEntry> = {
  dashboard: { href: '/dashboard', icon: Home, label: 'Dashboard' },
  students: { href: '/students', icon: Home, label: 'Students' },
};

// ── Tests ──────────────────────────────────────────────────────────────────
describe('AdminLayout', () => {
  it('renders BottomTabBar when bottomNav + navRegistry are configured', () => {
    const config: LayoutConfig = {
      ...baseConfig,
      navRegistry,
      bottomNav: {
        slugs: ['dashboard', 'students'],
        defaultSlugs: [],
        moreLabel: 'More',
      },
    };

    render(
      <AdminLayout config={config}>
        <div>page-content</div>
      </AdminLayout>,
    );

    expect(screen.getByTestId('bottom-tab-bar')).toBeInTheDocument();
    expect(screen.getByText('page-content')).toBeInTheDocument();
  });

  it('does NOT render BottomTabBar when bottomNav is omitted', () => {
    render(
      <AdminLayout config={baseConfig}>
        <div>page-content</div>
      </AdminLayout>,
    );

    expect(screen.queryByTestId('bottom-tab-bar')).not.toBeInTheDocument();
    expect(screen.getByText('page-content')).toBeInTheDocument();
  });
});
