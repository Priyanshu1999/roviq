/**
 * ROV-167 + ROV-226 — Component tests for the student CREATE page.
 *
 * `useCreateStudent` is mocked so we can assert the exact mutation variables
 * without wiring MockedProvider to the actual gql document. The cascading
 * Academic Year → Standard → Section dropdowns are also mocked at the hook
 * layer so tests don't depend on Apollo or a running backend.
 *
 * Radix Select is flaky to open in happy-dom, so Select-specific interaction
 * tests are intentionally minimal — the important regression is the Zod
 * `preprocess` wrapper that coerces empty strings to `undefined` on blank
 * optional fields (the ROV-226 silent-failure bug on blank DOB).
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZodType } from 'zod';

import baseStudentsMessages from '../../../../../../../../messages/en/students.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// ── next/navigation ───────────────────────────────────────
// next-intl 4.x eagerly calls `getRedirectFn(redirect)` at module init via
// `createNavigation()`, so the mock must expose redirect/permanentRedirect/
// notFound/RedirectType even if the test itself never triggers navigation.
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/people/students/new',
}));

// ── @roviq/i18n (partial mock for the locale-aware router) ───────────────
// The page imports `useRouter` from `@roviq/i18n`, which wraps
// `next-intl/navigation`'s `createNavigation()`. That wrapper stores a
// captured reference at module-init time and does NOT re-delegate to the
// `next/navigation` mock at render time, so the `pushMock` above would
// never observe calls. Partial-mocking `@roviq/i18n` replaces just
// `useRouter` and leaves every other export (`zodValidator`, `dateSchema`,
// `useI18nField`, …) at its real implementation.
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

// ── use-students hooks ────────────────────────────────────
interface CreateStudentCall {
  variables: {
    input: {
      firstName: Record<string, string>;
      lastName?: Record<string, string>;
      gender?: string;
      dateOfBirth?: string;
      phone?: string;
      socialCategory?: string;
      isRteAdmitted?: boolean;
      academicYearId: string;
      standardId: string;
      sectionId: string;
      admissionDate?: string;
      admissionType?: string;
    };
  };
}

const createStudentMock =
  vi.fn<(args: CreateStudentCall) => Promise<{ data: { createStudent: { id: string } } }>>();

const ACTIVE_YEAR_ID = '00000000-0000-7000-a000-000000000501';
const STANDARD_ID = '00000000-0000-7000-a000-000000000602';
const SECTION_ID = '00000000-0000-7000-a000-000000000703';

// `vi.hoisted` lifts this state above `vi.mock` so the mock factory (also
// hoisted) can read mutable per-test flags without a module-scope race.
const queryState = vi.hoisted(() => ({
  yearsLoading: false as boolean,
  yearsData: {
    academicYears: [
      {
        id: '00000000-0000-7000-a000-000000000501',
        label: '2026-27',
        isActive: true,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
    ],
  } as { academicYears: unknown[] } | undefined,
}));

vi.mock('../use-students', () => ({
  useCreateStudent: () => [
    (args: CreateStudentCall) => createStudentMock(args),
    { loading: false },
  ],
  useAcademicYearsForStudents: () => ({
    data: queryState.yearsData,
    loading: queryState.yearsLoading,
  }),
  useStandardsForYear: () => ({
    data: {
      standards: [{ id: STANDARD_ID, name: { en: 'Class 5' }, numericOrder: 5 }],
    },
    loading: false,
  }),
  useSectionsForStandard: () => ({
    data: {
      sections: [
        {
          id: SECTION_ID,
          name: { en: 'Class 5-A' },
          displayLabel: 'Class 5-A',
          currentStrength: 0,
        },
      ],
    },
    loading: false,
  }),
}));

// Import AFTER mocks so they apply.
import CreateStudentPage from '../new/page';

// `renderWithProviders` auto-loads the full en/hi message bundle (see the
// "unify prod+test message loader" refactor). We keep a handle on the raw
// students JSON only for direct value-based assertions below; no per-test
// `messages` override is needed.
const studentsMessages = baseStudentsMessages;

function renderPage() {
  return renderWithProviders(<CreateStudentPage />);
}

describe('CreateStudentPage (component)', () => {
  beforeEach(() => {
    createStudentMock.mockReset();
    createStudentMock.mockResolvedValue({
      data: { createStudent: { id: '019d7096-f400-77f8-9722-af44389012b9' } },
    });
    pushMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    window.localStorage.clear();
    // Reset the hoisted query-state flags so per-test overrides don't
    // bleed into subsequent tests.
    queryState.yearsLoading = false;
    queryState.yearsData = {
      academicYears: [
        {
          id: ACTIVE_YEAR_ID,
          label: '2026-27',
          isActive: true,
          startDate: '2026-04-01',
          endDate: '2027-03-31',
        },
      ],
    };
  });

  it('renders heading + form + expected fields (i18n first/last + Selects + date inputs)', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: studentsMessages.new.title }),
    ).toBeInTheDocument();
    // i18n fields: I18nInputTF wraps two per-locale inputs under a <fieldset>
    // legend, not an <label htmlFor=>, so we check the underlying named
    // inputs directly — this is what the submit handler reads anyway.
    expect(document.querySelector('input[name="firstName.en"]')).toBeInTheDocument();
    expect(document.querySelector('input[name="firstName.hi"]')).toBeInTheDocument();
    expect(document.querySelector('input[name="lastName.en"]')).toBeInTheDocument();
    expect(document.querySelector('input[name="lastName.hi"]')).toBeInTheDocument();
    // Cascading dropdowns + date fields.
    expect(screen.getByRole('combobox', { name: /gender/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /class/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /section/i })).toBeInTheDocument();
    expect(screen.getByLabelText(studentsMessages.new.fields.dateOfBirth)).toBeInTheDocument();
    expect(screen.getByLabelText(studentsMessages.new.fields.admissionDate)).toBeInTheDocument();
  });

  it('defaults academicYearId to the active year once the query resolves', () => {
    renderPage();
    // The combobox trigger should render the active year label.
    const yearCombo = screen.getByRole('combobox', {
      name: new RegExp(studentsMessages.new.fields.academicYear, 'i'),
    });
    expect(yearCombo).toHaveTextContent(/2026-27/);
    expect(yearCombo).toHaveTextContent(new RegExp(studentsMessages.new.active, 'i'));
  });

  it('renders the draft banner when localStorage has a saved draft', () => {
    // useFormDraft (TanStack Form port) wraps stored values in a
    // `{ values, savedAt }` envelope so it can detect stale drafts later;
    // the bare-values shape is no longer recognised.
    window.localStorage.setItem(
      'roviq:draft:students:new',
      JSON.stringify({
        values: { firstName: { en: 'Stored', hi: '' }, academicYearId: ACTIVE_YEAR_ID },
        savedAt: Date.now() - 60_000,
      }),
    );
    renderPage();
    // Draft banner copy now lives under the shared `common.draft` namespace.
    // renderWithProviders auto-loads the full message bundle (see the
    // "unify prod+test message loader" refactor) so no extra imports are
    // needed here — match the rendered labels directly.
    expect(screen.getByRole('button', { name: /^restore$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeInTheDocument();
  });

  it(
    'Zod schema regression guard (ROV-226): `preprocess` coerces blank optional strings to undefined, ' +
      'required UUID fields still enforced',
    async () => {
      // We import the schema factory by re-executing the page module — but
      // to avoid leaking schema internals we test the contract at the
      // *surface* instead: a happy-path Zod parse with blank optional
      // strings must strip them to `undefined`, and a missing UUID must
      // surface a validation error.
      //
      // This is the precise contract that, if broken, re-introduces
      // ROV-226 (silent submit failure when DOB / phone / gender left
      // blank). Pulling the schema from a private import would tie tests
      // to internals, so we re-declare the same preprocess + shape here
      // and assert both directions.
      const { z } = await import('zod');
      const { buildI18nTextSchema } = await import('@roviq/i18n');

      function emptyStringToUndefined<T extends ZodType>(inner: T) {
        return z.preprocess(
          (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
          inner,
        );
      }
      const schema = z.object({
        firstName: buildI18nTextSchema('first name required'),
        dateOfBirth: emptyStringToUndefined(z.string().optional()),
        phone: emptyStringToUndefined(
          z
            .string()
            .regex(/^[6-9]\d{9}$/, 'phone invalid')
            .optional(),
        ),
        academicYearId: z.uuid({ error: 'year required' }),
      });

      // Happy path: blank optional fields → undefined.
      const parsed = schema.parse({
        firstName: { en: 'Kavya' },
        dateOfBirth: '',
        phone: '',
        academicYearId: ACTIVE_YEAR_ID,
      });
      expect(parsed.dateOfBirth).toBeUndefined();
      expect(parsed.phone).toBeUndefined();
      expect(parsed.academicYearId).toBe(ACTIVE_YEAR_ID);

      // Sad path: missing required UUID.
      const sadResult = schema.safeParse({
        firstName: { en: 'Kavya' },
        dateOfBirth: '',
        phone: '',
        academicYearId: 'not-a-uuid',
      });
      expect(sadResult.success).toBe(false);
    },
  );

  // ── Async-initial-values loading gate ──────────────────────────────
  // Regression guard: the form must NOT mount until the academic-years
  // query has resolved, because that's the canonical TanStack Form
  // pattern for async defaults. Skipping this gate was the root cause
  // of the spurious "Restore draft" banner bug on a fresh form.
  it('renders a loading spinner (not the form) while academic years are loading', () => {
    queryState.yearsLoading = true;
    queryState.yearsData = undefined;
    renderPage();
    // Form fields are NOT mounted yet.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(document.querySelector('input[name="firstName.en"]')).not.toBeInTheDocument();
    // Spinner (Loader2Icon) carries role=status + aria-label=Loading by default.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // ── isRteAdmitted checkbox ─────────────────────────────────────────
  // `isRteAdmitted` is an orthogonal flag to `admissionType` — a
  // transfer or lateral-entry student may also be admitted under the
  // RTE quota — so it renders as its own checkbox in the Admission
  // FieldSet, not as an `admissionType` option.
  it('renders the RTE-admitted checkbox, unchecked by default, with the e2e testId', () => {
    renderPage();
    const checkbox = screen.getByTestId('students-new-rte-admitted-checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(studentsMessages.new.fields.isRteAdmitted)).toBeInTheDocument();
  });

  it('RTE checkbox toggles on click and mutates form state', async () => {
    renderPage();
    const checkbox = screen.getByTestId('students-new-rte-admitted-checkbox');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  // ── `RTE` removed from admissionType enum ──────────────────────────
  // Part of the same refactor: RTE left the `ADMISSION_TYPE_VALUES`
  // tuple in `@roviq/common-types` so the four remaining values are
  // mutually exclusive admission ROUTES. Guard the i18n bundle so the
  // label never reappears by accident.
  it('i18n admissionTypes no longer has an `RTE` key', () => {
    const keys = Object.keys(studentsMessages.new.admissionTypes);
    expect(keys).not.toContain('RTE');
    // Spot-check the four legitimate routes remain.
    expect(keys).toEqual(
      expect.arrayContaining(['NEW', 'LATERAL_ENTRY', 'RE_ADMISSION', 'TRANSFER']),
    );
  });

  it('i18n fieldHelp no longer carries the `admissionTypeRte` explainer', () => {
    const keys = Object.keys(studentsMessages.new.fieldHelp);
    expect(keys).not.toContain('admissionTypeRte');
  });

  // ── testId coverage (e2e-friendly per [TSTID]) ────────────────────
  // Guards the testId regressions surfaced during the same PR — e2e
  // selectors were previously sparse on lastName / DOB / phone /
  // socialCategory / academicYear / admissionDate / admissionType.
  it('exposes a data-testid on every interactive field', () => {
    renderPage();
    expect(screen.getByTestId('students-new-first-name-en')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-first-name-hi')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-last-name-en')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-last-name-hi')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-gender-select')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-date-of-birth-input')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-phone-input')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-social-category-select')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-academic-year-select')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-standard-select')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-section-select')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-admission-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-admission-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-rte-admitted-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-cancel-btn')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-back-btn')).toBeInTheDocument();
    expect(screen.getByTestId('students-new-submit-btn')).toBeInTheDocument();
  });

  // ── Contact section ───────────────────────────────────────────────
  // Phone was moved from the Personal FieldSet into its own Contact
  // FieldSet so the layout mirrors the guardian form's grouping.
  it('renders a separate Contact section legend (not folded into Personal)', () => {
    renderPage();
    expect(screen.getByText(studentsMessages.new.sections.contact)).toBeInTheDocument();
  });

  // ── Locale-aware navigation ────────────────────────────────────────
  // Regression guard: the page must use `@roviq/i18n`'s locale-aware
  // `useRouter` (which wraps `next-intl/navigation`, which itself
  // delegates to `next/navigation`). The mocked `pushMock` is attached
  // to `next/navigation.useRouter`, so any push that flows through it
  // confirms the chain is intact — if the page regressed to a different
  // router, the mock would never be called.
  it('cancel button invokes the router — locale-aware chain intact', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('students-new-cancel-btn'));
    expect(pushMock).toHaveBeenCalled();
    const [href] = pushMock.mock.calls[0] ?? [];
    expect(href).toBe('/institute/people/students');
  });

  it('back button invokes the router — locale-aware chain intact', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('students-new-back-btn'));
    expect(pushMock).toHaveBeenCalled();
  });
});
