/**
 * ROV-167 — Component tests for the student detail page.
 *
 * Mocks the use-students.ts hook module so this spec focuses on the page's
 * own rendering: 6 tab triggers, sidebar admission number, profile form fields.
 */
import { AcademicStatus, AdmissionType, Gender, SocialCategory } from '@roviq/common-types';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@web/__test-utils__/render-with-providers';
import messagesEn from '@web-messages/en/students.json';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── sonner ────────────────────────────────────────────────
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

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
  gender: Gender.MALE,
  dateOfBirth: '2010-05-10',
  bloodGroup: 'O+',
  nationality: 'Indian',
  religion: 'Hindu',
  motherTongue: 'Hindi',
  admissionDate: '2025-04-01',
  admissionType: AdmissionType.NEW,
  admissionClass: 'Class 5',
  academicStatus: AcademicStatus.ENROLLED,
  socialCategory: SocialCategory.GENERAL,
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
  currentStandardName: { en: 'Class 5' },
  currentSectionName: { en: 'A' },
  primaryGuardianFirstName: null,
  primaryGuardianLastName: null,
  createdAt: '2025-04-01T00:00:00Z',
  updatedAt: '2025-04-01T00:00:00Z',
  version: 1,
};

// ── use-students hook mocks ───────────────────────────────
// Mutable refs so individual tests can override behavior without re-mocking
// the whole module.
interface MockGuardian {
  linkId: string;
  guardianProfileId: string;
  userId: string;
  firstName: Record<string, string>;
  lastName: Record<string, string> | null;
  profileImageUrl: string | null;
  occupation: string | null;
  organization: string | null;
  relationship: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickup: boolean;
  livesWith: boolean;
}

interface MockPickerGuardian {
  id: string;
  firstName: Record<string, string>;
  lastName: Record<string, string> | null;
  primaryPhone: string | null;
  occupation: string | null;
  organization: string | null;
}

const linkedGuardiansRef: { current: MockGuardian[] } = { current: [] };
const pickerGuardiansRef: { current: MockPickerGuardian[] } = { current: [] };

vi.mock('../use-students', () => ({
  useStudent: () => ({ data: { getStudent: mockStudent }, loading: false, error: undefined }),
  useStudentAcademics: () => ({ data: { listStudentAcademics: [] }, loading: false }),
  useStudentAudit: () => ({ data: { auditLogs: { edges: [], totalCount: 0 } }, loading: false }),
  useStudentDocuments: () => ({ data: { listStudentDocuments: [] }, loading: false }),
  useStudentGuardians: () => ({
    data: { listStudentGuardians: linkedGuardiansRef.current },
    loading: false,
  }),
  useStudentTCs: () => ({ data: { listTCs: [] }, loading: false }),
  useUpdateStudent: () => [vi.fn(), { loading: false }],
  useUploadStudentDocument: () => [vi.fn(), { loading: false }],
  useGuardiansForStudentPicker: () => ({
    data: { listGuardians: pickerGuardiansRef.current },
    loading: false,
  }),
}));

// Shared link mutation lives on the guardian page module — mock it here
// because the student detail page imports it via
// `../../guardians/use-guardians`.
const linkMutationMock = vi.fn<(args: unknown) => Promise<unknown>>();
vi.mock('../../guardians/use-guardians', () => ({
  useLinkGuardianToStudent: () => [(args: unknown) => linkMutationMock(args), { loading: false }],
}));

vi.mock('@web/hooks/use-form-draft', () => ({
  // Match the TanStack-Form draft contract: `{ hasDraft, restoreDraft,
  // discardDraft, saveDraft, clearDraft, storedDraft }` exposed by
  // `useFormDraft` so the new envelope shape `{ values, savedAt }` doesn't
  // leak into tests, and the profile tab's draft banner stays hidden.
  useFormDraft: () => ({
    hasDraft: false,
    restoreDraft: vi.fn(),
    discardDraft: vi.fn(),
    saveDraft: vi.fn(),
    clearDraft: vi.fn(),
    storedDraft: null,
  }),
}));

// Import AFTER mocks.
import StudentDetailPage from '../[id]/page';

