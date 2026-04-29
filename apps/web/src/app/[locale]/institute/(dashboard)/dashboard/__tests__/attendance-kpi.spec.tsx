/**
 * Component tests for the dashboard AttendanceKpiCard.
 *
 * The KPI is an internal sub-component of `dashboard/page.tsx` (not exported),
 * so we mount the whole page and scope assertions to the card's testId
 * `dashboard-attendance-kpi-card`. Three cases cover:
 *   1. Card renders when useDateCounts returns counts.
 *   2. Card shows the `noData` copy when useDateCounts returns [].
 *   3. Card is hidden (via `<Can I="read" a="Attendance">`) when the ability
 *      denies read on Attendance.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/dashboard',
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

interface Count {
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE';
  count: number;
}
const hookState: { counts: Count[] } = { counts: [] };

vi.mock('../../attendance/use-attendance', () => ({
  useDateCounts: () => ({ counts: hookState.counts, loading: false, refetch: vi.fn() }),
  // Re-export any other attendance hook names the page might pull in — the
  // dashboard itself only imports useDateCounts today but this keeps the
  // mock forward-compatible without breaking if the import set shifts.
  useSessionsForSection: () => ({ sessions: [], loading: false, refetch: vi.fn() }),
  useSessionEntries: () => ({ entries: [], loading: false, refetch: vi.fn() }),
  useSessionCounts: () => ({ counts: [] }),
  useOpenSession: () => ({ openSession: vi.fn(), loading: false }),
  useOverrideSession: () => ({ override: vi.fn(), loading: false }),
  useMarkAttendance: () => ({ mark: vi.fn(), loading: false }),
  useBulkMarkAttendance: () => ({ bulkMark: vi.fn(), loading: false }),
  useStudentsInSection: () => ({ students: [], loading: false }),
}));

// Import AFTER mocks.
import DashboardPage from '../page';

describe('Dashboard AttendanceKpiCard', () => {
  it('renders the KPI card with status badges when counts are returned', () => {
    hookState.counts = [
      { status: 'PRESENT', count: 25 },
      { status: 'ABSENT', count: 3 },
      { status: 'LEAVE', count: 1 },
      { status: 'LATE', count: 2 },
    ];
    renderWithProviders(<DashboardPage />);
    const card = screen.getByTestId('dashboard-attendance-kpi-card');
    expect(card).toBeInTheDocument();
    expect(within(card).getByTestId('dashboard-attendance-kpi-PRESENT')).toHaveTextContent('25');
    expect(within(card).getByTestId('dashboard-attendance-kpi-ABSENT')).toHaveTextContent('3');
    expect(within(card).getByTestId('dashboard-attendance-kpi-LEAVE')).toHaveTextContent('1');
    expect(within(card).getByTestId('dashboard-attendance-kpi-LATE')).toHaveTextContent('2');
  });

  it('shows the no-data copy on the KPI card when useDateCounts returns []', () => {
    hookState.counts = [];
    renderWithProviders(<DashboardPage />);
    const card = screen.getByTestId('dashboard-attendance-kpi-card');
    expect(card).toBeInTheDocument();
    expect(within(card).getByText('No attendance recorded today yet.')).toBeInTheDocument();
    // The status badges are hidden when total === 0 and not loading.
    expect(within(card).queryByTestId('dashboard-attendance-kpi-PRESENT')).not.toBeInTheDocument();
  });

  it('hides the KPI card entirely when the ability denies read on Attendance', () => {
    hookState.counts = [{ status: 'PRESENT', count: 1 }];
    renderWithProviders(<DashboardPage />, {
      abilityRules: [
        { action: 'manage', subject: 'all' },
        { action: 'read', subject: 'Attendance', inverted: true },
      ],
    });
    expect(screen.queryByTestId('dashboard-attendance-kpi-card')).not.toBeInTheDocument();
  });
});
