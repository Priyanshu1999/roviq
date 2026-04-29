import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────
// usePathname is the only next/navigation hook the component uses; we change
// it per-test by mutating the `currentPathname` reference.
let currentPathname = '/en/dashboard';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

// next-intl: useLocale returns 'en'; useTranslations('nav') returns a function
// that has a .has() method (the real next-intl translator does). For unknown
// keys we return the key itself to keep assertions stable.
vi.mock('next-intl', () => {
  const translator = ((key: string) => key) as ((key: string) => string) & {
    has: (key: string) => boolean;
  };
  translator.has = () => false;
  return {
    useLocale: () => 'en',
    useTranslations: () => translator,
  };
});

// next/link → plain anchor; happy-dom does not need router context.
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Imports MUST come AFTER vi.mock() calls.
const { render, screen } = await import('@testing-library/react');
const { Breadcrumbs } = await import('../breadcrumbs');

describe('Breadcrumbs', () => {
  it('renders both mobile and desktop variants on a deep route', () => {
    currentPathname = '/en/people/students/123';
    render(<Breadcrumbs />);

    const mobile = screen.getByTestId('breadcrumbs-mobile');
    const desktop = screen.getByTestId('breadcrumbs-desktop');

    // Both DOM nodes are present — CSS hides one per breakpoint.
    expect(mobile).toBeInTheDocument();
    expect(desktop).toBeInTheDocument();

    // Mobile: back arrow link to parent + current segment label ("Students"
    // is the parent of 123 — but 123 is the leaf. Per the task we want a
    // back-arrow to the parent and the leaf as text.)
    const backLink = mobile.querySelector('a');
    expect(backLink).not.toBeNull();
    expect(backLink).toHaveAttribute('href', '/en/people/students');
    expect(mobile).toHaveTextContent('123');

    // Desktop: full chain — home + each segment. Labels are case-insensitive
    // because translator stub returns the key for known nav keys (e.g. 'home')
    // and `formatSegment` Title-Cases unknown ones (e.g. 'People').
    expect(desktop).toHaveTextContent(/home/i);
    expect(desktop).toHaveTextContent(/people/i);
    expect(desktop).toHaveTextContent(/students/i);
    expect(desktop).toHaveTextContent('123');
    // Desktop has a link for every non-leaf segment plus home.
    const desktopLinks = desktop.querySelectorAll('a');
    // home, people, students — leaf (123) is rendered as text.
    expect(desktopLinks.length).toBe(3);
  });

  it('mobile variant has no back arrow at the root path', () => {
    currentPathname = '/en/dashboard';
    render(<Breadcrumbs />);

    const mobile = screen.getByTestId('breadcrumbs-mobile');
    expect(mobile).toBeInTheDocument();

    // No anchor — single segment means no parent.
    expect(mobile.querySelector('a')).toBeNull();
    // Current segment label is shown (Title-Cased by formatSegment fallback).
    expect(mobile).toHaveTextContent(/dashboard/i);

    // Desktop variant still renders the home link + current segment.
    const desktop = screen.getByTestId('breadcrumbs-desktop');
    expect(desktop).toBeInTheDocument();
    expect(desktop).toHaveTextContent(/home/i);
    expect(desktop).toHaveTextContent(/dashboard/i);
  });
});
