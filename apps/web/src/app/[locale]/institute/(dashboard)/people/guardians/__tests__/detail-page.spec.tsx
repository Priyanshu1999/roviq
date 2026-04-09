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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import baseGuardianMessages from '../../../../../../../../messages/en/guardians.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

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

vi.mock('../use-guardians', () => ({
  useGuardian: () => ({
    data: guardianStateRef.current.guardian
      ? { getGuardian: guardianStateRef.current.guardian }
      : undefined,
    loading: guardianStateRef.current.loading,
    error: guardianStateRef.current.error,
    refetch: vi.fn(),
  }),
  useGuardianLinkedStudents: () => ({ data: { listLinkedStudents: [] }, loading: false }),
  useConsentStatusForStudent: () => ({
    data: { consentStatusForStudent: [] },
    loading: false,
  }),
  useUpdateGuardian: () => [
    (args: UpdateGuardianCall) => updateGuardianMock(args),
    { loading: false },
  ],
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
