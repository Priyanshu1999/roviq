/**
 * AdminResellerService unit tests.
 *
 * Covers:
 *   - ROV-97 lifecycle: suspend / unsuspend / delete (system protection,
 *     state-machine guards, 30-day grace period, NATS event emission,
 *     canonical RESELLER.status_changed event)
 *   - ROV-234 management: create slug duplicates, update system protection,
 *     changeTier guards
 *
 * The Drizzle transaction chain is mocked via a fluent test double whose
 * terminal calls resolve to the rows staged for each test. `.returning()`
 * on updates/inserts echoes back the staged reseller row merged with
 * incoming `.set()` values — good enough to cover the paths the service
 * walks without spinning up a real Postgres.
 */
import type { ClientProxy } from '@nestjs/microservices';
import { BusinessException, ErrorCode, ResellerStatus, ResellerTier } from '@roviq/common-types';
import { createMock } from '@roviq/testing';
import { getTableName } from 'drizzle-orm';
import type Redis from 'ioredis';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthEventService } from '../../../auth/auth-event.service';
import { IdentityService } from '../../../auth/identity.service';
import { EventBusService } from '../../../common/event-bus.service';
import { AdminResellerService } from '../admin-reseller.service';

// ── Drizzle transaction mock ──────────────────────────────────

interface StagedRow {
  id: string;
  name?: string;
  slug?: string;
  tier?: string;
  isSystem?: boolean;
  isActive?: boolean;
  status?: string;
  suspendedAt?: Date | null;
  deletedAt?: Date | null;
  branding?: Record<string, unknown> | null;
  customDomain?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TxStages {
  resellerRows?: StagedRow[];
  staffRows?: { userId: string }[];
  sessionRows?: { id: string }[];
  instituteRows?: { id: string }[];
  /** Rows to return in sequence from additional selects (slug conflict, role lookup) */
  extraSelectRows?: unknown[][];
  /** Row returned by insert().returning() — used by create() */
  insertedReseller?: StagedRow;
}

function createTxMock(stages: TxStages) {
  const calls = {
    updateReseller: vi.fn(),
    updateRefreshTokens: vi.fn(),
    updateInstitutes: vi.fn(),
    updateMemberships: vi.fn(),
    deleteMemberships: vi.fn(),
    updateImpersonation: vi.fn(),
    insertReseller: vi.fn(),
  };

  // Selects are routed by the `from(table)` argument — more robust than
  // positional ordering because suspend / delete / create flows each select
  // different tables in different orders.
  const primaryReseller = stages.resellerRows?.[0];
  const extraSelects = [...(stages.extraSelectRows ?? [])];

  const resolveSelectRows = (table: unknown): unknown[] => {
    let tableName: string =
      typeof table === 'object' && table !== null ? String(getTableName(table as never)) : '';
    // After the live-views migration, services may read from `<table>_live`
    // views instead of base tables. Strip the suffix so fixtures stay keyed
    // by base name (`institutes`, `resellers`, `roles`, etc.).
    if (tableName.endsWith('_live')) tableName = tableName.slice(0, -5);
    switch (tableName) {
      case 'resellers':
        return stages.resellerRows ?? [];
      case 'reseller_memberships':
        return stages.staffRows ?? [];
      case 'impersonation_sessions':
        return stages.sessionRows ?? [];
      case 'institutes':
        return stages.instituteRows ?? [];
      case 'roles':
        // Role lookups are test-specific; shift from extraSelectRows queue.
        return extraSelects.shift() ?? [];
      default:
        return extraSelects.shift() ?? [];
    }
  };

  const makeSelectChain = () => ({
    from: (table: unknown) => ({
      where: () => Promise.resolve(resolveSelectRows(table)),
    }),
  });

  const makeUpdateChain = (tableName: string) => ({
    set: (values: Record<string, unknown>) => {
      const whereFn = (cond: unknown) => {
        if (tableName === 'resellers') calls.updateReseller({ values, cond });
        else if (tableName === 'refresh_tokens') calls.updateRefreshTokens({ values, cond });
        else if (tableName === 'institutes') calls.updateInstitutes({ values, cond });
        else if (tableName === 'impersonation_sessions')
          calls.updateImpersonation({ values, cond });
        else if (tableName === 'reseller_memberships') calls.updateMemberships({ values, cond });
      };
      return {
        where: (cond: unknown) => {
          whereFn(cond);
          return Object.assign(Promise.resolve(), {
            returning: () =>
              Promise.resolve(primaryReseller ? [{ ...primaryReseller, ...values }] : []),
          });
        },
      };
    },
  });

  const tx = {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn((_table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        returning: () => {
          calls.insertReseller({ values });
          return Promise.resolve([stages.insertedReseller ?? { ...values, id: 'new-reseller-id' }]);
        },
      }),
    })),
    update: vi.fn((table: unknown) => {
      const tableName: string =
        typeof table === 'object' && table !== null ? String(getTableName(table as never)) : '';
      return makeUpdateChain(tableName);
    }),
    delete: vi.fn((table: unknown) => {
      const tableName: string =
        typeof table === 'object' && table !== null ? String(getTableName(table as never)) : '';
      return {
        where: (cond: unknown) => {
          if (tableName === 'reseller_memberships') calls.deleteMemberships({ cond });
          return Promise.resolve();
        },
      };
    }),
  };

  return { tx, calls };
}