function renderPage() {
  return renderWithProviders(<StudentDetailPage />, {
    messages: { students: messagesEn },
  });
}

describe('StudentDetailPage (component)', () => {
  beforeEach(() => {
    linkedGuardiansRef.current = [];
    pickerGuardiansRef.current = [];
    linkMutationMock.mockReset();
    linkMutationMock.mockResolvedValue({
      data: {
        linkGuardianToStudent: {
          id: 'new-link',
          studentProfileId: 'stu-1',
          guardianProfileId: 'gdn-1',
          relationship: 'FATHER',
          isPrimaryContact: false,
        },
      },
    });
    toastSuccess.mockReset();
    toastError.mockReset();
  });

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

// ─── Guardians tab — LinkGuardianDialog ──────────────────────────────────

describe('StudentDetailPage › Guardians tab › LinkGuardianDialog', () => {
  beforeEach(() => {
    linkedGuardiansRef.current = [];
    pickerGuardiansRef.current = [
      {
        id: 'gdn-1',
        firstName: { en: 'Anita' },
        lastName: { en: 'Verma' },
        primaryPhone: '9876543210',
        occupation: 'Teacher',
        organization: null,
      },
      {
        id: 'gdn-2',
        firstName: { en: 'Ravi' },
        lastName: { en: 'Patel' },
        primaryPhone: '9998887776',
        occupation: null,
        organization: null,
      },
    ];
    linkMutationMock.mockReset();
    linkMutationMock.mockResolvedValue({
      data: {
        linkGuardianToStudent: {
          id: 'new-link',
          studentProfileId: 'stu-1',
          guardianProfileId: 'gdn-1',
          relationship: 'FATHER',
          isPrimaryContact: false,
        },
      },
    });
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  async function openGuardiansTab(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    await user.click(
      screen.getByRole('tab', { name: new RegExp(messagesEn.detail.tabs.guardians, 'i') }),
    );
  }

  it('shows "Link guardian" button in the empty state', async () => {
    const user = userEvent.setup();
    await openGuardiansTab(user);
    expect(screen.getByTestId('student-detail-link-guardian-btn')).toBeInTheDocument();
    expect(screen.getByTestId('students-detail-guardians-empty')).toBeInTheDocument();
  });

  it('opens the Link dialog when the button is clicked', async () => {
    const user = userEvent.setup();
    await openGuardiansTab(user);
    await user.click(screen.getByTestId('student-detail-link-guardian-btn'));
    expect(await screen.findByTestId('student-detail-link-guardian-dialog')).toBeInTheDocument();
  });

  it('submit button is disabled until a guardian and a relationship are picked', async () => {
    const user = userEvent.setup();
    await openGuardiansTab(user);
    await user.click(screen.getByTestId('student-detail-link-guardian-btn'));
    const submit = await screen.findByTestId('student-detail-link-guardian-submit');
    expect(submit).toBeDisabled();
  });

  it('submits the mutation with the correct input after picking guardian + relationship', async () => {
    const user = userEvent.setup();
    await openGuardiansTab(user);
    await user.click(screen.getByTestId('student-detail-link-guardian-btn'));

    await user.click(await screen.findByTestId('student-detail-link-guardian-picker-trigger'));
    await user.click(await screen.findByTestId('student-detail-link-guardian-option-gdn-1'));

    // Relationship Select → choose FATHER via its displayed label.
    await user.click(screen.getByTestId('student-detail-link-guardian-relationship-select'));
    await user.click(await screen.findByRole('option', { name: /^father$/i }));

    const submit = screen.getByTestId('student-detail-link-guardian-submit');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => {
      expect(linkMutationMock).toHaveBeenCalledTimes(1);
    });
    const firstCall = linkMutationMock.mock.calls[0];
    if (!firstCall) throw new Error('expected link mutation to be called');
    const { variables } = firstCall[0] as {
      variables: {
        input: {
          guardianProfileId: string;
          studentProfileId: string;
          relationship: string;
          isPrimaryContact: boolean;
          isEmergencyContact: boolean;
          canPickup: boolean;
          livesWith: boolean;
        };
      };
    };
    expect(variables.input.guardianProfileId).toBe('gdn-1');
    expect(variables.input.studentProfileId).toBe('stu-1');
    expect(variables.input.relationship).toBe('FATHER');
    // Default toggle state: primary/emergency OFF, canPickup/livesWith ON.
    expect(variables.input.isPrimaryContact).toBe(false);
    expect(variables.input.isEmergencyContact).toBe(false);
    expect(variables.input.canPickup).toBe(true);
    expect(variables.input.livesWith).toBe(true);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(messagesEn.detail.guardians.linkDialog.linked);
    });
  });

  it('shows a primary-contact demotion warning when another guardian is already primary', async () => {
    linkedGuardiansRef.current = [
      {
        linkId: 'lnk-existing',
        guardianProfileId: 'gdn-existing',
        userId: 'u-existing',
        firstName: { en: 'Existing' },
        lastName: { en: 'Primary' },
        profileImageUrl: null,
        occupation: null,
        organization: null,
        relationship: 'FATHER',
        isPrimaryContact: true,
        isEmergencyContact: false,
        canPickup: true,
        livesWith: true,
      },
    ];

    const user = userEvent.setup();
    await openGuardiansTab(user);
    await user.click(screen.getByTestId('student-detail-link-guardian-btn'));

    // Warning is hidden until user toggles primary on.
    expect(
      screen.queryByTestId('student-detail-link-guardian-primary-warning'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/primary contact/i));

    expect(screen.getByTestId('student-detail-link-guardian-primary-warning')).toBeInTheDocument();
  });

  it('filters out already-linked guardians from the picker', async () => {
    linkedGuardiansRef.current = [
      {
        linkId: 'lnk-1',
        guardianProfileId: 'gdn-1',
        userId: 'u-1',
        firstName: { en: 'Anita' },
        lastName: { en: 'Verma' },
        profileImageUrl: null,
        occupation: null,
        organization: null,
        relationship: 'MOTHER',
        isPrimaryContact: false,
        isEmergencyContact: false,
        canPickup: true,
        livesWith: true,
      },
    ];

    const user = userEvent.setup();
    await openGuardiansTab(user);
    await user.click(screen.getByTestId('student-detail-link-guardian-btn'));
    await user.click(await screen.findByTestId('student-detail-link-guardian-picker-trigger'));

    // gdn-1 is already linked → must not appear as a pickable option.
    expect(
      screen.queryByTestId('student-detail-link-guardian-option-gdn-1'),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByTestId('student-detail-link-guardian-option-gdn-2'),
    ).toBeInTheDocument();
  });

  it('renders an error toast when the mutation fails', async () => {
    linkMutationMock.mockRejectedValueOnce(new Error('backend exploded'));
    const user = userEvent.setup();
    await openGuardiansTab(user);
    await user.click(screen.getByTestId('student-detail-link-guardian-btn'));
    await user.click(await screen.findByTestId('student-detail-link-guardian-picker-trigger'));
    await user.click(await screen.findByTestId('student-detail-link-guardian-option-gdn-1'));
    await user.click(screen.getByTestId('student-detail-link-guardian-relationship-select'));
    await user.click(await screen.findByRole('option', { name: /^father$/i }));

    await user.click(screen.getByTestId('student-detail-link-guardian-submit'));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('backend exploded');
    });
    // Dialog stays open on error so the user can retry.
    expect(screen.getByTestId('student-detail-link-guardian-dialog')).toBeInTheDocument();
  });
});

describe('StudentDetailPage › Guardians tab › CASL gating', () => {
  beforeEach(() => {
    linkedGuardiansRef.current = [];
    pickerGuardiansRef.current = [];
  });

  it('hides the "Link guardian" button when the user lacks "update Guardian" ability', async () => {
    renderWithProviders(<StudentDetailPage />, {
      messages: { students: messagesEn },
      abilityRules: [{ action: 'read', subject: 'Student' }],
    });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('tab', { name: new RegExp(messagesEn.detail.tabs.guardians, 'i') }),
    );
    expect(screen.queryByTestId('student-detail-link-guardian-btn')).not.toBeInTheDocument();
  });
});
