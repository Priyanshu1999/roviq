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
// Cache by parsers reference so each render returns the SAME tuple. Without
// this, `setFilters` is a fresh vi.fn() each call → useEffect deps that
// include setFilters re-fire forever and OOM the worker.
vi.mock('nuqs', () => {
  const cache = new WeakMap<object, [Record<string, unknown>, ReturnType<typeof vi.fn>]>();
  return {
    useQueryStates: (parsers: Record<string, unknown>) => {
      let entry = cache.get(parsers);
      if (!entry) {
        const defaults: Record<string, unknown> = {};
        for (const key of Object.keys(parsers)) {
          defaults[key] = key === 'size' ? 25 : null;
        }
        entry = [defaults, vi.fn()];
        cache.set(parsers, entry);
      }
      return entry;
    },
    parseAsString: { withDefault: () => ({}) },
    parseAsInteger: { withDefault: () => ({}) },
    parseAsArrayOf: () => ({ withDefault: () => ({}) }),
  };
});

// ── use-certificates hook module ─────────────────────────
// Stable references — see nuqs mock note above. New objects each render
// would re-fire the dialog's `[open, yearsData, ...]` effect → reset() loop.
const emptyTCs: Array<Record<string, unknown>> = [];
const tcsResult = { tcs: emptyTCs, loading: false, refetch: vi.fn() };
const requestTCResult: [ReturnType<typeof vi.fn>, { loading: boolean }] = [
  vi.fn(),
  { loading: false },
];
const studentPickerResult = { data: { listStudents: { edges: [] } } };
const yearsResult = { data: { academicYears: [] } };
vi.mock('../use-certificates', () => ({
  useTCs: () => tcsResult,
  useRequestTC: () => requestTCResult,
  useStudentPicker: () => studentPickerResult,
  useAcademicYearsForCertificates: () => yearsResult,
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
