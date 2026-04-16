import '@testing-library/jest-dom/vitest';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const useResellersMock = vi.fn();
type SubscriptionResult = { data?: { adminResellerCreated?: ResellerNode } | undefined };
const useAdminResellerCreatedMock = vi.fn<() => SubscriptionResult>(() => ({ data: undefined }));
const useAdminResellerUpdatedMock = vi.fn<() => { data?: { adminResellerUpdated?: ResellerNode } }>(
  () => ({ data: undefined }),
);
const useAdminResellerStatusChangedMock = vi.fn<
  () => { data?: { adminResellerStatusChanged?: ResellerNode } }
>(() => ({ data: undefined }));

vi.mock('../use-resellers', () => ({
  useResellers: (...args: unknown[]) => useResellersMock(...args),
  useAdminResellerCreated: () => useAdminResellerCreatedMock(),
  useAdminResellerUpdated: () => useAdminResellerUpdatedMock(),
  useAdminResellerStatusChanged: () => useAdminResellerStatusChangedMock(),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => ({ push: pushMock, back: vi.fn(), replace: vi.fn() }),
  };
});

// nuqs without NuqsAdapter needs to fall back to no-op query state in tests.
vi.mock('nuqs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nuqs')>();
  return {
    ...actual,
    useQueryStates: () => [{ search: null, status: null, tier: null }, vi.fn()],
  };
});

import adminResellersMessages from '../../../../../../../messages/en/adminResellers.json';
import { renderWithProviders } from '../../../../../../__test-utils__/render-with-providers';
import ResellersPage from '../page';
import type { ResellerNode } from '../types';

const messages = { adminResellers: adminResellersMessages };

function makeReseller(overrides: Partial<ResellerNode> = {}): ResellerNode {
  return {
    id: 'r1',
    name: 'Acme Partners',
    slug: 'acme-partners',
    tier: 'FULL_MANAGEMENT',
    status: 'ACTIVE',
    isSystem: false,
    isActive: true,
    customDomain: null,
    suspendedAt: null,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    instituteCount: 3,
    teamSize: 5,
    branding: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ResellersPage', () => {
  beforeEach(() => {
    useResellersMock.mockReset();
    pushMock.mockReset();
    useAdminResellerCreatedMock.mockReturnValue({ data: undefined });
    useAdminResellerUpdatedMock.mockReturnValue({ data: undefined });
    useAdminResellerStatusChangedMock.mockReturnValue({ data: undefined });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header and empty state when zero resellers are returned', () => {
    useResellersMock.mockReturnValue({
      resellers: [],
      totalCount: 0,
      hasNextPage: false,
      loading: false,
      loadMore: vi.fn(),
      refetch: vi.fn(),
    });

    renderWithProviders(<ResellersPage />, { messages });

    expect(screen.getByTestId('resellers-title')).toHaveTextContent('Resellers');
    expect(screen.getByTestId('resellers-description')).toBeInTheDocument();
    expect(screen.getByTestId('resellers-empty-title')).toBeInTheDocument();
  });

  it('renders reseller rows when data is present', () => {
    const resellers = [
      makeReseller({ id: 'r1', name: 'Acme Partners' }),
      makeReseller({ id: 'r2', name: 'Beta Partners', slug: 'beta' }),
    ];
    useResellersMock.mockReturnValue({
      resellers,
      totalCount: 2,
      hasNextPage: false,
      loading: false,
      loadMore: vi.fn(),
      refetch: vi.fn(),
    });

    renderWithProviders(<ResellersPage />, { messages });

    expect(screen.getByTestId('reseller-name-cell-r1')).toBeInTheDocument();
    expect(screen.getByTestId('reseller-name-cell-r2')).toBeInTheDocument();
  });

  it('renders the Create button when the user has manage ability', () => {
    useResellersMock.mockReturnValue({
      resellers: [],
      totalCount: 0,
      hasNextPage: false,
      loading: false,
      loadMore: vi.fn(),
      refetch: vi.fn(),
    });

    renderWithProviders(<ResellersPage />, { messages });

    expect(screen.getByTestId('create-reseller-btn')).toBeInTheDocument();
  });

  it('refetches once when a subscription delivers a new reseller event', () => {
    const refetch = vi.fn();
    useResellersMock.mockReturnValue({
      resellers: [makeReseller()],
      totalCount: 1,
      hasNextPage: false,
      loading: false,
      loadMore: vi.fn(),
      refetch,
    });
    useAdminResellerCreatedMock.mockReturnValue({
      data: { adminResellerCreated: makeReseller({ id: 'brand-new' }) },
    });

    renderWithProviders(<ResellersPage />, { messages });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT refetch a second time for the same event id (dedup)', () => {
    const refetch = vi.fn();
    useResellersMock.mockReturnValue({
      resellers: [makeReseller()],
      totalCount: 1,
      hasNextPage: false,
      loading: false,
      loadMore: vi.fn(),
      refetch,
    });
    useAdminResellerCreatedMock.mockReturnValue({
      data: { adminResellerCreated: makeReseller({ id: 'same-id' }) },
    });

    const { rerender } = renderWithProviders(<ResellersPage />, { messages });
    // Simulate Apollo redelivering the same payload — the effect should NOT
    // call refetch again because the id was already recorded.
    rerender(<ResellersPage />);

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
