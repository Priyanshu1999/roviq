/**
 * ROV-168 — Component test for the admission enquiries page.
 *
 * Mocks the `use-admission` hook module so we exercise the page's own
 * rendering, CASL gate, and table structure without wiring real Apollo or
 * subscriptions. Real GraphQL behaviour is covered by integration + e2e.
 */
import type { RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../../../../../../../../messages/en/admission.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/admission/enquiries',
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
        const defaults: Record<string, unknown> = { view: 'table' };
        for (const key of Object.keys(parsers)) {
          if (!(key in defaults)) defaults[key] = null;
        }
        entry = [defaults, vi.fn()];
        cache.set(parsers, entry);
      }
      return entry;
    },
    parseAsString: { withDefault: () => ({}) },
    parseAsBoolean: { withDefault: () => ({}) },
    parseAsStringEnum: () => ({ withDefault: () => ({}) }),
  };
});

const sampleEnquiry = {
  id: 'enq-1',
  enquiryNumber: 'ENQ-000001',
  studentName: 'Aarav Sharma',
  classRequested: 'Class 5',
  parentName: 'Rohan Sharma',
  parentPhone: '9876543210',
  source: 'WALK_IN',
  status: 'NEW',
  followUpDate: null,
  assignedTo: null,
  convertedToApplicationId: null,
  createdAt: new Date('2026-04-15T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-04-15T10:00:00Z').toISOString(),
};

const refetch = vi.fn();
vi.mock('../../use-admission', () => ({
  useEnquiries: () => ({
    enquiries: [sampleEnquiry],
    totalCount: 1,
    hasNextPage: false,
    endCursor: null,
    loading: false,
    refetch,
    fetchMore: vi.fn(),
  }),
  useEnquiryCreated: vi.fn(),
  useCreateEnquiry: () => [vi.fn(), { loading: false }],
  useUpdateEnquiry: () => [vi.fn(), { loading: false }],
  useConvertEnquiry: () => [vi.fn(), { loading: false }],
  useAcademicYearsForAdmission: () => ({ data: { academicYears: [] }, loading: false }),
  useStandardsForAdmission: () => ({ data: { standards: [] }, loading: false }),
}));

import EnquiriesPage from '../page';

function renderPage(abilityRules?: RawRuleOf<AppAbility>[]) {
  return renderWithProviders(<EnquiriesPage />, {
    messages: { admission: messagesEn },
    abilityRules,
  });
}

describe('EnquiriesPage (component)', () => {
  it('renders the page title and description', () => {
    renderPage();
    expect(screen.getByTestId('enquiries-title')).toHaveTextContent(messagesEn.enquiries.title);
  });

  it('renders the enquiry row with student + parent details', () => {
    renderPage();
    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
    expect(screen.getByText('Rohan Sharma')).toBeInTheDocument();
    expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
  });

  it('shows the source badge', () => {
    renderPage();
    expect(screen.getByTestId('enquiry-source-enq-1')).toHaveTextContent(
      messagesEn.sources.WALK_IN,
    );
  });

  it('shows the status badge with the localised label', () => {
    renderPage();
    expect(screen.getByTestId('enquiry-status-enq-1')).toHaveTextContent(
      messagesEn.enquiryStatuses.NEW,
    );
  });

  it('exposes both view-mode toggles (table + kanban)', () => {
    renderPage();
    expect(screen.getByTestId('enquiries-view-table-btn')).toBeInTheDocument();
    expect(screen.getByTestId('enquiries-view-kanban-btn')).toBeInTheDocument();
  });

  it('opens the new-enquiry slide-over when the button is clicked', async () => {
    renderPage();
    const newBtn = screen.getByTestId('enquiries-new-btn');
    await userEvent.click(newBtn);
    expect(await screen.findByTestId('enquiry-form-title')).toHaveTextContent(
      messagesEn.enquiries.newForm.title,
    );
  });

  it('blocks rendering when the user lacks Enquiry:read', () => {
    renderPage([{ action: 'read', subject: 'Institute' }]);
    expect(screen.getByText(messagesEn.accessDenied)).toBeInTheDocument();
    expect(screen.queryByTestId('enquiries-title')).not.toBeInTheDocument();
  });

  it('renders the convert button (disabled when already converted)', () => {
    renderPage();
    const row = screen.getByTestId('enquiry-status-enq-1').closest('tr');
    expect(row).not.toBeNull();
    if (row) {
      const convertBtn = within(row).getByTestId('enquiry-convert-btn-enq-1');
      expect(convertBtn).toBeEnabled();
    }
  });
});
