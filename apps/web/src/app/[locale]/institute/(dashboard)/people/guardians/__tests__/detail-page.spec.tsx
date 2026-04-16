/**
 * ROV-169 — Component tests for the guardian DETAIL page.
 *
 * Mocks every `use-guardians` hook the page + subcomponents reach for so the
 * spec focuses on rendering, tab structure, profile form submit, and the
 * concurrency error path. The detail page uses plain <input> elements for
 * occupation/organization/designation/educationLevel — it is NOT a Select —
 * so those assertions live next to the shared enum drift check in
 * `new-page.spec.tsx`.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@web/__test-utils__/render-with-providers';

import baseGuardianMessages from '@web-messages/en/guardians.json';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The `detailMessages` mix-in below includes every translation key the page
// exercises in tests; the raw `linkDialog` nested keys that ship with
// `guardians.json` already cover the new dialog (no additional supplements
// required).

// ── next/navigation ───────────────────────────────────────
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
  useParams: () => ({ id: 'guardian-1' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/people/guardians/guardian-1',
}));

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

// Draft auto-save is now inline `localStorage` via TanStack Form
// `listeners.onChange` (replaces the retired `useFormDraft` hook) — no
// mock needed; happy-dom's localStorage is a no-op under test.

// ── Hook fixtures ─────────────────────────────────────────
interface MockGuardian {
  id: string;
  userId: string;
  membershipId: string;
  firstName: Record<string, string>;
  lastName: Record<string, string> | null;
  profileImageUrl: string | null;
  gender: string | null;
  primaryPhone: string | null;
  linkedStudentCount: number;
  occupation: string | null;
  organization: string | null;
  designation: string | null;
  educationLevel: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const FIXTURE_GUARDIAN: MockGuardian = {
  id: 'guardian-1',
  userId: 'user-1',
  membershipId: 'mem-1',
  firstName: { en: 'Priya', hi: '' },
  lastName: { en: 'Sharma', hi: '' },
  profileImageUrl: null,
  gender: 'female',
  primaryPhone: '9876543210',
  linkedStudentCount: 1,
  occupation: 'Accountant',
  organization: 'Infosys',
  designation: null,
  educationLevel: 'GRADUATE',
  version: 3,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-10T00:00:00Z',
};

interface UpdateGuardianCall {
  variables: {
    id: string;
    input: {
      occupation?: string;
      organization?: string;
      designation?: string;
      educationLevel?: string;
      version: number;
    };
  };
}

const updateGuardianMock = vi.fn<(args: UpdateGuardianCall) => Promise<unknown>>();
const guardianStateRef: {
  current: { guardian: MockGuardian | null; loading: boolean; error: unknown };
} = {
  current: { guardian: FIXTURE_GUARDIAN, loading: false, error: undefined },
};

// Mutable refs so individual tests can override linked-students + picker
// results without re-mocking the whole module.
interface MockLinkedStudent {
  linkId: string;
  studentProfileId: string;
  firstName: Record<string, string>;
  lastName: Record<string, string> | null;
  admissionNumber: string;
  currentStandardName: Record<string, string> | null;
  currentSectionName: Record<string, string> | null;
  profileImageUrl: string | null;
  relationship: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickup: boolean;
  livesWith: boolean;
}

interface MockPickerStudent {
  id: string;
  admissionNumber: string;
  firstName: Record<string, string>;
  lastName: Record<string, string> | null;
  currentStandardName: Record<string, string> | null;
  currentSectionName: Record<string, string> | null;
}

const linkedStudentsRef: { current: MockLinkedStudent[] } = { current: [] };
const pickerStudentsRef: { current: MockPickerStudent[] } = { current: [] };
const linkMutationMock = vi.fn<(args: unknown) => Promise<unknown>>();

vi.mock('../use-guardians', () => ({
  useGuardian: () => ({
    data: guardianStateRef.current.guardian
      ? { getGuardian: guardianStateRef.current.guardian }
      : undefined,
    loading: guardianStateRef.current.loading,
    error: guardianStateRef.current.error,
    refetch: vi.fn(),
  }),
  useGuardianLinkedStudents: () => ({
    data: { listLinkedStudents: linkedStudentsRef.current },
    loading: false,
  }),
  useConsentStatusForStudent: () => ({
    data: { consentStatusForStudent: [] },
    loading: false,
  }),
  useUpdateGuardian: () => [
    (args: UpdateGuardianCall) => updateGuardianMock(args),
    { loading: false },
  ],
  useLinkGuardianToStudent: () => [(args: unknown) => linkMutationMock(args), { loading: false }],
  useStudentsForGuardianPicker: () => ({
    data: {
      listStudents: { edges: pickerStudentsRef.current.map((node) => ({ node })) },
    },
    loading: false,
  }),
}));

// Import AFTER mocks.
import GuardianDetailPage from '../[id]/page';

// The detail page uses translation keys that are not yet authored in
// messages/en/guardians.json — supplement them here (mirrors what
// `page.spec.tsx` does for the list page).
const detailMessages = {
  ...baseGuardianMessages,
  accessDenied: 'You do not have permission to view guardians',
  detail: {
    ...baseGuardianMessages.detail,
    back: 'Back to guardians',
    notFound: 'Guardian not found',
    notFoundDescription: 'This guardian may have been deleted or never existed.',
    tabs: {
      profile: 'Profile',
      children: 'Linked children',
      audit: 'Audit',
    },
    sidebar: {
      primaryFor: '{count, plural, one {Primary for # child} other {Primary for # children}}',
    },
    profile: {
      firstName: 'First name',
      lastName: 'Last name',
      occupation: 'Occupation',
      organization: 'Organization',
      designation: 'Designation',
      educationLevel: 'Education level',
      save: 'Save changes',
      saving: 'Saving…',
      saved: 'Profile updated',
      concurrencyError: 'This guardian was updated by someone else — refresh and retry',
      refresh: 'Refresh',
    },
    children: {
      ...baseGuardianMessages.detail.children,
      empty: 'No children linked yet',
      emptyDescription: 'Link students from the students page.',
    },
  },
};

const commonMessages = { loading: 'Loading', error: 'Error' };

function renderPage() {
  return renderWithProviders(<GuardianDetailPage />, {
    messages: { guardians: detailMessages, common: commonMessages },
  });
}

describe('GuardianDetailPage (component)', () => {
  beforeEach(() => {
    updateGuardianMock.mockReset();
    updateGuardianMock.mockResolvedValue({
      data: {
        updateGuardian: { ...FIXTURE_GUARDIAN, version: FIXTURE_GUARDIAN.version + 1 },
      },
    });
    toastSuccess.mockReset();
    toastError.mockReset();
    pushMock.mockReset();
    // Reset state between tests.
    guardianStateRef.current = {
      guardian: FIXTURE_GUARDIAN,
      loading: false,
      error: undefined,
    };
  });

  it('renders guardian name and occupation in the sidebar', () => {
    renderPage();
    expect(screen.getAllByText(/Priya Sharma/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Accountant/).length).toBeGreaterThan(0);
  });

  it('renders all three tabs (Profile / Children / Audit)', () => {
    renderPage();
    expect(
      screen.getByRole('tab', { name: new RegExp(detailMessages.detail.tabs.profile, 'i') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: new RegExp(detailMessages.detail.tabs.children, 'i') }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: new RegExp(detailMessages.detail.tabs.audit, 'i') }),
    ).toBeInTheDocument();
  });

  it('Profile tab is the default selected tab', () => {
    renderPage();
    const profileTab = screen.getByRole('tab', {
      name: new RegExp(detailMessages.detail.tabs.profile, 'i'),
    });
    expect(profileTab).toHaveAttribute('aria-selected', 'true');
  });

  it('profile form pre-fills occupation + organization + educationLevel from fixture', () => {
    renderPage();
    const panel = screen.getByRole('tabpanel', {
      name: new RegExp(detailMessages.detail.tabs.profile, 'i'),
    });
    const occ = within(panel).getByLabelText(detailMessages.detail.profile.occupation);
    const org = within(panel).getByLabelText(detailMessages.detail.profile.organization);
    // Education level is a Radix `<Select>` after the TanStack Form
    // migration, not a plain input, so it has no `.value` attribute.
    // The pre-populated label is exposed as text content on the combobox
    // trigger; match case-insensitively to stay resilient against future
    // i18n label tweaks ("Graduate", "Graduate (Bachelor's degree)", etc.).
    const edu = within(panel).getByRole('combobox', {
      name: new RegExp(detailMessages.detail.profile.educationLevel, 'i'),
    });
    expect(occ).toHaveValue('Accountant');
    expect(org).toHaveValue('Infosys');
    expect(edu).toHaveTextContent(/graduate/i);
  });

  it('Save button is disabled while the form is pristine', () => {
    renderPage();
    const saveBtn = screen.getByRole('button', {
      name: new RegExp(detailMessages.detail.profile.save, 'i'),
    });
    expect(saveBtn).toBeDisabled();
  });

  it('edits occupation and calls updateGuardian with the new value + fixture version', async () => {
    const user = userEvent.setup();
    renderPage();

    const panel = screen.getByRole('tabpanel', {
      name: new RegExp(detailMessages.detail.tabs.profile, 'i'),
    });
    const occ = within(panel).getByLabelText(detailMessages.detail.profile.occupation);
    await user.clear(occ);
    await user.type(occ, 'Chartered Accountant');

    const saveBtn = screen.getByRole('button', {
      name: new RegExp(detailMessages.detail.profile.save, 'i'),
    });
    await waitFor(() => {
      expect(saveBtn).toBeEnabled();
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(updateGuardianMock).toHaveBeenCalledTimes(1);
    });
    const firstCall = updateGuardianMock.mock.calls[0];
    if (!firstCall) throw new Error('expected updateGuardian to be called');
    const call = firstCall[0];
    expect(call.variables.id).toBe(FIXTURE_GUARDIAN.id);
    expect(call.variables.input.occupation).toBe('Chartered Accountant');
    expect(call.variables.input.organization).toBe('Infosys');
    expect(call.variables.input.educationLevel).toBe('GRADUATE');
    // Optimistic concurrency: must pass the current fixture version.
    expect(call.variables.input.version).toBe(FIXTURE_GUARDIAN.version);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(detailMessages.detail.profile.saved);
    });
  });

  it('concurrency error on save shows error toast with refresh action', async () => {
    updateGuardianMock.mockRejectedValueOnce(new Error('version mismatch: CONCURRENT update'));
    const user = userEvent.setup();
    renderPage();

    const panel = screen.getByRole('tabpanel', {
      name: new RegExp(detailMessages.detail.tabs.profile, 'i'),
    });
    const occ = within(panel).getByLabelText(detailMessages.detail.profile.occupation);
    await user.clear(occ);
    await user.type(occ, 'Audit Manager');

    const saveBtn = screen.getByRole('button', {
      name: new RegExp(detailMessages.detail.profile.save, 'i'),
    });
    await waitFor(() => {
      expect(saveBtn).toBeEnabled();
    });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    const firstErrorCall = toastError.mock.calls[0];
    if (!firstErrorCall) throw new Error('expected toast.error to be called');
    expect(firstErrorCall[0]).toBe(detailMessages.detail.profile.concurrencyError);
    // Second argument carries the refresh action — verify its label.
    const opts = firstErrorCall[1] as { action?: { label: string } } | undefined;
    expect(opts?.action?.label).toBe(detailMessages.detail.profile.refresh);
  });

  it('renders loading skeleton when the detail query is still loading', () => {
    guardianStateRef.current = { guardian: null, loading: true, error: undefined };
    renderPage();
    // No tabs while loading.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renders not-found empty state when the guardian does not exist', () => {
    guardianStateRef.current = { guardian: null, loading: false, error: undefined };
    renderPage();
    expect(screen.getByText(detailMessages.detail.notFound)).toBeInTheDocument();
    expect(screen.getByText(detailMessages.detail.notFoundDescription)).toBeInTheDocument();
  });
});

// ─── Children tab — LinkStudentDialog ───────────────────────────────────

describe('GuardianDetailPage › Children tab › LinkStudentDialog', () => {
  beforeEach(() => {
    guardianStateRef.current = {
      guardian: FIXTURE_GUARDIAN,
      loading: false,
      error: undefined,
    };
    linkedStudentsRef.current = [];
    pickerStudentsRef.current = [
      {
        id: 'stu-1',
        admissionNumber: 'ADM-0001',
        firstName: { en: 'Rahul' },
        lastName: { en: 'Singh' },
        currentStandardName: { en: 'Class 5' },
        currentSectionName: { en: 'A' },
      },
      {
        id: 'stu-2',
        admissionNumber: 'ADM-0002',
        firstName: { en: 'Priya' },
        lastName: { en: 'Nair' },
        currentStandardName: { en: 'Class 6' },
        currentSectionName: { en: 'B' },
      },
    ];
    linkMutationMock.mockReset();
    linkMutationMock.mockResolvedValue({
      data: {
        linkGuardianToStudent: {
          id: 'new-link',
          studentProfileId: 'stu-1',
          guardianProfileId: FIXTURE_GUARDIAN.id,
          relationship: 'FATHER',
          isPrimaryContact: false,
        },
      },
    });
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  async function openChildrenTab(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    await user.click(
      screen.getByRole('tab', {
        name: new RegExp(detailMessages.detail.tabs.children, 'i'),
      }),
    );
  }

  it('shows "Link student" button in the empty state', async () => {
    const user = userEvent.setup();
    await openChildrenTab(user);
    expect(screen.getByTestId('guardian-detail-link-student-btn')).toBeInTheDocument();
  });

  it('opens the Link dialog when the button is clicked', async () => {
    const user = userEvent.setup();
    await openChildrenTab(user);
    await user.click(screen.getByTestId('guardian-detail-link-student-btn'));
    expect(await screen.findByTestId('guardian-detail-link-student-dialog')).toBeInTheDocument();
  });

  it('submit disabled until student + relationship are chosen', async () => {
    const user = userEvent.setup();
    await openChildrenTab(user);
    await user.click(screen.getByTestId('guardian-detail-link-student-btn'));
    const submit = await screen.findByTestId('guardian-detail-link-student-submit');
    expect(submit).toBeDisabled();
  });

  it('submits the mutation with the correct input', async () => {
    const user = userEvent.setup();
    await openChildrenTab(user);
    await user.click(screen.getByTestId('guardian-detail-link-student-btn'));

    await user.click(await screen.findByTestId('guardian-detail-link-student-picker-trigger'));
    await user.click(await screen.findByTestId('guardian-detail-link-student-option-stu-1'));

    await user.click(screen.getByTestId('guardian-detail-link-student-relationship-select'));
    await user.click(await screen.findByRole('option', { name: /^mother$/i }));

    const submit = screen.getByTestId('guardian-detail-link-student-submit');
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
    expect(variables.input.guardianProfileId).toBe(FIXTURE_GUARDIAN.id);
    expect(variables.input.studentProfileId).toBe('stu-1');
    expect(variables.input.relationship).toBe('MOTHER');
    expect(variables.input.isPrimaryContact).toBe(false);
    expect(variables.input.isEmergencyContact).toBe(false);
    expect(variables.input.canPickup).toBe(true);
    expect(variables.input.livesWith).toBe(true);
  });

  it('surfaces the primary-contact warning when primary is toggled on', async () => {
    const user = userEvent.setup();
    await openChildrenTab(user);
    await user.click(screen.getByTestId('guardian-detail-link-student-btn'));

    expect(
      screen.queryByTestId('guardian-detail-link-student-primary-warning'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/primary contact/i));
    expect(screen.getByTestId('guardian-detail-link-student-primary-warning')).toBeInTheDocument();
  });

  it('filters out already-linked students from the picker', async () => {
    linkedStudentsRef.current = [
      {
        linkId: 'lnk-1',
        studentProfileId: 'stu-1',
        firstName: { en: 'Rahul' },
        lastName: { en: 'Singh' },
        admissionNumber: 'ADM-0001',
        currentStandardName: null,
        currentSectionName: null,
        profileImageUrl: null,
        relationship: 'FATHER',
        isPrimaryContact: false,
        isEmergencyContact: false,
        canPickup: true,
        livesWith: true,
      },
    ];

    const user = userEvent.setup();
    await openChildrenTab(user);
    await user.click(screen.getByTestId('guardian-detail-link-student-btn'));
    await user.click(await screen.findByTestId('guardian-detail-link-student-picker-trigger'));

    expect(
      screen.queryByTestId('guardian-detail-link-student-option-stu-1'),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByTestId('guardian-detail-link-student-option-stu-2'),
    ).toBeInTheDocument();
  });

  it('renders error toast on mutation failure and keeps dialog open', async () => {
    linkMutationMock.mockRejectedValueOnce(new Error('backend rejected'));
    const user = userEvent.setup();
    await openChildrenTab(user);
    await user.click(screen.getByTestId('guardian-detail-link-student-btn'));
    await user.click(await screen.findByTestId('guardian-detail-link-student-picker-trigger'));
    await user.click(await screen.findByTestId('guardian-detail-link-student-option-stu-1'));
    await user.click(screen.getByTestId('guardian-detail-link-student-relationship-select'));
    await user.click(await screen.findByRole('option', { name: /^father$/i }));
    await user.click(screen.getByTestId('guardian-detail-link-student-submit'));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('backend rejected');
    });
    expect(screen.getByTestId('guardian-detail-link-student-dialog')).toBeInTheDocument();
  });
});

describe('GuardianDetailPage › Children tab › CASL gating', () => {
  beforeEach(() => {
    guardianStateRef.current = {
      guardian: FIXTURE_GUARDIAN,
      loading: false,
      error: undefined,
    };
    linkedStudentsRef.current = [];
  });

  it('hides the "Link student" button without "update Guardian" ability', async () => {
    renderWithProviders(<GuardianDetailPage />, {
      messages: { guardians: detailMessages, common: commonMessages },
      abilityRules: [{ action: 'read', subject: 'Guardian' }],
    });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('tab', {
        name: new RegExp(detailMessages.detail.tabs.children, 'i'),
      }),
    );
    expect(screen.queryByTestId('guardian-detail-link-student-btn')).not.toBeInTheDocument();
  });
});
