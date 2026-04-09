/**
 * ROV-169 — Component tests for the staff list page.
 *
 * The `use-staff` hook module is mocked so this spec stays focused on the
 * page's rendering + CASL gate + column headers. Real Apollo wiring is
 * covered by integration + e2e specs.
 */
import type { RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../../../../../../../../messages/en/staff.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// ── next/navigation mocks ─────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/people/staff',
}));

// ── nuqs mock — static defaults, no URL persistence ──────
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
  parseAsBoolean: { withDefault: () => ({}) },
}));

// ── use-staff hook mock ──────────────────────────────────
vi.mock('../use-staff', () => ({
  useStaff: () => ({
    staff: [],
    loading: false,
    refetch: vi.fn(),
  }),
  useStaffMember: () => ({ data: undefined, loading: false }),
  useUpdateStaffMember: () => [vi.fn(), { loading: false }],
  useStaffQualifications: () => ({ data: undefined, loading: false }),
  useCreateStaffQualification: () => [vi.fn(), { loading: false }],
  useUpdateStaffQualification: () => [vi.fn(), { loading: false }],
  useDeleteStaffQualification: () => [vi.fn(), { loading: false }],
}));

// Import AFTER mocks so they apply.
import StaffPage from '../page';

function renderPage(abilityRules?: RawRuleOf<AppAbility>[]) {
  return renderWithProviders(<StaffPage />, {
    messages: { staff: messagesEn },
    abilityRules,
  });
}

describe('StaffPage (component)', () => {
  it('renders the page title and the Add Staff button', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /^staff$/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add staff/i })).toBeInTheDocument();
  });

  it('shows access denied when ability does not include Staff:read', () => {
    renderPage([{ action: 'read', subject: 'Institute' }]);
    expect(screen.getByText(messagesEn.accessDenied)).toBeInTheDocument();
  });

  it('renders the empty-state description when there are no staff rows', () => {
    renderPage();
    // The noData description comes from t('empty.noDataDescription').
    const emptyStrings = messagesEn.empty as Record<string, string>;
    expect(screen.getByText(emptyStrings.noDataDescription)).toBeInTheDocument();
  });
});
