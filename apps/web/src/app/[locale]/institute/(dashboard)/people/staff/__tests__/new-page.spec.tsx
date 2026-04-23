/**
 * Component tests for the staff CREATE page.
 *
 * Mirrors the coverage we applied to the student + guardian create pages:
 *   - rendered fields / section legends / testIds
 *   - shared DraftBanner (via `common.draft.*` copy, not per-namespace keys)
 *   - Zod schema: `dateSchema(errors.dateInvalid)` catches a bad date
 *   - locale-aware router: cancel/back trigger `@roviq/i18n` `useRouter.push`
 *   - i18n bundle hygiene: per-namespace draft keys removed
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import baseStaffMessages from '../../../../../../../../messages/en/staff.json';
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
  usePathname: () => '/en/institute/people/staff/new',
}));

// ── @roviq/i18n (partial mock for the locale-aware router) ───────────────
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

// ── use-staff hooks ────────────────────────────────────────
interface CreateStaffCall {
  variables: {
    input: {
      firstName: Record<string, string>;
      lastName?: Record<string, string>;
      gender?: string;
      dateOfBirth?: string;
      email?: string;
      phone?: string;
      designation?: string;
      department?: string;
      dateOfJoining?: string;
      employmentType?: string;
      specialization?: string;
    };
  };
}

const createStaffMock =
  vi.fn<(args: CreateStaffCall) => Promise<{ data: { createStaffMember: { id: string } } }>>();

vi.mock('../use-staff', () => ({
  useCreateStaffMember: () => [
    (args: CreateStaffCall) => createStaffMock(args),
    { loading: false },
  ],
}));

// Import AFTER mocks so they apply.
import CreateStaffPage from '../new/page';

const staffMessages = baseStaffMessages;

function renderPage() {
  return renderWithProviders(<CreateStaffPage />);
}

describe('CreateStaffPage (component)', () => {
  beforeEach(() => {
    createStaffMock.mockReset();
    createStaffMock.mockResolvedValue({
      data: { createStaffMember: { id: '019d7096-f400-77f8-9722-af44389012b9' } },
    });
    pushMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    window.localStorage.clear();
  });

  it('renders heading, section legends, and testIds across every field', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: staffMessages.new.title }),
    ).toBeInTheDocument();

    // Section legends (Personal / Contact / Employment).
    expect(screen.getByText(staffMessages.new.sections.personal)).toBeInTheDocument();
    expect(screen.getByText(staffMessages.new.sections.contact)).toBeInTheDocument();
    expect(screen.getByText(staffMessages.new.sections.employment)).toBeInTheDocument();

    // testId coverage — every interactive control the user touches.
    for (const testId of [
      'staff-new-first-name-en',
      'staff-new-first-name-hi',
      'staff-new-last-name-en',
      'staff-new-last-name-hi',
      'staff-new-gender-select',
      'staff-new-date-of-birth-input',
      'staff-new-social-category-select',
      'staff-new-email-input',
      'staff-new-phone-input',
      'staff-new-employee-id-input',
      'staff-new-designation-input',
      'staff-new-department-input',
      'staff-new-employment-type-select',
      'staff-new-date-of-joining-input',
      'staff-new-cancel-btn',
      'staff-new-back-btn',
      'staff-new-submit-btn',
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });

  // ── Shared DraftBanner (common.draft.*, not per-namespace keys) ──────
  it('renders the shared DraftBanner when a stored draft exists', () => {
    window.localStorage.setItem(
      'roviq:draft:staff:new',
      JSON.stringify({
        values: { firstName: { en: 'Stored Teacher' } },
        savedAt: Date.now() - 60_000,
      }),
    );
    renderPage();
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeInTheDocument();
  });

  it('i18n staff bundle no longer carries the per-namespace draft keys', () => {
    const keys = Object.keys(staffMessages.new) as string[];
    expect(keys).not.toContain('draftFound');
    expect(keys).not.toContain('draftRestore');
    expect(keys).not.toContain('draftDiscard');
  });

  // ── Zod schema via dateSchema(errors.dateInvalid) ────────────────────
  it('dateSchema rejects free-form date strings and surfaces the i18n dateInvalid message', async () => {
    const { z } = await import('zod');
    const { dateSchema, emptyStringToUndefined } = await import('@roviq/i18n');
    const message = staffMessages.new.errors.dateInvalid;
    const schema = z.object({
      dateOfBirth: emptyStringToUndefined(dateSchema(message).optional()),
      dateOfJoining: emptyStringToUndefined(dateSchema(message).optional()),
    });

    // Blank string → undefined (optional).
    expect(schema.parse({ dateOfBirth: '', dateOfJoining: '' })).toEqual({
      dateOfBirth: undefined,
      dateOfJoining: undefined,
    });
    // Valid ISO date passes.
    expect(schema.parse({ dateOfBirth: '2020-01-15' })).toEqual({
      dateOfBirth: '2020-01-15',
      dateOfJoining: undefined,
    });
    // Free-form / wrong format → validation failure carrying the i18n key.
    const bad = schema.safeParse({ dateOfBirth: '15/01/2020' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.message === message)).toBe(true);
    }
  });

  // ── i18n error-key presence (schema references these) ────────────────
  it('provides firstNameRequired + lastNameRequired + dateInvalid under new.errors', () => {
    const errors = staffMessages.new.errors as Record<string, string>;
    expect(errors.firstNameRequired).toBeTruthy();
    expect(errors.lastNameRequired).toBeTruthy();
    expect(errors.dateInvalid).toBeTruthy();
  });

  // ── Locale-aware navigation ──────────────────────────────────────────
  it('cancel button invokes the locale-aware router', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('staff-new-cancel-btn'));
    expect(pushMock).toHaveBeenCalled();
  });

  it('back button invokes the locale-aware router', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('staff-new-back-btn'));
    expect(pushMock).toHaveBeenCalled();
  });
});
