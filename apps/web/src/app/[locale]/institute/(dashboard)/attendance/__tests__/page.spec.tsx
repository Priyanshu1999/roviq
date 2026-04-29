import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';
import AttendancePage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/attendance',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
}));

vi.mock('nuqs', () => ({
  parseAsString: {
    withDefault: (defaultValue: string) => ({ __kind: 'string', defaultValue }),
  },
  parseAsInteger: {
    withDefault: (defaultValue: number) => ({ __kind: 'integer', defaultValue }),
  },
  useQueryState: (_key: string, parser?: { defaultValue?: unknown }) => [
    parser && 'defaultValue' in parser ? (parser.defaultValue as unknown) : null,
    vi.fn().mockResolvedValue(null),
  ],
}));

const academicYear = { id: 'ay-1', status: 'ACTIVE' as const };

vi.mock('../../academic-years/use-academic-years', () => ({
  useAcademicYears: () => ({ years: [academicYear], loading: false }),
}));

// The attendance page now calls `useAuth()` to gate actions on the current
// membership. Stub it so the page renders without needing an AuthProvider.
vi.mock('@roviq/auth', () => ({
  useAuth: () => ({
    user: { membershipId: 'mem-1', username: 'lecturer@example.com' },
  }),
}));

vi.mock('../../academics/use-academics', () => ({
  useStandards: () => ({ standards: [], loading: false }),
  useSections: () => ({ sections: [], loading: false }),
}));

const hookState = {
  students: [] as Array<Record<string, unknown>>,
  sessions: [] as Array<Record<string, unknown>>,
  entries: [] as Array<Record<string, unknown>>,
  sessionCounts: [] as Array<{ status: string; count: number }>,
  dayCounts: [] as Array<{ status: string; count: number }>,
};

vi.mock('../use-attendance', () => ({
  useSessionsForSection: () => ({ sessions: hookState.sessions, loading: false, refetch: vi.fn() }),
  useSessionEntries: () => ({ entries: hookState.entries, loading: false, refetch: vi.fn() }),
  useSessionCounts: () => ({ counts: hookState.sessionCounts }),
  useDateCounts: () => ({ counts: hookState.dayCounts, loading: false }),
  useOpenSession: () => ({ openSession: vi.fn(), loading: false }),
  useOverrideSession: () => ({ override: vi.fn(), loading: false }),
  useMarkAttendance: () => ({ mark: vi.fn(), loading: false }),
  useBulkMarkAttendance: () => ({ bulkMark: vi.fn(), loading: false }),
  useStudentsInSection: () => ({ students: hookState.students, loading: false }),
}));

describe('AttendancePage', () => {
  it('renders the title and reports link when the user has read permission', () => {
    renderWithProviders(<AttendancePage />);
    expect(screen.getByTestId('attendance-title')).toBeInTheDocument();
    expect(screen.getByTestId('attendance-reports-link')).toBeInTheDocument();
  });

  it('shows the section-picker empty state until a section is chosen', () => {
    renderWithProviders(<AttendancePage />);
    // The Users icon empty state copy keyed at attendance.selectSectionFirst.
    expect(screen.getByText('Choose a section to take attendance')).toBeInTheDocument();
  });

  it('hides the feature when the current ability denies read on Attendance', () => {
    renderWithProviders(<AttendancePage />, {
      // Permissive manage on everything EXCEPT Attendance — closest to a
      // role without the attendance subject granted.
      abilityRules: [
        { action: 'manage', subject: 'all' },
        { action: 'read', subject: 'Attendance', inverted: true },
        { action: 'create', subject: 'Attendance', inverted: true },
        { action: 'update', subject: 'Attendance', inverted: true },
        { action: 'delete', subject: 'Attendance', inverted: true },
      ],
    });
    expect(screen.getByText('You do not have permission to view attendance.')).toBeInTheDocument();
    expect(screen.queryByTestId('attendance-title')).not.toBeInTheDocument();
  });
});
