/**
 * ROV-169 — Component tests for the guardian CREATE page.
 *
 * `useCreateGuardian` is mocked so we can assert the exact mutation variables
 * without wiring MockedProvider to the actual gql document. Radix Select is
 * difficult to open in happy-dom, so we verify each education level via its
 * shared enum + messages JSON rather than by interacting with the trigger.
 */
import { GUARDIAN_EDUCATION_LEVEL_VALUES } from '@roviq/common-types';
import { screen, waitFor } from '@testing-library/react';
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
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/people/guardians/new',
}));

// ── @roviq/i18n (partial mock for the locale-aware router) ───────────────
// The page imports `useRouter` from `@roviq/i18n`, which wraps
// `next-intl/navigation`. Partial-mocking `@roviq/i18n` replaces just
// `useRouter` and leaves every other export intact.
vi.mock('@roviq/i18n', async () => {
  const actual = await vi.importActual<typeof import('@roviq/i18n')>('@roviq/i18n');
  return {
    ...actual,
    useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  };
});

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

// ── useCreateGuardian — mocked so we can inspect variables ─
interface CreateGuardianCall {
  variables: {
    input: {
      firstName: Record<string, string>;
      lastName?: Record<string, string>;
      gender?: string;
      email?: string;
      phone?: string;
      occupation?: string;
      organization?: string;
      educationLevel?: string;
    };
  };
}

const createGuardianMock = vi.fn<(args: CreateGuardianCall) => Promise<unknown>>();

vi.mock('../use-guardians', () => ({
  useCreateGuardian: () => [
    (args: CreateGuardianCall) => createGuardianMock(args),
    { loading: false },
  ],
}));

// Import AFTER mocks so they apply.
import CreateGuardianPage from '../new/page';

// `renderWithProviders` auto-loads the full en/hi message bundle, so we do
// NOT pass a `messages` override — an override would shallow-replace the
// named namespaces (e.g. drop `common.draft.*` which the shared
// `<DraftBanner>` reads from).
function renderPage() {
  return renderWithProviders(<CreateGuardianPage />);
}