vi.mock('@roviq/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roviq/database')>();
  return {
    ...actual,
    withAdmin: vi.fn(async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const txHolder = (globalThis as { __rovResellerTx?: unknown }).__rovResellerTx;
      return fn(txHolder);
    }),
  };
});

const SYSTEM_RESELLER_ID = '00000000-0000-4000-a000-000000000011';
const NORMAL_RESELLER_ID = '11111111-1111-4111-a111-111111111111';
const ACTOR_ID = '22222222-2222-4222-a222-222222222222';

function setTx(tx: unknown) {
  (globalThis as { __rovResellerTx?: unknown }).__rovResellerTx = tx;
}

describe('AdminResellerService', () => {
  let service: AdminResellerService;
  let authEventService: AuthEventService;
  let natsClient: ClientProxy;
  let redis: Redis;
  let eventBus: EventBusService;
  let identityService: IdentityService;

  beforeEach(() => {
    authEventService = createMock<AuthEventService>({
      emit: vi.fn().mockResolvedValue(undefined),
    });
    natsClient = createMock<ClientProxy>({
      emit: vi.fn().mockReturnValue(of(undefined)),
    });
    redis = createMock<Redis>({
      del: vi.fn().mockResolvedValue(1),
    });
    eventBus = createMock<EventBusService>({
      emit: vi.fn(),
    });
    identityService = createMock<IdentityService>({
      createUserWithMembership: vi.fn().mockResolvedValue({
        userId: 'new-user-id',
        tempPassword: 'temp-pass',
        membershipId: 'new-membership-id',
        scope: 'reseller',
      }),
    });

    service = new AdminResellerService(
      createMock(),
      redis,
      natsClient,
      authEventService,
      eventBus,
      identityService,
    );
  });

  // ── suspendReseller ─────────────────────────────────────────

  describe('suspendReseller', () => {
    it('throws RESELLER_NOT_FOUND when reseller does not exist', async () => {
      const { tx } = createTxMock({ resellerRows: [] });
      setTx(tx);

      await expect(service.suspendReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_NOT_FOUND,
      });
    });

    it('throws SYSTEM_RESELLER_PROTECTED when reseller.isSystem=true', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [{ id: SYSTEM_RESELLER_ID, isSystem: true, status: ResellerStatus.ACTIVE }],
      });
      setTx(tx);

      await expect(service.suspendReseller(SYSTEM_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.SYSTEM_RESELLER_PROTECTED,
      });
      expect(calls.updateReseller).not.toHaveBeenCalled();
      expect(natsClient.emit).not.toHaveBeenCalled();
    });

    it('throws RESELLER_ALREADY_SUSPENDED when reseller is already suspended', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [
          { id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.SUSPENDED },
        ],
      });
      setTx(tx);

      await expect(service.suspendReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_ALREADY_SUSPENDED,
      });
      expect(calls.updateReseller).not.toHaveBeenCalled();
    });

    it('throws RESELLER_INVALID when reseller is deleted', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.DELETED }],
      });
      setTx(tx);

      await expect(service.suspendReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_INVALID,
      });
    });

    it('suspends reseller, revokes tokens, terminates impersonation, emits events', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [{ id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.ACTIVE }],
        staffRows: [{ userId: 'staff-1' }, { userId: 'staff-2' }],
        sessionRows: [{ id: 'session-1' }],
      });
      setTx(tx);

      await service.suspendReseller(NORMAL_RESELLER_ID, 'policy violation');

      expect(calls.updateReseller).toHaveBeenCalledTimes(1);
      const resellerUpdate = calls.updateReseller.mock.calls[0][0];
      expect(resellerUpdate.values.status).toBe(ResellerStatus.SUSPENDED);
      expect(resellerUpdate.values.suspendedAt).toBeInstanceOf(Date);
      expect(resellerUpdate.values.isActive).toBe(false);

      expect(calls.updateRefreshTokens).toHaveBeenCalledTimes(1);
      expect(calls.updateImpersonation).toHaveBeenCalledTimes(1);
      expect(calls.updateImpersonation.mock.calls[0][0].values.endedReason).toBe('revoked');

      expect(authEventService.emit).toHaveBeenCalledTimes(2);
      expect(authEventService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'all_sessions_revoked',
          metadata: expect.objectContaining({ reason: 'reseller_suspended' }),
        }),
      );

      // Legacy lowercase event for EE billing cleanup consumer
      expect(natsClient.emit).toHaveBeenCalledWith(
        'reseller.suspended',
        expect.objectContaining({ resellerId: NORMAL_RESELLER_ID, reason: 'policy violation' }),
      );

      // Canonical upper-snake event for subscription consumers
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RESELLER.status_changed',
        expect.objectContaining({
          previousStatus: ResellerStatus.ACTIVE,
          newStatus: ResellerStatus.SUSPENDED,
          reason: 'policy violation',
        }),
      );

      expect(redis.del).toHaveBeenCalled();
    });

    it('suspends reseller with no staff (no token revocation, still emits status_changed)', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [{ id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.ACTIVE }],
        staffRows: [],
      });
      setTx(tx);

      await service.suspendReseller(NORMAL_RESELLER_ID);

      expect(calls.updateReseller).toHaveBeenCalledTimes(1);
      expect(calls.updateRefreshTokens).not.toHaveBeenCalled();
      expect(calls.updateImpersonation).not.toHaveBeenCalled();
      expect(authEventService.emit).not.toHaveBeenCalled();
      expect(natsClient.emit).toHaveBeenCalledWith(
        'reseller.suspended',
        expect.objectContaining({ resellerId: NORMAL_RESELLER_ID }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RESELLER.status_changed',
        expect.objectContaining({ newStatus: ResellerStatus.SUSPENDED }),
      );
    });
  });

  // ── unsuspendReseller ───────────────────────────────────────

  describe('unsuspendReseller', () => {
    it('throws RESELLER_NOT_FOUND when reseller does not exist', async () => {
      const { tx } = createTxMock({ resellerRows: [] });
      setTx(tx);

      await expect(service.unsuspendReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_NOT_FOUND,
      });
    });

    it('throws SYSTEM_RESELLER_PROTECTED for system reseller', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: SYSTEM_RESELLER_ID, isSystem: true, status: ResellerStatus.ACTIVE }],
      });
      setTx(tx);

      await expect(service.unsuspendReseller(SYSTEM_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.SYSTEM_RESELLER_PROTECTED,
      });
    });

    it('throws RESELLER_INVALID when reseller is deleted', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.DELETED }],
      });
      setTx(tx);

      await expect(service.unsuspendReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_INVALID,
      });
    });

    it('throws RESELLER_NOT_SUSPENDED when reseller is not suspended', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.ACTIVE }],
      });
      setTx(tx);

      await expect(service.unsuspendReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_NOT_SUSPENDED,
      });
    });

    it('reactivates a suspended reseller, clears suspendedAt, emits both events', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [
          { id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.SUSPENDED },
        ],
      });
      setTx(tx);

      await service.unsuspendReseller(NORMAL_RESELLER_ID);

      expect(calls.updateReseller).toHaveBeenCalledTimes(1);
      const update = calls.updateReseller.mock.calls[0][0].values;
      expect(update.status).toBe(ResellerStatus.ACTIVE);
      expect(update.suspendedAt).toBeNull();
      expect(update.isActive).toBe(true);

      expect(natsClient.emit).toHaveBeenCalledWith(
        'reseller.unsuspended',
        expect.objectContaining({ resellerId: NORMAL_RESELLER_ID }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RESELLER.status_changed',
        expect.objectContaining({
          previousStatus: ResellerStatus.SUSPENDED,
          newStatus: ResellerStatus.ACTIVE,
        }),
      );
    });
  });

  // ── deleteReseller ──────────────────────────────────────────

  describe('deleteReseller', () => {
    it('throws RESELLER_NOT_FOUND when reseller does not exist', async () => {
      const { tx } = createTxMock({ resellerRows: [] });
      setTx(tx);

      await expect(service.deleteReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_NOT_FOUND,
      });
    });

    it('throws SYSTEM_RESELLER_PROTECTED for system reseller', async () => {
      const { tx } = createTxMock({
        resellerRows: [
          { id: SYSTEM_RESELLER_ID, isSystem: true, status: ResellerStatus.SUSPENDED },
        ],
      });
      setTx(tx);

      await expect(service.deleteReseller(SYSTEM_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.SYSTEM_RESELLER_PROTECTED,
      });
    });

    it('throws RESELLER_NOT_SUSPENDED when reseller is not suspended', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.ACTIVE }],
      });
      setTx(tx);

      await expect(service.deleteReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.RESELLER_NOT_SUSPENDED,
      });
    });

    it('throws GRACE_PERIOD_NOT_ELAPSED when grace period (30 days) has not elapsed', async () => {
      const suspendedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const { tx } = createTxMock({
        resellerRows: [
          {
            id: NORMAL_RESELLER_ID,
            isSystem: false,
            status: ResellerStatus.SUSPENDED,
            suspendedAt,
          },
        ],
      });
      setTx(tx);

      await expect(service.deleteReseller(NORMAL_RESELLER_ID)).rejects.toMatchObject({
        code: ErrorCode.GRACE_PERIOD_NOT_ELAPSED,
      });
    });

    it('reassigns institutes, deletes memberships, soft-deletes reseller after grace period', async () => {
      const suspendedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      const { tx, calls } = createTxMock({
        resellerRows: [
          {
            id: NORMAL_RESELLER_ID,
            isSystem: false,
            status: ResellerStatus.SUSPENDED,
            suspendedAt,
          },
        ],
        instituteRows: [{ id: 'inst-1' }, { id: 'inst-2' }],
      });
      setTx(tx);

      await service.deleteReseller(NORMAL_RESELLER_ID);

      expect(calls.updateInstitutes).toHaveBeenCalledTimes(1);
      expect(calls.updateInstitutes.mock.calls[0][0].values.resellerId).toBe(SYSTEM_RESELLER_ID);

      expect(calls.deleteMemberships).toHaveBeenCalledTimes(1);

      expect(calls.updateReseller).toHaveBeenCalledTimes(1);
      const update = calls.updateReseller.mock.calls[0][0].values;
      expect(update.status).toBe(ResellerStatus.DELETED);
      expect(update.deletedAt).toBeInstanceOf(Date);

      expect(natsClient.emit).toHaveBeenCalledWith(
        'reseller.deleted',
        expect.objectContaining({
          resellerId: NORMAL_RESELLER_ID,
          affectedInstituteIds: ['inst-1', 'inst-2'],
        }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RESELLER.status_changed',
        expect.objectContaining({
          newStatus: ResellerStatus.DELETED,
          affectedInstituteIds: ['inst-1', 'inst-2'],
        }),
      );
    });
  });

  // ── ROV-234: create / update / changeTier ───────────────────

  describe('create', () => {
    it('creates reseller with auto-derived slug, provisions identity, emits RESELLER.created with counts', async () => {
      const insertedReseller = {
        id: 'new-reseller-id',
        name: 'Acme Partners',
        slug: 'acme-partners',
        tier: ResellerTier.FULL_MANAGEMENT,
        status: ResellerStatus.ACTIVE,
        isSystem: false,
        isActive: true,
        branding: {},
        customDomain: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const { tx, calls } = createTxMock({
        resellerRows: [], // no slug conflict
        extraSelectRows: [[{ id: 'role-full-admin-id' }]], // role lookup succeeds
        insertedReseller,
      });
      setTx(tx);

      const result = await service.create(
        {
          name: 'Acme Partners',
          tier: ResellerTier.FULL_MANAGEMENT,
          initialAdminEmail: 'admin@acme.test',
        },
        ACTOR_ID,
      );

      // Slug auto-derived from name
      expect(calls.insertReseller).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ slug: 'acme-partners', status: ResellerStatus.ACTIVE }),
        }),
      );

      // IdentityService provisioned with correct args
      expect(identityService.createUserWithMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@acme.test',
          username: 'admin@acme.test',
          scope: 'reseller',
          resellerId: 'new-reseller-id',
          roleId: 'role-full-admin-id',
          actorId: ACTOR_ID,
        }),
      );

      // Event includes counts (0 for new reseller)
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RESELLER.created',
        expect.objectContaining({
          id: 'new-reseller-id',
          instituteCount: 0,
          teamSize: 0,
          scope: 'platform',
        }),
      );

      // Return value includes counts
      expect(result.instituteCount).toBe(0);
      expect(result.teamSize).toBe(0);
    });

    it('throws SLUG_DUPLICATE when slug is already taken', async () => {
      // 1st select = slug conflict lookup (finds an existing row)
      const { tx } = createTxMock({
        resellerRows: [{ id: 'some-other', slug: 'acme-partners' }],
      });
      setTx(tx);

      const promise = service.create(
        {
          name: 'Acme Partners',
          slug: 'acme-partners',
          tier: ResellerTier.FULL_MANAGEMENT,
          initialAdminEmail: 'admin@acme.test',
        },
        ACTOR_ID,
      );
      await expect(promise).rejects.toBeInstanceOf(BusinessException);
      await expect(promise).rejects.toMatchObject({ code: ErrorCode.SLUG_DUPLICATE });
    });

    it('throws INVALID_TIER when the tier role is missing from the seed', async () => {
      const { tx } = createTxMock({
        resellerRows: [], // no slug conflict
        extraSelectRows: [[]], // role lookup returns empty
      });
      setTx(tx);

      const promise = service.create(
        {
          name: 'Acme Partners',
          tier: ResellerTier.FULL_MANAGEMENT,
          initialAdminEmail: 'admin@acme.test',
        },
        ACTOR_ID,
      );
      await expect(promise).rejects.toMatchObject({ code: ErrorCode.INVALID_TIER });
    });
  });

  describe('update', () => {
    it('throws SYSTEM_RESELLER_PROTECTED when updating Roviq Direct', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: SYSTEM_RESELLER_ID, isSystem: true, status: ResellerStatus.ACTIVE }],
      });
      setTx(tx);

      const promise = service.update(SYSTEM_RESELLER_ID, { name: 'Renamed' }, ACTOR_ID);
      await expect(promise).rejects.toMatchObject({ code: ErrorCode.SYSTEM_RESELLER_PROTECTED });
    });

    it('throws RESELLER_INVALID when the reseller is soft-deleted', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.DELETED }],
      });
      setTx(tx);

      await expect(
        service.update(NORMAL_RESELLER_ID, { name: 'Renamed' }, ACTOR_ID),
      ).rejects.toMatchObject({ code: ErrorCode.RESELLER_INVALID });
    });

    it('applies patch and emits RESELLER.updated', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [
          {
            id: NORMAL_RESELLER_ID,
            isSystem: false,
            status: ResellerStatus.ACTIVE,
            name: 'Old Name',
          },
        ],
      });
      setTx(tx);

      await service.update(NORMAL_RESELLER_ID, { name: 'New Name' }, ACTOR_ID);

      expect(calls.updateReseller).toHaveBeenCalledTimes(1);
      expect(calls.updateReseller.mock.calls[0][0].values.name).toBe('New Name');
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RESELLER.updated',
        expect.objectContaining({ name: 'New Name', actorId: ACTOR_ID }),
      );
    });
  });

  describe('changeTier', () => {
    it('throws SYSTEM_RESELLER_PROTECTED on Roviq Direct', async () => {
      const { tx } = createTxMock({
        resellerRows: [{ id: SYSTEM_RESELLER_ID, isSystem: true, status: ResellerStatus.ACTIVE }],
      });
      setTx(tx);

      await expect(
        service.changeTier(SYSTEM_RESELLER_ID, ResellerTier.READ_ONLY, ACTOR_ID),
      ).rejects.toMatchObject({ code: ErrorCode.SYSTEM_RESELLER_PROTECTED });
    });

    it('throws TIER_CHANGE_REQUIRES_ACTIVE when reseller is suspended', async () => {
      const { tx } = createTxMock({
        resellerRows: [
          { id: NORMAL_RESELLER_ID, isSystem: false, status: ResellerStatus.SUSPENDED },
        ],
      });
      setTx(tx);

      await expect(
        service.changeTier(NORMAL_RESELLER_ID, ResellerTier.READ_ONLY, ACTOR_ID),
      ).rejects.toMatchObject({ code: ErrorCode.TIER_CHANGE_REQUIRES_ACTIVE });
    });

    it('is a no-op when the new tier equals the existing tier (no DB write, no event)', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [
          {
            id: NORMAL_RESELLER_ID,
            isSystem: false,
            status: ResellerStatus.ACTIVE,
            tier: ResellerTier.FULL_MANAGEMENT,
          },
        ],
        // No extraSelectRows — role lookup must NOT be reached
      });
      setTx(tx);

      const result = await service.changeTier(
        NORMAL_RESELLER_ID,
        ResellerTier.FULL_MANAGEMENT,
        ACTOR_ID,
      );

      expect(calls.updateReseller).not.toHaveBeenCalled();
      expect(calls.updateMemberships).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
      expect(result.id).toBe(NORMAL_RESELLER_ID);
    });

    it('cascades role update to memberships and emits RESELLER.tier_changed', async () => {
      const { tx, calls } = createTxMock({
        resellerRows: [
          {
            id: NORMAL_RESELLER_ID,
            isSystem: false,
            status: ResellerStatus.ACTIVE,
            tier: ResellerTier.FULL_MANAGEMENT,
          },
        ],
        // Role lookup for new tier
        extraSelectRows: [[{ id: 'role-new-tier-id' }]],
      });
      setTx(tx);

      await service.changeTier(NORMAL_RESELLER_ID, ResellerTier.READ_ONLY, ACTOR_ID);

      expect(calls.updateReseller).toHaveBeenCalled();
      expect(calls.updateReseller.mock.calls[0][0].values.tier).toBe(ResellerTier.READ_ONLY);
      expect(calls.updateMemberships).toHaveBeenCalledTimes(1);
      expect(calls.updateMemberships.mock.calls[0][0].values.roleId).toBe('role-new-tier-id');
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RESELLER.tier_changed',
        expect.objectContaining({
          oldTier: ResellerTier.FULL_MANAGEMENT,
          newTier: ResellerTier.READ_ONLY,
          actorId: ACTOR_ID,
        }),
      );
    });
  });
});
