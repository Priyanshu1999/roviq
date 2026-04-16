import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { BusinessException, ErrorCode, ResellerStatus, ResellerTier } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  impersonationSessions,
  institutes,
  refreshTokens,
  resellerMemberships,
  resellers,
  roles,
  withAdmin,
} from '@roviq/database';
import { REDIS_CLIENT } from '@roviq/redis';
import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { AuthEventService } from '../../auth/auth-event.service';
import { IdentityService } from '../../auth/identity.service';
import { REDIS_KEYS } from '../../auth/redis-keys';
import { EventBusService } from '../../common/event-bus.service';
import { decodeCursor, encodeCursor } from '../../common/pagination/relay-pagination.model';
import type { AdminCreateResellerInput } from './dto/admin-create-reseller.input';
import type { AdminListResellersFilterInput } from './dto/admin-list-resellers-filter.input';
import type { AdminUpdateResellerInput } from './dto/admin-update-reseller.input';

/** Default "Roviq Direct" system reseller UUID — hardcoded seed ID */
const DEFAULT_RESELLER_ID = '00000000-0000-4000-a000-000000000011';

/** Minimum days a reseller must be suspended before deletion */
const GRACE_PERIOD_DAYS = 30;

/**
 * Role name per tier — created by the platform seed (see scripts/seed.ts).
 * The initial admin attached during `adminCreateReseller` receives the role
 * matching the chosen tier; `changeTier` cascades updates to this role on
 * every existing reseller_membership.
 */
const TIER_TO_ROLE_NAME: Record<ResellerTier, string> = {
  FULL_MANAGEMENT: 'reseller_full_admin',
  SUPPORT_MANAGEMENT: 'reseller_support_admin',
  READ_ONLY: 'reseller_viewer',
};

