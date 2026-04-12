/**
 * ROV-167 — Component tests for the students list page.
 *
 * Mocks the use-students.ts hook module so this spec stays focused on the
 * page's own rendering + CASL gate + bulk-action-bar behavior. Real Apollo
 * wiring is covered by integration + e2e specs.
 */
import type { RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../../../../../../../../messages/en/students.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// ── next/navigation mocks ─────────────────────────────────
// next-intl 4.x eagerly calls `getRedirectFn(redirect)` at module init
// during `createNavigation()`, so the mock must expose `redirect`,
// `permanentRedirect`, `notFound`, and `RedirectType` even if unused.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/people/students',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
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
  parseAsArrayOf: () => ({ withDefault: () => ({}) }),
  parseAsStringEnum: () => ({ withDefault: () => ({}) }),
}));

// ── use-students hook mock ────────────────────────────────
const mockStudent = {
  id: 'stu-1',
  admissionNumber: 'ADM-001',
  firstName: { en: 'Rajesh' },
  lastName: { en: 'Kumar' },
  gender: 'male',
  socialCategory: 'general',
  academicStatus: 'enrolled',
  isRteAdmitted: false,
  currentStudentAcademicId: 'sa-1',
  currentStandardId: 'std-1',
  currentSectionId: 'sec-1',
  currentStandardName: { en: 'Class 5' },
  currentSectionName: { en: 'A' },
  primaryGuardianFirstName: { en: 'Suresh' },
  primaryGuardianLastName: { en: 'Kumar' },
  admissionDate: '2025-04-01',
  createdAt: '2025-04-01T00:00:00Z',
  updatedAt: '2025-04-01T00:00:00Z',
  version: 1,
};

vi.mock('../use-students', () => ({
  useStudents: () => ({
    students: [mockStudent],
    totalCount: 1,
    hasNextPage: false,
    loading: false,
    refetch: vi.fn(),
  }),
  useStudentsInTenantUpdated: vi.fn(),
  useAcademicYearsForStudents: () => ({ data: { academicYears: [] } }),
  useStandardsForYear: () => ({ data: { standards: [] } }),
  useSectionsForStandard: () => ({ data: { sections: [] } }),
  useStudentsExport: () => [vi.fn(async () => ({ data: undefined })), { loading: false }],
  useUpdateStudentAcademic: () => [vi.fn(), { loading: false }],
}));

// Import AFTER mocks so they apply.
import StudentsPage from '../page';

function renderPage(abilityRules?: RawRuleOf<AppAbility>[]) {
  return renderWithProviders(<StudentsPage />, {
    messages: { students: messagesEn },
    abilityRules,
  });
}

describe('StudentsPage (component)', () => {
  it('renders the page title and description', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /students/i, level: 1 })).toBeInTheDocument();
  });

  it('renders column headers for the students table', () => {
    renderPage();
    // Column headers come from t('columns.*')
    expect(screen.getAllByText(/admission no/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/name/i).length).toBeGreaterThan(0);
  });

  it('shows access denied when the ability does not include Student:read', () => {
    renderPage([{ action: 'read', subject: 'Institute' }]);
    expect(screen.getByText(messagesEn.accessDenied)).toBeInTheDocument();
  });

  it('reveals the bulk action bar when a row checkbox is clicked', async () => {
    renderPage();
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is the header "select all"; skip to a row checkbox.
    const rowCheckbox = checkboxes[1] ?? checkboxes[0];
    await userEvent.click(rowCheckbox);
    // The bulk bar only mounts when selectedIds.size > 0 — look for any
    // bulk-namespaced translation string.
    const bulkStrings = messagesEn.bulk as Record<string, string>;
    const clearText = bulkStrings.clearSelection;
    expect(await screen.findByText(clearText)).toBeInTheDocument();
  });
});
