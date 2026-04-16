/**
 * ROV-168 — Component test for the admission statistics page.
 *
 * Mocks the `useAdmissionStatistics` hook and asserts KPI card values,
 * the empty state, and date-range selector wiring. Does not render the
 * Recharts internals — we stub ResponsiveContainer so JSDom (no layout
 * engine) doesn't swallow the chart children.
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
  usePathname: () => '/en/institute/admission/statistics',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
}));

// Recharts ResponsiveContainer depends on element dimensions that JSDom
// does not compute. Swap it for a plain passthrough so the child charts
// still render and we can assert on their data-testid containers.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 360 }}>{children}</div>
    ),
  };
});

const statsWithData = {
  totalEnquiries: 120,
  totalApplications: 75,
  enquiryToApplicationRate: 0.625,
  applicationToEnrolledRate: 0.4,
  funnel: [
    { stage: 'SUBMITTED', count: 60 },
    { stage: 'ENROLLED', count: 30 },
  ],
  bySource: [
    { source: 'WALK_IN', enquiryCount: 80, applicationCount: 50 },
    { source: 'REFERRAL', enquiryCount: 40, applicationCount: 25 },
  ],
};

const hookReturn: {
  data:
    | { admissionStatistics: typeof statsWithData }
    | { admissionStatistics: typeof emptyStats }
    | undefined;
  loading: boolean;
} = { data: { admissionStatistics: statsWithData }, loading: false };

const emptyStats = {
  totalEnquiries: 0,
  totalApplications: 0,
  enquiryToApplicationRate: 0,
  applicationToEnrolledRate: 0,
  funnel: [],
  bySource: [],
};

vi.mock('../../use-admission', () => ({
  useAdmissionStatistics: () => hookReturn,
}));

import StatisticsPage from '../page';

function renderPage() {
  return renderWithProviders(<StatisticsPage />, {
    messages: { admission: messagesEn },
  });
}

describe('StatisticsPage (component)', () => {
  it('renders the page title', () => {
    hookReturn.data = { admissionStatistics: statsWithData };
    hookReturn.loading = false;
    renderPage();
    expect(screen.getByTestId('statistics-title')).toHaveTextContent(messagesEn.statistics.title);
  });

  it('renders all 4 KPI cards with formatted values', () => {
    hookReturn.data = { admissionStatistics: statsWithData };
    hookReturn.loading = false;
    renderPage();
    expect(screen.getByTestId('kpi-total-enquiries')).toHaveTextContent('120');
    expect(screen.getByTestId('kpi-total-applications')).toHaveTextContent('75');
    expect(screen.getByTestId('kpi-enq-to-app')).toHaveTextContent('62.5%');
    expect(screen.getByTestId('kpi-app-to-enrolled')).toHaveTextContent('40.0%');
  });

  it('renders funnel and source-pie chart containers', () => {
    hookReturn.data = { admissionStatistics: statsWithData };
    hookReturn.loading = false;
    renderPage();
    expect(screen.getByTestId('funnel-chart')).toBeInTheDocument();
    expect(screen.getByTestId('source-pie-chart')).toBeInTheDocument();
  });

  it('lists source conversion rows with per-source applicant fraction', () => {
    hookReturn.data = { admissionStatistics: statsWithData };
    hookReturn.loading = false;
    renderPage();
    const list = screen.getByTestId('source-conversion-list');
    expect(within(list).getByTestId('source-row-WALK_IN')).toHaveTextContent('50/80');
    expect(within(list).getByTestId('source-row-REFERRAL')).toHaveTextContent('25/40');
  });

  it('shows the empty state when no enquiries or applications exist', () => {
    hookReturn.data = { admissionStatistics: emptyStats };
    hookReturn.loading = false;
    renderPage();
    expect(screen.getByTestId('statistics-empty')).toBeInTheDocument();
  });

  it('lets the user switch the date range tab', async () => {
    hookReturn.data = { admissionStatistics: statsWithData };
    hookReturn.loading = false;
    renderPage();
    const thisMonth = screen.getByTestId('range-thisMonth');
    await userEvent.click(thisMonth);
    expect(thisMonth).toHaveAttribute('aria-selected', 'true');
  });
});
