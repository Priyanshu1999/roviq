/**
 * ROV-170 — Component tests for the TC list page.
 *
 * Mocks `use-certificates` + nuqs + next/navigation so the spec stays focused
 * on rendering, CASL gating, and the empty state. Real Apollo wiring is
 * covered by the integration + e2e layers.
 */
import type { RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../../../../../../../messages/en/certificates.json';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';

// ── next/navigation ──────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/certificates/tc',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
}));

// ── nuqs — static defaults, no URL persistence ───────────
vi.mock('nuqs', () => ({
  useQueryStates: (parsers: Record<string, unknown>) => {
    const defaults: Record<string, unknown> = {};
    for (const key of Object.keys(parsers)) {
      defaults[key] = key === 'size' ? 25 : null;
    }
    return [defaults, vi.fn()];
  },
  parseAsString: { withDefault: () => ({}) },
  parseAsInteger: { withDefault: () => ({}) },
  parseAsArrayOf: () => ({ withDefault: () => ({}) }),
}));

// ── use-certificates hook module ─────────────────────────
const emptyTCs: Array<Record<string, unknown>> = [];
vi.mock('../use-certificates', () => ({
  useTCs: () => ({ tcs: emptyTCs, loading: false, refetch: vi.fn() }),
  useRequestTC: () => [vi.fn(), { loading: false }],
  useStudentPicker: () => ({ data: { listStudents: { edges: [] } } }),
  useAcademicYearsForCertificates: () => ({ data: { academicYears: [] } }),
}));

// Import AFTER mocks.
import TCListPage from '../tc/page';

function renderPage(abilityRules?: RawRuleOf<AppAbility>[]) {
  return renderWithProviders(<TCListPage />, {
    messages: { certificates: messagesEn },
    abilityRules,
  });
}

describe('TCListPage (component)', () => {
  it('renders the TC page title and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/transfer certificate/i);
  });

  it('renders the empty state when the tenant has no TCs', () => {
    renderPage();
    // The "no data" empty state title must appear from the certificates namespace.
    expect(screen.getAllByText(/no .*transfer certificate/i).length).toBeGreaterThan(0);
  });

  it('hides the whole page when the user lacks TC read permission', () => {
    renderPage([{ action: 'read', subject: 'Student' }]);
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
