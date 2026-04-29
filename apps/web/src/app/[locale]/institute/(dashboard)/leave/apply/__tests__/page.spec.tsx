/**
 * Component tests for the Leave Apply page.
 *
 * Mocks `next/navigation`, `nuqs`, `@roviq/auth`, and the feature's `use-leave`
 * hook. Also partial-mocks `@roviq/i18n` so the locale-aware `useRouter()` used
 * by the page resolves to a spy — the rest of the i18n exports (zodValidator,
 * translators) keep their real implementations so form validation runs.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// Radix Select uses pointer-capture APIs and scrollIntoView that happy-dom
// does not ship. These minimal shims let the trigger open and items select
// via click in this spec (and are idempotent if they're already defined).
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture === 'undefined') {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture === 'undefined') {
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/leave/apply',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
}));

vi.mock('nuqs', () => ({
  parseAsString: {
    withDefault: (defaultValue: string) => ({ __kind: 'string', defaultValue }),
  },
  parseAsInteger: {
    withDefault: (defaultValue: number) => ({ __kind: 'integer', defaultValue }),
  },
  useQueryState: (_key: string, parser?: { defaultValue?: unknown }) => [
    parser && 'defaultValue' in parser ? (parser.defaultValue as unknown) : null,
    vi.fn().mockResolvedValue(null),
  ],
}));

const pushMock = vi.fn();
vi.mock('@roviq/i18n', async () => {
  const actual = await vi.importActual<typeof import('@roviq/i18n')>('@roviq/i18n');
  return {
    ...actual,
    useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  };
});

vi.mock('@roviq/auth', () => ({
  useAuth: () => ({
    // UUID v7-shaped string so the form's z.string().uuid() default passes
    // with the prefilled applicant.
    user: { membershipId: '018f3e2c-0000-7000-8000-000000000001' },
  }),
}));

vi.mock('../../../people/students/use-students', () => ({
  useStudents: () => ({
    students: [],
    totalCount: 0,
    hasNextPage: false,
    loading: false,
    loadMore: vi.fn(),
    refetch: vi.fn(),
  }),
}));

const applyMock = vi.fn();
vi.mock('../../use-leave', () => ({
  LEAVE_TYPE_VALUES: ['MEDICAL', 'CASUAL', 'BEREAVEMENT', 'EXAM', 'OTHER'] as const,
  useApplyLeave: () => ({ apply: applyMock, loading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Import AFTER mocks.
import ApplyLeavePage from '../page';

// Drives a Radix Select trigger + option click using the pointer events the
// primitive actually listens on. Used for the FILES_REQUIRED refine test
// that needs a valid `type` enum before the refinement runs.
async function openAndSelectRadixOption(
  trigger: HTMLElement,
  optionName: string,
  user: ReturnType<typeof userEvent.setup>,
) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.pointerUp(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  const option = await screen.findByRole('option', { name: optionName }, { timeout: 2000 });
  // Radix SelectItem selects on pointerUp AFTER a pointerDown on the same
  // item — mirror that sequence here.
  fireEvent.pointerDown(option, { button: 0, pointerType: 'mouse' });
  fireEvent.pointerUp(option, { button: 0, pointerType: 'mouse' });
  // Best-effort click for environments where the pointer pair alone
  // doesn't commit; Radix no-ops the second invocation.
  await user.click(option);
}

describe('ApplyLeavePage', () => {
  beforeEach(() => {
    applyMock.mockReset();
    applyMock.mockResolvedValue({});
    pushMock.mockReset();
  });

  it('renders the form shell with all expected fields', () => {
    renderWithProviders(<ApplyLeavePage />);
    expect(screen.getByTestId('leave-apply-title')).toBeInTheDocument();
    expect(screen.getByTestId('leave-apply-user-picker')).toBeInTheDocument();
    expect(screen.getByTestId('leave-apply-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('leave-apply-start-date')).toBeInTheDocument();
    expect(screen.getByTestId('leave-apply-end-date')).toBeInTheDocument();
    expect(screen.getByTestId('leave-apply-reason')).toBeInTheDocument();
    expect(screen.getByTestId('leave-apply-file-urls')).toBeInTheDocument();
    expect(screen.getByTestId('leave-apply-submit-btn')).toBeInTheDocument();
  });

  it('submitting with no reason shows the reason validation error inline', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApplyLeavePage />);

    // Pick a valid type so the reason validator is among the errors.
    await openAndSelectRadixOption(screen.getByTestId('leave-apply-type-select'), 'Medical', user);
    // Fill a 1-day range so the FILES_REQUIRED refine doesn't fire.
    await user.type(screen.getByTestId('leave-apply-start-date'), '2026-04-10');
    await user.type(screen.getByTestId('leave-apply-end-date'), '2026-04-10');

    // Touch the reason field without typing so `fieldErrorMessages()`
    // surfaces the z.string().min(1) error (it filters pristine fields).
    const reasonInput = screen.getByTestId('leave-apply-reason');
    await user.click(reasonInput);
    reasonInput.blur();

    await user.click(screen.getByTestId('leave-apply-submit-btn'));

    // The Zod `.min(1, t('fields.reason'))` message renders under the
    // textarea as a FieldError. Scope to the reason <Field> so we don't
    // match the label itself.
    const reasonField = screen.getByTestId('leave-apply-reason').closest('[data-slot="field"]');
    expect(reasonField).not.toBeNull();
    await waitFor(() => {
      if (!reasonField) throw new Error('reason field container missing');
      // The error row is under the textarea; the label also contains
      // "Reason" so we assert on a data-slot that only errors render.
      const errorEl = reasonField.querySelector('[data-slot="field-error"]');
      expect(errorEl).not.toBeNull();
    });
    expect(applyMock).not.toHaveBeenCalled();
  });

  it('surfaces the files-required error for leaves longer than 2 days with no attachments', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApplyLeavePage />);

    // Drive the Radix type select to a valid enum value so the schema's
    // `.refine(days > 2 && no files)` rule can actually run.
    await openAndSelectRadixOption(screen.getByTestId('leave-apply-type-select'), 'Medical', user);

    // 2026-04-10 → 2026-04-13 is a 4-day span which trips the
    // `FILES_REQUIRED_GT2_DAYS` refine.
    await user.type(screen.getByTestId('leave-apply-start-date'), '2026-04-10');
    await user.type(screen.getByTestId('leave-apply-end-date'), '2026-04-13');
    await user.type(screen.getByTestId('leave-apply-reason'), 'Wedding');

    // Touch the file-URLs field so `fieldErrorMessages()` surfaces errors
    // for it (it filters out pristine fields). Typing then clearing leaves
    // the value empty but the field marked touched.
    const filesInput = screen.getByTestId('leave-apply-file-urls') as HTMLInputElement;
    await user.click(filesInput);
    filesInput.blur();

    await user.click(screen.getByTestId('leave-apply-submit-btn'));

    // The refine message renders as the file-URLs field error. Scope the
    // query to the file-URLs field's surrounding <Field> so we don't match
    // the label/help copy that happens to contain the same phrase.
    const filesField = screen.getByTestId('leave-apply-file-urls').closest('[data-slot="field"]');
    expect(filesField).not.toBeNull();
    await waitFor(() => {
      if (!filesField) throw new Error('files field container missing');
      expect(filesField.textContent).toContain(
        'Leaves longer than 2 days require at least one supporting document.',
      );
    });
    expect(applyMock).not.toHaveBeenCalled();
  });

  it('shows access-denied copy and hides the form when ability denies create Leave', () => {
    renderWithProviders(<ApplyLeavePage />, {
      abilityRules: [
        { action: 'manage', subject: 'all' },
        { action: 'create', subject: 'Leave', inverted: true },
      ],
    });
    expect(screen.getByTestId('leave-apply-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('leave-apply-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leave-apply-submit-btn')).not.toBeInTheDocument();
  });
});