describe('CreateGuardianPage (component)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    createGuardianMock.mockReset();
    createGuardianMock.mockResolvedValue({
      data: { createGuardian: { id: 'new-guardian-id' } },
    });
    toastSuccess.mockReset();
    toastError.mockReset();
    pushMock.mockReset();
  });

  it('renders the page heading and section legends', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: baseGuardianMessages.new.title, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(baseGuardianMessages.new.sections.personal)).toBeInTheDocument();
    expect(screen.getByText(baseGuardianMessages.new.sections.contact)).toBeInTheDocument();
    expect(screen.getByText(baseGuardianMessages.new.sections.professional)).toBeInTheDocument();
  });

  it('renders all expected field labels (legends + labels)', () => {
    renderPage();
    const f = baseGuardianMessages.new.fields;
    expect(screen.getAllByText(f.firstName).length).toBeGreaterThan(0);
    expect(screen.getAllByText(f.lastName).length).toBeGreaterThan(0);
    expect(screen.getByText(f.gender)).toBeInTheDocument();
    expect(screen.getByText(f.email)).toBeInTheDocument();
    expect(screen.getByText(f.phone)).toBeInTheDocument();
    expect(screen.getByText(f.occupation)).toBeInTheDocument();
    expect(screen.getByText(f.organization)).toBeInTheDocument();
    expect(screen.getByText(f.educationLevel)).toBeInTheDocument();
  });

  it('renders the education level select trigger with placeholder', () => {
    renderPage();
    expect(
      screen.getByText(baseGuardianMessages.new.placeholders.educationLevel),
    ).toBeInTheDocument();
  });

  it('renders at least one FieldInfoPopover trigger — regression guard for contextual help', async () => {
    renderPage();
    const triggers = document.querySelectorAll('[data-slot="field-info-trigger"]');
    expect(triggers.length).toBeGreaterThan(0);

    await userEvent.click(triggers[0] as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector('[data-slot="field-info-content"]')).not.toBeNull();
    });
  });

  it('has translations for all 6 GuardianEducationLevel values', () => {
    const translated = baseGuardianMessages.new.educationLevels as Record<string, string>;
    expect(GUARDIAN_EDUCATION_LEVEL_VALUES).toHaveLength(6);
    for (const level of GUARDIAN_EDUCATION_LEVEL_VALUES) {
      expect(translated[level]).toBeTruthy();
    }
    expect(translated.ILLITERATE).toBe('No formal education');
    expect(translated.PRIMARY).toBe('Primary (up to Class 5)');
    expect(translated.SECONDARY).toBe('Secondary (Class 10 / 12)');
    expect(translated.GRADUATE).toBe('Graduate');
    expect(translated.POST_GRADUATE).toBe('Post-graduate');
    expect(translated.PROFESSIONAL).toBe('Professional (MBBS, LLB, CA, etc.)');
  });

  it('submitting with empty required first name shows validation error', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: baseGuardianMessages.new.submit }));

    await waitFor(() => {
      expect(
        screen.getByText(baseGuardianMessages.new.errors.firstNameRequired),
      ).toBeInTheDocument();
    });
    expect(createGuardianMock).not.toHaveBeenCalled();
  });

  it('happy path: fills required firstName and calls createGuardian mutation', async () => {
    const user = userEvent.setup();
    renderPage();

    const firstNameInputs = screen.getAllByPlaceholderText(
      baseGuardianMessages.new.placeholders.firstName,
    );
    const firstEn = firstNameInputs[0];
    if (!firstEn) throw new Error('expected at least one firstName input');
    await user.type(firstEn, 'Sanjay');

    await user.click(screen.getByRole('button', { name: baseGuardianMessages.new.submit }));

    await waitFor(() => {
      expect(createGuardianMock).toHaveBeenCalledTimes(1);
    });
    const firstCall = createGuardianMock.mock.calls[0];
    if (!firstCall) throw new Error('expected createGuardian to be called');
    const call = firstCall[0];
    expect(call.variables.input.firstName).toEqual({ en: 'Sanjay' });
    // Key invariant: empty optional fields are undefined, not '' — the Zod
    // preprocess wrapper coerces blank strings to undefined.
    expect(call.variables.input.educationLevel).toBeUndefined();
    expect(call.variables.input.email).toBeUndefined();
    expect(call.variables.input.phone).toBeUndefined();
    expect(call.variables.input.occupation).toBeUndefined();
    expect(call.variables.input.organization).toBeUndefined();

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(baseGuardianMessages.new.success);
    });
  });

  it('shows phone validation error when entered as non-10-digit', async () => {
    const user = userEvent.setup();
    renderPage();

    const firstNameInputs = screen.getAllByPlaceholderText(
      baseGuardianMessages.new.placeholders.firstName,
    );
    const firstEn = firstNameInputs[0];
    if (!firstEn) throw new Error('expected at least one firstName input');
    await user.type(firstEn, 'Sanjay');

    const phoneInput = screen.getByPlaceholderText(baseGuardianMessages.new.placeholders.phone);
    await user.type(phoneInput, '12345');
    await user.tab();

    await user.click(screen.getByRole('button', { name: baseGuardianMessages.new.submit }));

    await waitFor(() => {
      expect(screen.getByText(baseGuardianMessages.new.errors.phoneInvalid)).toBeInTheDocument();
    });
    expect(createGuardianMock).not.toHaveBeenCalled();
  });

  it('renders separate input rows for EN and HI on the firstName i18n field', () => {
    renderPage();
    // `I18nField` renders one `<input>` per supported locale, each with
    // a `data-testid` of `${testId}-${locale}`. Assert via testId (not
    // placeholder) since the kit only surfaces the placeholder on the
    // active-locale row.
    expect(screen.getByTestId('guardian-first-name-en')).toBeInTheDocument();
    expect(screen.getByTestId('guardian-first-name-hi')).toBeInTheDocument();
  });

  it('shows accessDenied copy when ability lacks create Guardian permission', () => {
    renderWithProviders(<CreateGuardianPage />, {
      abilityRules: [{ action: 'read', subject: 'Guardian' }],
    });
    expect(screen.getByText(baseGuardianMessages.new.accessDenied)).toBeInTheDocument();
  });

  // ── Shared DraftBanner (via common.draft.* copy) ─────────────────────
  it('renders the shared DraftBanner with the expected testId when a draft exists', () => {
    window.localStorage.setItem(
      'roviq:draft:guardians:new',
      JSON.stringify({
        values: { firstName: { en: 'Stored' } },
        savedAt: Date.now() - 60_000,
      }),
    );
    renderPage();
    // The banner root carries `data-testid="guardian-new-draft-banner"` and
    // its buttons inherit the `-restore-btn` / `-discard-btn` suffixes.
    expect(screen.getByTestId('guardian-new-draft-banner')).toBeInTheDocument();
    expect(screen.getByTestId('guardian-new-draft-banner-restore-btn')).toBeInTheDocument();
    expect(screen.getByTestId('guardian-new-draft-banner-discard-btn')).toBeInTheDocument();
  });

  it('i18n guardians bundle no longer carries the per-namespace draft keys', () => {
    const keys = Object.keys(baseGuardianMessages.new) as string[];
    expect(keys).not.toContain('draftFound');
    expect(keys).not.toContain('draftRestore');
    expect(keys).not.toContain('draftDiscard');
  });

  // ── Locale-aware navigation ─────────────────────────────────────────
  it('back button invokes the locale-aware router', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('guardian-new-back-btn'));
    expect(pushMock).toHaveBeenCalled();
  });
});
