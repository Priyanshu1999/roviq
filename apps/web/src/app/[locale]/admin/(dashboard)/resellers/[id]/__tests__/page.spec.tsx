import '@testing-library/jest-dom/vitest';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const useResellerMock = vi.fn();
const useUpdateResellerMock = vi.fn(() => [vi.fn(), { loading: false }]);
const useChangeResellerTierMock = vi.fn(() => [vi.fn(), { loading: false }]);
const useSuspendResellerMock = vi.fn(() => [vi.fn(), { loading: false }]);
const useUnsuspendResellerMock = vi.fn(() => [vi.fn(), { loading: false }]);
const useDeleteResellerMock = vi.fn(() => [vi.fn(), { loading: false }]);

vi.mock('../../use-resellers', () => ({
  useReseller: (id: string) => useResellerMock(id),
  useUpdateReseller: () => useUpdateResellerMock(),
  useChangeResellerTier: () => useChangeResellerTierMock(),
  useSuspendReseller: () => useSuspendResellerMock(),
  useUnsuspendReseller: () => useUnsuspendResellerMock(),
  useDeleteReseller: () => useDeleteResellerMock(),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useParams: () => ({ id: 'reseller-id' }),
    useRouter: () => ({ push: pushMock, back: vi.fn(), replace: vi.fn() }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('nuqs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('nuqs')>();
  return {
    ...actual,
    useQueryState: () => ['overview', vi.fn()],
  };
});

import adminResellersMessages from '../../../../../../../../messages/en/adminResellers.json';
import { renderWithProviders } from '../../../../../../../__test-utils__/render-with-providers';
import type { ResellerNode } from '../../types';
import ResellerDetailPage from '../page';

const messages = { adminResellers: adminResellersMessages };

function makeReseller(overrides: Partial<ResellerNode> = {}): ResellerNode {
  return {
    id: 'reseller-id',
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

function mockReseller(reseller: ResellerNode | null, loading = false) {
  useResellerMock.mockReturnValue({
    data: reseller ? { adminGetReseller: reseller } : undefined,
    loading,
    refetch: vi.fn(),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ResellerDetailPage', () => {
  beforeEach(() => {
    useResellerMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the loading skeleton while the query is pending', () => {
    mockReseller(null, true);
    renderWithProviders(<ResellerDetailPage />, { messages });
    expect(screen.getByTestId('reseller-detail-loading')).toBeInTheDocument();
  });

  it('renders a not-found message when the reseller id does not resolve', () => {
    mockReseller(null, false);
    renderWithProviders(<ResellerDetailPage />, { messages });
    expect(screen.getByTestId('reseller-not-found')).toBeInTheDocument();
  });

  it('renders header with name, tier, status, and slug for ordinary reseller', () => {
    mockReseller(makeReseller());
    renderWithProviders(<ResellerDetailPage />, { messages });
    expect(screen.getByTestId('reseller-detail-title')).toHaveTextContent('Acme Partners');
    expect(screen.getByTestId('reseller-status-badge')).toHaveTextContent('Active');
    expect(screen.getByTestId('reseller-tier-badge')).toHaveTextContent('Full Management');
    expect(screen.queryByTestId('reseller-system-badge')).not.toBeInTheDocument();
  });

  it('shows the system badge + notice for the Roviq Direct reseller', () => {
    mockReseller(makeReseller({ isSystem: true, name: 'Roviq Direct' }));
    renderWithProviders(<ResellerDetailPage />, { messages });
    expect(screen.getByTestId('reseller-system-badge')).toBeInTheDocument();
    expect(screen.getByTestId('reseller-system-notice')).toBeInTheDocument();
  });

  describe('action gating', () => {
    it('ACTIVE non-system reseller: Edit + ChangeTier + Suspend visible; Unsuspend + Delete hidden', () => {
      mockReseller(makeReseller({ status: 'ACTIVE', isSystem: false }));
      renderWithProviders(<ResellerDetailPage />, { messages });

      expect(screen.getByTestId('action-edit-btn')).toBeInTheDocument();
      expect(screen.getByTestId('action-change-tier-btn')).toBeInTheDocument();
      expect(screen.getByTestId('action-suspend-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('action-unsuspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-delete-btn')).not.toBeInTheDocument();
    });

    it('SUSPENDED non-system reseller: Edit + ChangeTier + Unsuspend + Delete visible; Suspend hidden', () => {
      mockReseller(makeReseller({ status: 'SUSPENDED', isSystem: false }));
      renderWithProviders(<ResellerDetailPage />, { messages });

      expect(screen.getByTestId('action-edit-btn')).toBeInTheDocument();
      expect(screen.getByTestId('action-change-tier-btn')).toBeInTheDocument();
      expect(screen.getByTestId('action-unsuspend-btn')).toBeInTheDocument();
      expect(screen.getByTestId('action-delete-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('action-suspend-btn')).not.toBeInTheDocument();
    });

    it('DELETED reseller: only Edit visible; all other lifecycle actions hidden', () => {
      mockReseller(makeReseller({ status: 'DELETED', isSystem: false }));
      renderWithProviders(<ResellerDetailPage />, { messages });

      expect(screen.getByTestId('action-edit-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('action-suspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-unsuspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-delete-btn')).not.toBeInTheDocument();
    });

    it('ACTIVE system reseller: only Edit visible; ChangeTier + Suspend/Unsuspend/Delete all hidden', () => {
      mockReseller(makeReseller({ status: 'ACTIVE', isSystem: true, name: 'Roviq Direct' }));
      renderWithProviders(<ResellerDetailPage />, { messages });

      expect(screen.getByTestId('action-edit-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('action-change-tier-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-suspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-unsuspend-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('action-delete-btn')).not.toBeInTheDocument();
    });
  });

  it('renders all five tab triggers', () => {
    mockReseller(makeReseller());
    renderWithProviders(<ResellerDetailPage />, { messages });

    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-institutes')).toBeInTheDocument();
    expect(screen.getByTestId('tab-team')).toBeInTheDocument();
    expect(screen.getByTestId('tab-activity')).toBeInTheDocument();
    expect(screen.getByTestId('tab-billing')).toBeInTheDocument();
  });

  it('renders institute count and team size in the stats card', () => {
    mockReseller(makeReseller({ instituteCount: 42, teamSize: 11 }));
    renderWithProviders(<ResellerDetailPage />, { messages });
    expect(screen.getByTestId('detail-institute-count')).toHaveTextContent('42');
    expect(screen.getByTestId('detail-team-size')).toHaveTextContent('11');
  });
});
