/**
 * Component tests for the Leaves list page.
 *
 * Mirrors the attendance page spec: mocks `next/navigation`, `nuqs`, the
 * feature's `use-leave` hook module, and the shared students hook. Three
 * cases cover the happy render, table rows with status badges, and the
 * ability-denied branch.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/leave',
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

// The leave picker pulls from the students list to resolve names — stub
// it out so the Popover never triggers a real Apollo query.
vi.mock('../../people/students/use-students', () => ({
  useStudents: () => ({
    students: [],
    totalCount: 0,
    hasNextPage: false,
    loading: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
  }),
}));

// useAuth is invoked by LeavesTable to pick up the approver membershipId —
// not used in the three cases below, but must resolve so the render doesn't
// throw "useAuth must be used within an AuthProvider".
vi.mock('@roviq/auth', () => ({
  useAuth: () => ({ user: { membershipId: 'me-1' } }),
}));

interface LeaveFixture {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: 'MEDICAL' | 'CASUAL' | 'BEREAVEMENT' | 'EXAM' | 'OTHER';
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  fileUrls: string[];
  decidedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const hookState: { leaves: LeaveFixture[] } = { leaves: [] };

vi.mock('../use-leave', () => ({
  LEAVE_STATUS_VALUES: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const,
  LEAVE_TYPE_VALUES: ['MEDICAL', 'CASUAL', 'BEREAVEMENT', 'EXAM', 'OTHER'] as const,
  useLeaves: () => ({
    leaves: hookState.leaves,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useApproveLeave: () => ({ approve: vi.fn(), loading: false }),
  useRejectLeave: () => ({ reject: vi.fn(), loading: false }),
  useCancelLeave: () => ({ cancel: vi.fn(), loading: false }),
  useApplyLeave: () => ({ apply: vi.fn(), loading: false }),
  useUpdateLeave: () => ({ update: vi.fn(), loading: false }),
  useDeleteLeave: () => ({ remove: vi.fn(), loading: false }),
  useLeave: () => ({ leave: null, loading: false, error: undefined, refetch: vi.fn() }),
}));

// Import AFTER mocks so they apply.
import LeavesPage from '../page';

describe('LeavesPage', () => {
  it('renders title + tabs and the empty-state copy when there are no leaves', () => {
    hookState.leaves = [];
    renderWithProviders(<LeavesPage />);
    expect(screen.getByTestId('leave-title')).toBeInTheDocument();
    expect(screen.getByTestId('leave-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('leave-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('leave-tab-pending')).toBeInTheDocument();
    expect(screen.getByText('No leave applications found.')).toBeInTheDocument();
  });

  it('renders a row per leave with the right status badge text', () => {
    hookState.leaves = [
      {
        id: 'leave-1',
        userId: 'stu-1',
        startDate: '2026-04-10',
        endDate: '2026-04-11',
        type: 'CASUAL',
        reason: 'Family function',
        status: 'PENDING',
        fileUrls: [],
        decidedBy: null,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'leave-2',
        userId: 'stu-2',
        startDate: '2026-04-12',
        endDate: '2026-04-13',
        type: 'MEDICAL',
        reason: 'Sick leave',
        status: 'APPROVED',
        fileUrls: [],
        decidedBy: 'mem-1',
        createdAt: '2026-04-02T00:00:00Z',
        updatedAt: '2026-04-02T00:00:00Z',
      },
    ];
    renderWithProviders(<LeavesPage />);
    expect(screen.getByTestId('leave-row-leave-1-status')).toHaveTextContent('Pending');
    expect(screen.getByTestId('leave-row-leave-2-status')).toHaveTextContent('Approved');
    expect(screen.getByTestId('leave-row-leave-1-type')).toHaveTextContent('Casual');
    expect(screen.getByTestId('leave-row-leave-2-type')).toHaveTextContent('Medical');
  });

  it('hides the page and shows access-denied copy when ability denies read on Leave', () => {
    hookState.leaves = [];
    renderWithProviders(<LeavesPage />, {
      abilityRules: [
        { action: 'manage', subject: 'all' },
        { action: 'read', subject: 'Leave', inverted: true },
      ],
    });
    expect(screen.getByTestId('leave-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('leave-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leave-tabs')).not.toBeInTheDocument();
  });
});
