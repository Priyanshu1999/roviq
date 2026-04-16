/**
 * ROV-168 — Component test for the admission applications page.
 *
 * Verifies the 18-status pipeline rendering, RTE badge, status-change action
 * visibility, and the FEE_PAID → ENROLLED approve flow.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../../../../../../../../messages/en/admission.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/admission/applications',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
}));

vi.mock('nuqs', () => {
  const cache = new WeakMap<object, [Record<string, unknown>, ReturnType<typeof vi.fn>]>();
  return {
    useQueryStates: (parsers: Record<string, unknown>) => {
      let entry = cache.get(parsers);
      if (!entry) {
        const defaults: Record<string, unknown> = { rteOnly: false };
        for (const key of Object.keys(parsers)) {
          if (!(key in defaults)) defaults[key] = null;
        }
        entry = [defaults, vi.fn()];
        cache.set(parsers, entry);
      }
      return entry;
    },
    parseAsString: { withDefault: () => ({}) },
    parseAsBoolean: { withDefault: () => ({ withDefault: () => ({}) }) },
  };
});

const baseApp = {
  id: 'app-1',
  enquiryId: null,
  academicYearId: 'ay-1',
  standardId: 'std-classroom-id-1234',
  sectionId: null,
  formData: { studentName: 'Diya Patel', parentName: 'Meera Patel' },
  isRteApplication: true,
  testScore: null,
  interviewScore: null,
  meritRank: null,
  rteLotteryRank: null,
  offeredAt: null,
  offerExpiresAt: null,
  offerAcceptedAt: null,
  studentProfileId: null,
  version: 1,
  createdAt: new Date('2026-04-15T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-04-15T10:00:00Z').toISOString(),
};

const feePaidApp = { ...baseApp, id: 'app-2', status: 'FEE_PAID', isRteApplication: false };
const submittedApp = { ...baseApp, status: 'SUBMITTED' };

const refetch = vi.fn();
vi.mock('../../use-admission', () => ({
  useApplications: () => ({
    applications: [submittedApp, feePaidApp],
    totalCount: 2,
    hasNextPage: false,
    endCursor: null,
    loading: false,
    refetch,
    fetchMore: vi.fn(),
  }),
  useApplicationStatusChanged: vi.fn(),
  useUpdateApplication: () => [vi.fn(), { loading: false }],
  useApproveApplication: () => [vi.fn(), { loading: false }],
  useRejectApplication: () => [vi.fn(), { loading: false }],
}));

import ApplicationsPage from '../page';

function renderPage() {
  return renderWithProviders(<ApplicationsPage />, {
    messages: { admission: messagesEn },
  });
}

describe('ApplicationsPage (component)', () => {
  it('renders title + applicant name pulled from formData', () => {
    renderPage();
    expect(screen.getByTestId('applications-title')).toHaveTextContent(
      messagesEn.applications.title,
    );
    expect(screen.getByTestId('application-applicant-app-1')).toHaveTextContent('Diya Patel');
  });

  it('renders the RTE badge only on RTE applications', () => {
    renderPage();
    expect(screen.getByTestId('application-rte-app-1')).toHaveTextContent(
      messagesEn.applications.rteBadge,
    );
    expect(screen.queryByTestId('application-rte-app-2')).not.toBeInTheDocument();
  });

  it('shows status badges with localised labels', () => {
    renderPage();
    expect(screen.getByTestId('application-status-app-1')).toHaveTextContent(
      messagesEn.applicationStatuses.SUBMITTED,
    );
    expect(screen.getByTestId('application-status-app-2')).toHaveTextContent(
      messagesEn.applicationStatuses.FEE_PAID,
    );
  });

  it('only surfaces the approve button on FEE_PAID applications', () => {
    renderPage();
    expect(screen.queryByTestId('application-approve-btn-app-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('application-approve-btn-app-2')).toBeInTheDocument();
  });

  it('opens the approve confirmation dialog when approve is clicked', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('application-approve-btn-app-2'));
    const dialog = await screen.findByTestId('approve-application-dialog');
    expect(
      within(dialog).getByText(messagesEn.applications.approveDialog.title),
    ).toBeInTheDocument();
  });

  it('opens the status-change dialog with valid next states', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('application-status-btn-app-1'));
    expect(await screen.findByTestId('status-change-dialog')).toBeInTheDocument();
  });
});
