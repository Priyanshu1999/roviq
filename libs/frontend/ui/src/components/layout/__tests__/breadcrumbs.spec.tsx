import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────
// usePathname is the only next/navigation hook the component uses; we change
// it per-test by mutating the `currentPathname` reference.
let currentPathname = '/en/dashboard';

const routerPush = vi.fn();
const routerBack = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: routerPush, replace: vi.fn(), back: routerBack, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
const { fireEvent, render, screen } = await import('@testing-library/react');
const { Breadcrumbs } = await import('../breadcrumbs');

beforeEach(() => {
  routerPush.mockClear();
  routerBack.mockClear();
  window.sessionStorage.clear();
});

describe('Breadcrumbs', () => {
  it('renders both mobile and desktop variants on a deep route', () => {
    currentPathname = '/en/people/students/123';
    render(<Breadcrumbs />);

    const mobile = screen.getByTestId('breadcrumbs-mobile');
    const desktop = screen.getByTestId('breadcrumbs-desktop');
    expect(mobile).toBeInTheDocument();
    expect(desktop).toBeInTheDocument();

    const backBtn = mobile.querySelector('button');
    expect(backBtn).not.toBeNull();
    expect(backBtn).toHaveAttribute('aria-label');
    expect(mobile).toHaveTextContent('123');

    expect(desktop).toHaveTextContent(/home/i);
    expect(desktop).toHaveTextContent(/people/i);
    expect(desktop).toHaveTextContent(/students/i);
    expect(desktop).toHaveTextContent('123');
    // `people` is category-only (no page.tsx) → rendered as <span>, not <a>.
    // Links: home + students (leaf 123 is text, people is non-link).
    const desktopLinks = desktop.querySelectorAll('a');
    expect(desktopLinks.length).toBe(2);
    expect(Array.from(desktopLinks).map((a) => a.getAttribute('href'))).toEqual([
      '/en/dashboard',
      '/en/people/students',
    ]);
  });

  it('mobile variant has no back arrow at the root path', () => {
    currentPathname = '/en/dashboard';
    render(<Breadcrumbs />);

    const mobile = screen.getByTestId('breadcrumbs-mobile');
    expect(mobile).toBeInTheDocument();
    expect(mobile.querySelector('button')).toBeNull();
    expect(mobile).toHaveTextContent(/dashboard/i);

    const desktop = screen.getByTestId('breadcrumbs-desktop');
    expect(desktop).toBeInTheDocument();
    expect(desktop).toHaveTextContent(/home/i);
    expect(desktop).toHaveTextContent(/dashboard/i);
  });

  it('mobile back falls back to dashboard when no in-session navigation happened', () => {
    currentPathname = '/en/admission/enquiries';
    render(<Breadcrumbs />);

    // Single mount → bumpNavCount() fires once → count === 1 → fallback.
    const backBtn = screen.getByTestId('breadcrumbs-mobile').querySelector('button');
    expect(backBtn).not.toBeNull();
    fireEvent.click(backBtn as HTMLButtonElement);
    expect(routerBack).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith('/en/dashboard');
  });

  it('mobile back calls router.back() once an in-session navigation has happened', () => {
    // Simulate a prior in-session nav by pre-seeding sessionStorage.
    window.sessionStorage.setItem('roviq:session-nav-count', '5');
    currentPathname = '/en/admission/enquiries';
    render(<Breadcrumbs />);

    const backBtn = screen.getByTestId('breadcrumbs-mobile').querySelector('button');
    fireEvent.click(backBtn as HTMLButtonElement);
    expect(routerBack).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('desktop trail renders category-only segments as plain text, not links', () => {
    currentPathname = '/en/admission/enquiries';
    render(<Breadcrumbs />);

    const desktop = screen.getByTestId('breadcrumbs-desktop');
    const links = desktop.querySelectorAll('a');
    // Only the home link — `admission` is category-only (span), `enquiries` is the leaf (span).
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('/en/dashboard');
    expect(desktop).toHaveTextContent(/admission/i);
    expect(desktop).toHaveTextContent(/enquiries/i);
  });
});
