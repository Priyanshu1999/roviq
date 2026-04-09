/**
 * ROV-169 — Component tests for the guardian list page.
 *
 * The `use-guardians` hook module is mocked so this spec focuses on the
 * page's rendering + CASL gate + search input presence. Real Apollo wiring
 * is covered by integration + e2e specs.
 *
 * NOTE on messages: the test supplements a few translation keys the page
 * uses that are not yet authored in `messages/en/guardians.json`
 * (`accessDenied`, `addGuardian`, `totalCount`, a handful of column headers).
 * These are supplied inline so the component can render in isolation
 * without next-intl throwing on a missing key.
 */
import type { RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import baseMessages from '../../../../../../../../messages/en/guardians.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// ── next/navigation mocks ─────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/people/guardians',
}));

// ── nuqs mock — static defaults, no URL persistence ──────
vi.mock('nuqs', () => ({
  useQueryStates: (parsers: Record<string, unknown>) => {
    const defaults: Record<string, unknown> = {};
    for (const key of Object.keys(parsers)) {
      defaults[key] = null;
    }
    return [defaults, vi.fn()];
  },
  parseAsString: { withDefault: () => ({}) },
  parseAsInteger: { withDefault: () => ({}) },
  parseAsBoolean: { withDefault: () => ({}) },
}));

// ── use-guardians hook mock ──────────────────────────────
vi.mock('../use-guardians', () => ({
  useGuardians: () => ({ data: { listGuardians: [] }, loading: false }),
  useGuardian: () => ({ data: undefined, loading: false }),
}));

// Import AFTER mocks so they apply.
import GuardiansPage from '../page';

const ACCESS_DENIED_TEXT = 'You do not have permission to view guardians';

const guardianMessages: Record<string, unknown> = {
  ...baseMessages,
  accessDenied: ACCESS_DENIED_TEXT,
  addGuardian: 'Add guardian',
  totalCount: '{count} guardians',
  columns: {
    ...(baseMessages.columns as Record<string, string>),
    photo: 'Photo',
    organization: 'Organization',
    designation: 'Designation',
    educationLevel: 'Education level',
  },
};

// Minimal `common` namespace — the page calls `useTranslations('common')`
// even though our assertions don't target any specific common strings.
const commonMessages = { loading: 'Loading', error: 'Error' };

function renderPage(abilityRules?: RawRuleOf<AppAbility>[]) {
  return renderWithProviders(<GuardiansPage />, {
    messages: { guardians: guardianMessages, common: commonMessages },
    abilityRules,
  });
}

describe('GuardiansPage (component)', () => {
  it('renders the page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /^guardians$/i, level: 1 })).toBeInTheDocument();
  });

  it('renders the search input', () => {
    renderPage();
    const filters = baseMessages.filters as Record<string, string>;
    expect(
      screen.getByPlaceholderText(filters.search) || screen.getByLabelText(filters.search),
    ).toBeInTheDocument();
  });

  it('shows access denied when ability does not include Guardian:read', () => {
    renderPage([{ action: 'read', subject: 'Institute' }]);
    expect(screen.getByText(ACCESS_DENIED_TEXT)).toBeInTheDocument();
  });
});