function buildListConditions(filter: AdminListResellersFilterInput): SQL[] {
  const { search, status, tier, isSystem, after } = filter;
  const conditions: SQL[] = [];

  if (status && status.length > 0) conditions.push(inArray(resellers.status, status));
  if (tier && tier.length > 0) conditions.push(inArray(resellers.tier, tier));
  if (typeof isSystem === 'boolean') conditions.push(eq(resellers.isSystem, isSystem));
  if (search && search.trim().length > 0) {
    const pattern = `%${search.trim()}%`;
    const cond = or(ilike(resellers.name, pattern), ilike(resellers.slug, pattern));
    if (cond) conditions.push(cond);
  }
  if (after) {
    const cursor = decodeCursor(after);
    if (cursor.id) conditions.push(sql`${resellers.id} < ${cursor.id as string}`);
  }
  return conditions;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class AdminResellerService {
  private readonly logger = new Logger(AdminResellerService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
    private readonly authEventService: AuthEventService,
    private readonly eventBus: EventBusService,
    private readonly identityService: IdentityService,
  ) {}

  // ── Read queries ────────────────────────────────────────────

  /**
   * List resellers for the platform-admin management UI.
   * Cursor-paginated, newest-first (ORDER BY created_at DESC, id DESC).
   * Batch-loads `instituteCount` (non-deleted) and `teamSize` (total memberships)
   * for the returned page — single extra query instead of N+1.
   */
  async list(filter: AdminListResellersFilterInput) {
    const limit = Math.min(filter.first ?? 20, 100);
    const after = filter.after;

    const { records, totalCount } = await withAdmin(this.db, async (tx) => {
      const conditions = buildListConditions(filter);
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult, rows] = await Promise.all([
        tx.select({ value: count() }).from(resellers).where(where),
        tx
          .select()
          .from(resellers)
          .where(where)
          .orderBy(desc(resellers.createdAt), desc(resellers.id))
          .limit(limit + 1),
      ]);
      return { records: rows, totalCount: totalResult[0]?.value ?? 0 };
    });

    const hasNextPage = records.length > limit;
    const nodes = hasNextPage ? records.slice(0, limit) : records;

    const { instituteCount, teamSize } = await this.loadCounts(nodes.map((r) => r.id));

    const edges = nodes.map((record) => ({
      node: {
        ...record,
        branding: (record.branding ?? null) as Record<string, unknown> | null,
        instituteCount: instituteCount.get(record.id) ?? 0,
        teamSize: teamSize.get(record.id) ?? 0,
      },
      cursor: encodeCursor({ id: record.id }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount,
    };
  }

  /** Read a single reseller by id with computed counts. 404 if not found. */
  async getById(resellerId: string) {
    const record = await withAdmin(this.db, async (tx) => {
      const [row] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      return row;
    });
    if (!record) {
      throw new BusinessException(ErrorCode.RESELLER_NOT_FOUND, `Reseller ${resellerId} not found`);
    }
    const { instituteCount, teamSize } = await this.loadCounts([resellerId]);
    return {
      ...record,
      branding: (record.branding ?? null) as Record<string, unknown> | null,
      instituteCount: instituteCount.get(resellerId) ?? 0,
      teamSize: teamSize.get(resellerId) ?? 0,
    };
  }

  // ── Mutations ───────────────────────────────────────────────

  /**
   * Create a new reseller + initial admin user + matching reseller_membership.
   * Slug is auto-generated from `name` when absent. Returns the created reseller.
   */
  async create(input: AdminCreateResellerInput, actorId: string) {
    const slug = (input.slug ?? slugify(input.name)).trim();
    if (!slug) {
      throw new BusinessException(
        ErrorCode.INVALID_SLUG,
        'Unable to derive slug from name; provide a slug explicitly',
      );
    }

    const { reseller, roleId } = await withAdmin(this.db, async (tx) => {
      const [conflict] = await tx.select().from(resellers).where(eq(resellers.slug, slug));
      if (conflict) {
        throw new BusinessException(
          ErrorCode.SLUG_DUPLICATE,
          `Slug "${slug}" is already taken by another reseller`,
        );
      }

      const [role] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            sql`${roles.name}->>'en' = ${TIER_TO_ROLE_NAME[input.tier]}`,
            eq(roles.scope, 'reseller'),
          ),
        );
      if (!role) {
        throw new BusinessException(
          ErrorCode.INVALID_TIER,
          `No system role found for tier ${input.tier}. Re-run seed.`,
        );
      }

      const [created] = await tx
        .insert(resellers)
        .values({
          name: input.name,
          slug,
          tier: input.tier,
          status: ResellerStatus.ACTIVE,
          isActive: true,
          isSystem: false,
          branding: input.branding ?? {},
          customDomain: input.customDomain ?? null,
        })
        .returning();

      return { reseller: created, roleId: role.id };
    });

    // Provision the initial admin user + membership outside the admin tx —
    // IdentityService manages its own transactions across scopes and emits the
    // NOTIFICATION.user.created event so the welcome email/SMS fires via Novu.
    try {
      await this.identityService.createUserWithMembership({
        email: input.initialAdminEmail,
        username: input.initialAdminEmail,
        scope: 'reseller',
        resellerId: reseller.id,
        roleId,
        actorId,
      });
    } catch (err) {
      this.logger.warn(
        `Reseller ${reseller.id} created but initial admin provisioning failed: ${String(err)}`,
      );
      // Don't rollback the reseller — admin can re-invite. Event still emits below.
    }

    const resellerWithCounts = this.attachEmptyCounts(reseller);
    this.eventBus.emit('RESELLER.created', { ...resellerWithCounts, scope: 'platform' });

    return resellerWithCounts;
  }

  /** Update editable reseller fields (name, branding, customDomain). Tier + slug not editable here. */
  async update(resellerId: string, input: AdminUpdateResellerInput, actorId: string) {
    const record = await withAdmin(this.db, async (tx) => {
      const [existing] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      if (!existing) {
        throw new BusinessException(
          ErrorCode.RESELLER_NOT_FOUND,
          `Reseller ${resellerId} not found`,
        );
      }
      if (existing.isSystem) {
        throw new BusinessException(
          ErrorCode.SYSTEM_RESELLER_PROTECTED,
          'The system reseller "Roviq Direct" cannot be modified',
        );
      }
      if (existing.status === ResellerStatus.DELETED) {
        throw new BusinessException(ErrorCode.RESELLER_INVALID, 'Cannot update a deleted reseller');
      }

      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.branding !== undefined) patch.branding = input.branding;
      if (input.customDomain !== undefined) patch.customDomain = input.customDomain;
      patch.updatedAt = new Date();

      const [updated] = await tx
        .update(resellers)
        .set(patch)
        .where(eq(resellers.id, resellerId))
        .returning();
      return updated;
    });

    this.eventBus.emit('RESELLER.updated', { ...record, actorId, scope: 'platform' });
    return this.attachEmptyCounts(record);
  }

  /**
   * Change a reseller's tier. Cascades to every existing reseller_membership:
   * role_id is updated to the tier's system role so staff abilities change on
   * next token refresh.
   */
  async changeTier(resellerId: string, newTier: ResellerTier, actorId: string) {
    if (!Object.values(ResellerTier).includes(newTier)) {
      throw new BusinessException(ErrorCode.INVALID_TIER, `Unknown reseller tier: ${newTier}`);
    }

    const { record, oldTier } = await withAdmin(this.db, async (tx) => {
      const [existing] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      if (!existing) {
        throw new BusinessException(
          ErrorCode.RESELLER_NOT_FOUND,
          `Reseller ${resellerId} not found`,
        );
      }
      if (existing.isSystem) {
        throw new BusinessException(
          ErrorCode.SYSTEM_RESELLER_PROTECTED,
          'The system reseller "Roviq Direct" cannot have its tier changed',
        );
      }
      if (existing.status !== ResellerStatus.ACTIVE) {
        throw new BusinessException(
          ErrorCode.TIER_CHANGE_REQUIRES_ACTIVE,
          'Tier can only be changed while the reseller is active — unsuspend first',
        );
      }
      if (existing.tier === newTier) return { record: existing, oldTier: existing.tier };

      const [newRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            sql`${roles.name}->>'en' = ${TIER_TO_ROLE_NAME[newTier]}`,
            eq(roles.scope, 'reseller'),
          ),
        );
      if (!newRole) {
        throw new BusinessException(
          ErrorCode.INVALID_TIER,
          `No system role found for tier ${newTier}. Re-run seed.`,
        );
      }

      const [updated] = await tx
        .update(resellers)
        .set({ tier: newTier, updatedAt: new Date() })
        .where(eq(resellers.id, resellerId))
        .returning();

      await tx
        .update(resellerMemberships)
        .set({ roleId: newRole.id, updatedAt: new Date() })
        .where(eq(resellerMemberships.resellerId, resellerId));

      return { record: updated, oldTier: existing.tier };
    });

    // No-op: tier unchanged — no DB write, no event, return as-is.
    if (oldTier === newTier) return this.attachEmptyCounts(record);

    this.eventBus.emit('RESELLER.tier_changed', {
      ...record,
      oldTier,
      newTier,
      actorId,
      scope: 'platform',
    });

    return this.attachEmptyCounts(record);
  }

  // ── Existing lifecycle mutations (preserved from ROV-97) ────

  async suspendReseller(resellerId: string, reason?: string): Promise<void> {
    const { record, previousStatus } = await withAdmin(this.db, async (tx) => {
      // 1. Verify reseller exists and is not a system reseller
      const [reseller] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      if (!reseller)
        throw new BusinessException(ErrorCode.RESELLER_NOT_FOUND, 'Reseller not found');
      if (reseller.isSystem)
        throw new BusinessException(
          ErrorCode.SYSTEM_RESELLER_PROTECTED,
          'Cannot suspend system reseller',
        );
      if (reseller.status === ResellerStatus.SUSPENDED) {
        throw new BusinessException(
          ErrorCode.RESELLER_ALREADY_SUSPENDED,
          'Reseller is already suspended',
        );
      }
      if (reseller.status === ResellerStatus.DELETED) {
        throw new BusinessException(
          ErrorCode.RESELLER_INVALID,
          'Cannot suspend a deleted reseller',
        );
      }

      // 2. Update reseller status to suspended
      const [updated] = await tx
        .update(resellers)
        .set({
          status: ResellerStatus.SUSPENDED,
          suspendedAt: new Date(),
          isActive: false,
        })
        .where(eq(resellers.id, resellerId))
        .returning();

      // 3. Get all reseller staff user IDs
      const staffRows = await tx
        .select({ userId: resellerMemberships.userId })
        .from(resellerMemberships)
        .where(eq(resellerMemberships.resellerId, resellerId));
      const staffUserIds = staffRows.map((s) => s.userId);

      if (staffUserIds.length > 0) {
        // 4. Revoke all refresh tokens for reseller staff (scope = 'reseller')
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              inArray(refreshTokens.userId, staffUserIds),
              eq(refreshTokens.membershipScope, 'reseller'),
              isNull(refreshTokens.revokedAt),
            ),
          );

        // 5. Terminate active impersonation sessions by reseller staff
        const activeSessions = await tx
          .select({ id: impersonationSessions.id })
          .from(impersonationSessions)
          .where(
            and(
              inArray(impersonationSessions.impersonatorId, staffUserIds),
              isNull(impersonationSessions.endedAt),
            ),
          );

        if (activeSessions.length > 0) {
          const sessionIds = activeSessions.map((s) => s.id);

          await tx
            .update(impersonationSessions)
            .set({
              endedAt: new Date(),
              endedReason: 'revoked',
            })
            .where(inArray(impersonationSessions.id, sessionIds));

          // Invalidate Redis cache for impersonation sessions
          await this.redis.del(
            ...activeSessions.map((s) => `${REDIS_KEYS.IMPERSONATION_SESSION}${s.id}`),
          );
        }

        // 6. Emit auth events for each affected staff member
        for (const userId of staffUserIds) {
          this.authEventService
            .emit({
              userId,
              type: 'all_sessions_revoked',
              metadata: { reason: 'reseller_suspended', resellerId, suspensionReason: reason },
            })
            .catch(() => {});
        }
      }

      return { record: updated, previousStatus: reseller.status };
    });

    // 7a. Legacy lowercase event — kept for EE billing cleanup workflow (see ee/apps/api-gateway/src/billing/workflows/reseller-cleanup.workflow.ts)
    this.natsClient
      .emit('reseller.suspended', { resellerId, reason, suspendedAt: new Date().toISOString() })
      .subscribe({
        error: (err) => this.logger.warn('Failed to emit reseller.suspended', err),
      });

    // 7b. Canonical status-change event for subscription consumers
    this.eventBus.emit('RESELLER.status_changed', {
      ...record,
      previousStatus,
      newStatus: ResellerStatus.SUSPENDED,
      reason,
      scope: 'platform',
    });
  }

  async unsuspendReseller(resellerId: string): Promise<void> {
    const record = await withAdmin(this.db, async (tx) => {
      const [reseller] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      if (!reseller)
        throw new BusinessException(ErrorCode.RESELLER_NOT_FOUND, 'Reseller not found');
      if (reseller.isSystem) {
        throw new BusinessException(
          ErrorCode.SYSTEM_RESELLER_PROTECTED,
          'System reseller cannot be suspended or unsuspended',
        );
      }
      if (reseller.status === ResellerStatus.DELETED) {
        throw new BusinessException(
          ErrorCode.RESELLER_INVALID,
          'Cannot unsuspend a deleted reseller',
        );
      }
      if (reseller.status !== ResellerStatus.SUSPENDED) {
        throw new BusinessException(ErrorCode.RESELLER_NOT_SUSPENDED, 'Reseller is not suspended');
      }

      const [updated] = await tx
        .update(resellers)
        .set({
          status: ResellerStatus.ACTIVE,
          suspendedAt: null,
          isActive: true,
        })
        .where(eq(resellers.id, resellerId))
        .returning();
      return updated;
    });

    this.natsClient
      .emit('reseller.unsuspended', { resellerId, unsuspendedAt: new Date().toISOString() })
      .subscribe({
        error: (err) => this.logger.warn('Failed to emit reseller.unsuspended', err),
      });

    this.eventBus.emit('RESELLER.status_changed', {
      ...record,
      previousStatus: ResellerStatus.SUSPENDED,
      newStatus: ResellerStatus.ACTIVE,
      scope: 'platform',
    });
  }

  async deleteReseller(resellerId: string): Promise<void> {
    const { record, affectedInstituteIds } = await withAdmin(this.db, async (tx) => {
      // 1. Verify reseller exists and is eligible for deletion
      const [reseller] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      if (!reseller)
        throw new BusinessException(ErrorCode.RESELLER_NOT_FOUND, 'Reseller not found');
      if (reseller.isSystem)
        throw new BusinessException(
          ErrorCode.SYSTEM_RESELLER_PROTECTED,
          'Cannot delete system reseller',
        );
      if (reseller.status !== ResellerStatus.SUSPENDED) {
        throw new BusinessException(
          ErrorCode.RESELLER_NOT_SUSPENDED,
          'Reseller must be suspended before deletion',
        );
      }

      // 2. Enforce 30-day grace period
      if (!reseller.suspendedAt) {
        throw new BusinessException(ErrorCode.RESELLER_INVALID, 'Suspension date not set');
      }
      const daysSinceSuspension = Math.floor(
        (Date.now() - reseller.suspendedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceSuspension < GRACE_PERIOD_DAYS) {
        throw new BusinessException(
          ErrorCode.GRACE_PERIOD_NOT_ELAPSED,
          `Grace period not elapsed (${GRACE_PERIOD_DAYS} days required, ${daysSinceSuspension} elapsed)`,
        );
      }

      // 3. Capture affected institutes before reassignment
      const affectedInstitutes = await tx
        .select({ id: institutes.id })
        .from(institutes)
        .where(eq(institutes.resellerId, resellerId));

      // 4. Reassign institutes to "Roviq Direct" system reseller
      await tx
        .update(institutes)
        .set({ resellerId: DEFAULT_RESELLER_ID })
        .where(eq(institutes.resellerId, resellerId));

      // 5. Delete reseller memberships
      await tx.delete(resellerMemberships).where(eq(resellerMemberships.resellerId, resellerId));

      // 6. Soft-delete reseller
      const [updated] = await tx
        .update(resellers)
        .set({ status: ResellerStatus.DELETED, deletedAt: new Date() })
        .where(eq(resellers.id, resellerId))
        .returning();

      return { record: updated, affectedInstituteIds: affectedInstitutes.map((i) => i.id) };
    });

    // 7a. Legacy lowercase event — kept for EE billing cleanup workflow
    this.natsClient
      .emit('reseller.deleted', {
        resellerId,
        affectedInstituteIds,
      })
      .subscribe({
        error: (err) => this.logger.warn('Failed to emit reseller.deleted', err),
      });

    // 7b. Canonical status-change event
    this.eventBus.emit('RESELLER.status_changed', {
      ...record,
      previousStatus: ResellerStatus.SUSPENDED,
      newStatus: ResellerStatus.DELETED,
      affectedInstituteIds,
      scope: 'platform',
    });
  }

  // ── Internal helpers ────────────────────────────────────────

  /**
   * Load `instituteCount` + `teamSize` for a set of resellers in two grouped
   * queries. Uses its own `withAdmin` call — counts are read-only so running
   * outside the caller's transaction is fine and keeps helper typing simple.
   */
  private async loadCounts(
    resellerIds: string[],
  ): Promise<{ instituteCount: Map<string, number>; teamSize: Map<string, number> }> {
    const instituteCount = new Map<string, number>();
    const teamSize = new Map<string, number>();
    if (resellerIds.length === 0) return { instituteCount, teamSize };

    await withAdmin(this.db, async (tx) => {
      const [instRows, teamRows] = await Promise.all([
        tx
          .select({ resellerId: institutes.resellerId, count: count(institutes.id) })
          .from(institutes)
          .where(and(inArray(institutes.resellerId, resellerIds), isNull(institutes.deletedAt)))
          .groupBy(institutes.resellerId),
        tx
          .select({
            resellerId: resellerMemberships.resellerId,
            count: count(resellerMemberships.id),
          })
          .from(resellerMemberships)
          .where(
            and(
              inArray(resellerMemberships.resellerId, resellerIds),
              eq(resellerMemberships.isActive, true),
            ),
          )
          .groupBy(resellerMemberships.resellerId),
      ]);
      for (const row of instRows) instituteCount.set(row.resellerId, Number(row.count));
      for (const row of teamRows) teamSize.set(row.resellerId, Number(row.count));
    });
    return { instituteCount, teamSize };
  }

  /**
   * Returned shape for single-reseller mutations (create/update/changeTier).
   * Counts default to 0 — callers usually refetch via getById on next frontend
   * query, so avoiding a second roundtrip here keeps mutations snappy.
   */
  private attachEmptyCounts(record: typeof resellers.$inferSelect) {
    return {
      ...record,
      branding: (record.branding ?? null) as Record<string, unknown> | null,
      instituteCount: 0,
      teamSize: 0,
    };
  }
}
