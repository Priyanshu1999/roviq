import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Stub `next-intl/navigation`. The @roviq/i18n barrel re-exports helpers from
// `createNavigation`, which transitively `import 'next/navigation'` (no `.js`
// extension). Next 16's package.json has no `exports` field, so Node 24's
// strict ESM resolver rejects that import. UI tests don't exercise routing,
// so stub the module at the resolver boundary instead of patching next-intl.
vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: () => null,
    redirect: vi.fn(),
    usePathname: vi.fn(() => '/'),
    useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
    getPathname: vi.fn(() => '/'),
  }),
}));

afterEach(() => {
  cleanup();
});
