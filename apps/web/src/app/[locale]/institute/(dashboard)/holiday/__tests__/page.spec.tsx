/**
 * Component tests for the Holidays list page.
 *
 * Mocks `next/navigation`, `nuqs`, and the feature's `use-holiday` hook so we
 * can exercise the title + add-button branch, the empty state, and the table
 * row rendering with the i18n-resolved name + type badge.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/institute/holiday',
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
  RedirectType: { push: 'push', replace: 'replace' },
}));

// Per-key overrides for the nuqs mock. The holiday page defaults `view` to
// 'calendar' via `parseAsString.withDefault('calendar')` — flip it to
// 'table' for these tests so the `HolidaysTable` branch renders (the
// empty-state copy and the row testIds live in the table view).
const QUERY_STATE_OVERRIDES: Record<string, unknown> = { view: 'table' };
vi.mock('nuqs', () => ({
  parseAsString: {
    withDefault: (defaultValue: string) => ({ __kind: 'string', defaultValue }),
  },
  parseAsInteger: {
    withDefault: (defaultValue: number) => ({ __kind: 'integer', defaultValue }),
  },
  useQueryState: (key: string, parser?: { defaultValue?: unknown }) => {
    if (key in QUERY_STATE_OVERRIDES) {
      return [QUERY_STATE_OVERRIDES[key], vi.fn().mockResolvedValue(null)];
    }
    return [
      parser && 'defaultValue' in parser ? (parser.defaultValue as unknown) : null,
      vi.fn().mockResolvedValue(null),
    ];
  },
}));

interface HolidayFixture {
  id: string;
  name: Record<string, string>;
  description: string | null;
  type:
    | 'NATIONAL'
    | 'STATE'
    | 'RELIGIOUS'
    | 'INSTITUTE'
    | 'SUMMER_BREAK'
    | 'WINTER_BREAK'
    | 'OTHER';
  startDate: string;
  endDate: string;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

const hookState: { holidays: HolidayFixture[] } = { holidays: [] };

vi.mock('../use-holiday', () => ({
  HOLIDAY_TYPE_VALUES: [
    'NATIONAL',
    'STATE',
    'RELIGIOUS',
    'INSTITUTE',
    'SUMMER_BREAK',
    'WINTER_BREAK',
    'OTHER',
  ] as const,
  useHolidays: () => ({
    holidays: hookState.holidays,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useHoliday: () => ({ holiday: null, loading: false, error: undefined, refetch: vi.fn() }),
  useHolidaysOnDate: () => ({
    holidays: [],
    loading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useCreateHoliday: () => ({ mutate: vi.fn(), loading: false }),
  useUpdateHoliday: () => ({ mutate: vi.fn(), loading: false }),
  useDeleteHoliday: () => ({ mutate: vi.fn(), loading: false }),
}));

// Import AFTER mocks.
import HolidaysPage from '../page';

describe('HolidaysPage', () => {
  it('renders title + add button when the user can create Holiday', () => {
    hookState.holidays = [];
    renderWithProviders(<HolidaysPage />);
    expect(screen.getByTestId('holiday-title')).toBeInTheDocument();
    // The add-button is gated by `<Can I="update" a="Holiday">`, which the
    // permissive default ability satisfies.
    expect(screen.getByTestId('holiday-add-btn')).toBeInTheDocument();
  });

  it('renders the empty-state copy when useHolidays returns []', () => {
    hookState.holidays = [];
    renderWithProviders(<HolidaysPage />);
    expect(screen.getByText('No holidays found.')).toBeInTheDocument();
    expect(screen.queryByTestId('holiday-table')).not.toBeInTheDocument();
  });

  it('renders a row per holiday with the resolved name and type badge', () => {
    hookState.holidays = [
      {
        id: 'hol-1',
        name: { en: 'Republic Day', hi: 'गणतंत्र दिवस' },
        description: null,
        type: 'NATIONAL',
        startDate: '2027-01-26',
        endDate: '2027-01-26',
        tags: ['gazetted'],
        isPublic: true,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      },
      {
        id: 'hol-2',
        name: { en: 'Diwali', hi: 'दीपावली' },
        description: null,
        type: 'RELIGIOUS',
        startDate: '2027-11-08',
        endDate: '2027-11-08',
        tags: [],
        isPublic: false,
        createdAt: '2026-04-02T00:00:00Z',
        updatedAt: '2026-04-02T00:00:00Z',
      },
    ];
    renderWithProviders(<HolidaysPage />);

    expect(screen.getByTestId('holiday-row-hol-1-name')).toHaveTextContent('Republic Day');
    expect(screen.getByTestId('holiday-row-hol-1-type')).toHaveTextContent('National');
    expect(screen.getByTestId('holiday-row-hol-2-name')).toHaveTextContent('Diwali');
    expect(screen.getByTestId('holiday-row-hol-2-type')).toHaveTextContent('Religious');
  });
});
