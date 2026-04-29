/**
 * Component tests for the New Holiday page.
 *
 * Mocks `next/navigation`, `nuqs`, `@roviq/i18n`'s locale-aware router, and
 * the feature's `use-holiday` hook module. Covers the form shell, the
 * end-before-start date validation, and the permission-denied branch.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';

// Radix Select uses pointer-capture APIs happy-dom doesn't ship.
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
  usePathname: () => '/en/institute/holiday/new',
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

const createHolidayMock = vi.fn();
vi.mock('../../use-holiday', () => ({
  HOLIDAY_TYPE_VALUES: [
    'NATIONAL',
    'STATE',
    'RELIGIOUS',
    'INSTITUTE',
    'SUMMER_BREAK',
    'WINTER_BREAK',
    'OTHER',
  ] as const,
  useCreateHoliday: () => ({ mutate: createHolidayMock, loading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Import AFTER mocks.
import NewHolidayPage from '../page';

async function openAndSelectRadixOption(
  trigger: HTMLElement,
  optionName: string,
  user: ReturnType<typeof userEvent.setup>,
) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.pointerUp(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  const option = await screen.findByRole('option', { name: optionName }, { timeout: 2000 });
  fireEvent.pointerDown(option, { button: 0, pointerType: 'mouse' });
  fireEvent.pointerUp(option, { button: 0, pointerType: 'mouse' });
  await user.click(option);
}

describe('NewHolidayPage', () => {
  beforeEach(() => {
    createHolidayMock.mockReset();
    createHolidayMock.mockResolvedValue({});
    pushMock.mockReset();
  });

  it('renders the form with name (en + hi), description, type, dates, tags and isPublic', () => {
    renderWithProviders(<NewHolidayPage />);
    expect(screen.getByTestId('holiday-new-title')).toBeInTheDocument();
    // I18nField renders one input per supported locale, each with a
    // `data-testid` of `${testId}-${locale}`.
    expect(screen.getByTestId('holiday-new-name-en')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-name-hi')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-description')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-start-date')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-end-date')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-tags')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-is-public')).toBeInTheDocument();
    expect(screen.getByTestId('holiday-new-submit-btn')).toBeInTheDocument();
  });

  it('submitting with endDate earlier than startDate shows the date validation error', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewHolidayPage />);

    // Fill name.en so the i18nTextSchema check passes.
    await user.type(screen.getByTestId('holiday-new-name-en'), 'Regression holiday');
    // Pick a valid type so the object parse can reach the .refine().
    await openAndSelectRadixOption(screen.getByTestId('holiday-new-type-select'), 'National', user);
    // End BEFORE start — tripping the `END_BEFORE_START` refine.
    await user.type(screen.getByTestId('holiday-new-start-date'), '2027-04-15');
    await user.type(screen.getByTestId('holiday-new-end-date'), '2027-04-10');

    // Touch the endDate field so the error actually renders (fieldErrorMessages
    // suppresses errors on pristine fields).
    const endInput = screen.getByTestId('holiday-new-end-date') as HTMLInputElement;
    endInput.blur();

    await user.click(screen.getByTestId('holiday-new-submit-btn'));

    await waitFor(() => {
      expect(screen.getByText('End date must be on or after the start date.')).toBeInTheDocument();
    });
    expect(createHolidayMock).not.toHaveBeenCalled();
  });

  it('shows access-denied copy and hides the form when ability denies create Holiday', () => {
    renderWithProviders(<NewHolidayPage />, {
      abilityRules: [
        { action: 'manage', subject: 'all' },
        { action: 'create', subject: 'Holiday', inverted: true },
      ],
    });
    expect(screen.getByTestId('holiday-new-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('holiday-new-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('holiday-new-submit-btn')).not.toBeInTheDocument();
  });
});
