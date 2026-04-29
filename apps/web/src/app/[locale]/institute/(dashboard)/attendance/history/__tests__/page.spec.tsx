/**
 * Component tests for the Attendance History page.
 *
 * Mocks `next/navigation`, `nuqs`, `useStudents`, and the attendance `useStudentHistory`
 * hook. Three cases cover the pre-pick empty state, the populated table + summary
 * strip, and the row-level testIds.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// Per-key overrides let individual tests drive the `studentId` query param —
// the page gates the summary + table on a non-null studentId.
const QUERY_STATE_OVERRIDES: Record<string, unknown> = {};
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/attendance/history',
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
  useQueryState: (key: string, parser?: { defaultValue?: unknown }) => {
    if (key in QUERY_STATE_OVERRIDES) {
      return [QUERY_STATE_OVERRIDES[key], vi.fn().mockResolvedValue(null)];
    }
    return [
      parser && 'defaultValue' in parser ? (parser.defaultValue as unknown) : null,
      vi.fn().mockResolvedValue(null),
    ];
  },
}));

vi.mock('../../../people/students/use-students', () => ({
  useStudents: () => ({
    students: [],
    totalCount: 0,
    hasNextPage: false,
    loading: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
  }),
}));

interface HistoryRowFixture {
  sessionId: string;
  sectionId: string;
  date: string;
  period: number | null;
  subjectId: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE';
  remarks: string | null;
  markedAt: string;
}
const hookState: { rows: HistoryRowFixture[] } = { rows: [] };

vi.mock('../../use-attendance', () => ({
  useStudentHistory: () => ({
    rows: hookState.rows,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
}));

// Import AFTER mocks.
import AttendanceHistoryPage from '../page';

describe('AttendanceHistoryPage', () => {
  it('renders the "pick a student" empty-state when no studentId is selected', () => {
    for (const key of Object.keys(QUERY_STATE_OVERRIDES)) delete QUERY_STATE_OVERRIDES[key];
    renderWithProviders(<AttendanceHistoryPage />);
    expect(screen.getByTestId('attendance-history-title')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a student to view their attendance history.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('history-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('history-table')).not.toBeInTheDocument();
  });

  it('renders the summary strip + table once a student is picked and rows are returned', () => {
    QUERY_STATE_OVERRIDES.studentId = 'stu-1';
    hookState.rows = [
      {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        date: '2026-04-10',
        period: 1,
        subjectId: 'sub-math',
        status: 'PRESENT',
        remarks: null,
        markedAt: '2026-04-10T09:00:00Z',
      },
      {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        date: '2026-04-10',
        period: 2,
        subjectId: 'sub-eng',
        status: 'ABSENT',
        remarks: 'Sick',
        markedAt: '2026-04-10T10:00:00Z',
      },
    ];
    renderWithProviders(<AttendanceHistoryPage />);
    expect(screen.getByTestId('history-summary')).toBeInTheDocument();
    expect(screen.getByTestId('history-summary-PRESENT')).toHaveTextContent('Present: 1');
    expect(screen.getByTestId('history-summary-ABSENT')).toHaveTextContent('Absent: 1');
    expect(screen.getByTestId('history-table')).toBeInTheDocument();
  });

  it('emits the expected row-level testIds for each returned history item', () => {
    QUERY_STATE_OVERRIDES.studentId = 'stu-1';
    hookState.rows = [
      {
        sessionId: 'sess-1',
        sectionId: 'sec-1',
        date: '2026-04-10',
        period: 1,
        subjectId: null,
        status: 'LATE',
        remarks: null,
        markedAt: '2026-04-10T09:00:00Z',
      },
    ];
    renderWithProviders(<AttendanceHistoryPage />);
    // Row key is `${sessionId}-${date}-${period ?? 'day'}`.
    const rowKey = 'sess-1-2026-04-10-1';
    const dateCell = screen.getByTestId(`history-row-${rowKey}-date`);
    const statusCell = screen.getByTestId(`history-row-${rowKey}-status`);
    expect(dateCell).toBeInTheDocument();
    expect(statusCell).toHaveTextContent('Late');
    // Row key scope-check: the cells sit inside the history table.
    const table = screen.getByTestId('history-table');
    expect(within(table).getByTestId(`history-row-${rowKey}-date`)).toBeInTheDocument();
  });
});
