/**
 * ROV-167 — Component tests for the student detail page.
 *
 * Mocks the use-students.ts hook module so this spec focuses on the page's
 * own rendering: 6 tab triggers, sidebar admission number, profile form fields.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../../../../../../../../messages/en/students.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// next-intl 4.x eagerly calls `getRedirectFn(redirect)` at module init
// during `createNavigation()`, so the mock must expose `redirect`,
// `permanentRedirect`, `notFound`, and `RedirectType` even if unused.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ id: 'stu-1' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/people/students/stu-1',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
}));

const mockStudent = {
  id: 'stu-1',
  admissionNumber: 'ADM-0001',
  firstName: { en: 'Rajesh' },
  lastName: { en: 'Kumar' },
  gender: 'male',
  dateOfBirth: '2010-05-10',
  bloodGroup: 'O+',
  nationality: 'Indian',
  religion: 'Hindu',
  motherTongue: 'Hindi',
  admissionDate: '2025-04-01',
  admissionType: 'new',
  admissionClass: 'Class 5',
  academicStatus: 'enrolled',
  socialCategory: 'general',
  caste: null,
  isMinority: false,
  minorityType: null,
  isBpl: false,
  isCwsn: false,
  cwsnType: null,
  isRteAdmitted: false,
  rteCertificate: null,
  previousSchoolName: null,
  previousSchoolBoard: null,
  previousSchoolUdise: null,
  incomingTcNumber: null,
  incomingTcDate: null,
  tcIssued: false,
  tcNumber: null,
  tcIssuedDate: null,
  tcReason: null,
  currentStudentAcademicId: 'sa-1',
  currentStandardId: 'std-1',
  currentSectionId: 'sec-1',
  currentStandardName: 'Class 5',
  currentSectionName: 'A',
  primaryGuardianFirstName: null,
  primaryGuardianLastName: null,
  createdAt: '2025-04-01T00:00:00Z',
  updatedAt: '2025-04-01T00:00:00Z',
  version: 1,
};

vi.mock('../use-students', () => ({
  useStudent: () => ({ data: { getStudent: mockStudent }, loading: false, error: undefined }),
  useStudentAcademics: () => ({ data: { listStudentAcademics: [] }, loading: false }),
  useStudentAudit: () => ({ data: { auditLogs: { edges: [], totalCount: 0 } }, loading: false }),
  useStudentDocuments: () => ({ data: { listStudentDocuments: [] }, loading: false }),
  useStudentGuardians: () => ({ data: { listStudentGuardians: [] }, loading: false }),
  useStudentTCs: () => ({ data: { listTCs: [] }, loading: false }),
  useUpdateStudent: () => [vi.fn(), { loading: false }],
}));

vi.mock('../../../../../../../hooks/use-form-draft', () => ({
  useFormDraft: () => ({ restore: vi.fn(), clear: vi.fn() }),
}));

// Import AFTER mocks.
import StudentDetailPage from '../[id]/page';

function renderPage() {
  return renderWithProviders(<StudentDetailPage />, {
    messages: { students: messagesEn },
  });
}

describe('StudentDetailPage (component)', () => {
  it('renders all six tab triggers', () => {
    renderPage();
    const tabs = messagesEn.detail.tabs;
    expect(screen.getByRole('tab', { name: new RegExp(tabs.profile, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(tabs.academics, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(tabs.guardians, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(tabs.documents, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(tabs.tc, 'i') })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: new RegExp(tabs.audit, 'i') })).toBeInTheDocument();
  });

  it('sidebar renders the student admission number', () => {
    renderPage();
    expect(screen.getAllByText(/ADM-0001/i).length).toBeGreaterThan(0);
  });

  it('profile tab panel renders editable first/last name fields', () => {
    renderPage();
    // Profile tab is the default, so its content is in the DOM.
    const profilePanel = screen.getByRole('tabpanel', {
      name: new RegExp(messagesEn.detail.tabs.profile, 'i'),
    });
    // First name label lives inside the profile panel.
    expect(within(profilePanel).getAllByText(/first name/i).length).toBeGreaterThan(0);
  });
});
