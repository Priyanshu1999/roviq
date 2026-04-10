import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { ResellerStatus } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  impersonationSessions,
  institutes,
  refreshTokens,
  resellerMemberships,
  resellers,
  withAdmin,
} from '@roviq/database';
import { REDIS_CLIENT } from '@roviq/redis';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type Redis from 'ioredis';
import { AuthEventService } from '../../auth/auth-event.service';
import { REDIS_KEYS } from '../../auth/redis-keys';

/** Default "Roviq Direct" system reseller UUID */
const DEFAULT_RESELLER_ID = '00000000-0000-0000-0000-000000000001';

/** Minimum days a reseller must be suspended before deletion */
const GRACE_PERIOD_DAYS = 30;

@Injectable()
export class AdminResellerService {
  private readonly logger = new Logger(AdminResellerService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
    private readonly authEventService: AuthEventService,
  ) {}

  async suspendReseller(resellerId: string): Promise<void> {
    await withAdmin(this.db, async (tx) => {
      // 1. Verify reseller exists and is not a system reseller
      const [reseller] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      if (!reseller) throw new NotFoundException('Reseller not found');
      if (reseller.isSystem) throw new ForbiddenException('Cannot suspend system reseller');

      // 2. Update reseller status to suspended
      await tx
        .update(resellers)
        .set({
          status: ResellerStatus.SUSPENDED,
          suspendedAt: new Date(),
          isActive: false,
        })
        .where(eq(resellers.id, resellerId));

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
              metadata: { reason: 'reseller_suspended', resellerId },
            })
            .catch(() => {});
        }
      }
    });
  }

  async deleteReseller(resellerId: string): Promise<void> {
    const affectedInstituteIds = await withAdmin(this.db, async (tx) => {
      // 1. Verify reseller exists and is eligible for deletion
      const [reseller] = await tx.select().from(resellers).where(eq(resellers.id, resellerId));
      if (!reseller) throw new NotFoundException('Reseller not found');
      if (reseller.isSystem) throw new ForbiddenException('Cannot delete system reseller');
      if (reseller.status !== ResellerStatus.SUSPENDED) {
        throw new BadRequestException('Reseller must be suspended before deletion');
      }

      // 2. Enforce 30-day grace period
      if (!reseller.suspendedAt) {
        throw new BadRequestException('Suspension date not set');
      }
      const daysSinceSuspension = Math.floor(
        (Date.now() - reseller.suspendedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceSuspension < GRACE_PERIOD_DAYS) {
        throw new BadRequestException(
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
      await tx
        .update(resellers)
        .set({ status: ResellerStatus.DELETED, deletedAt: new Date() })
        .where(eq(resellers.id, resellerId));

      return affectedInstitutes.map((i) => i.id);
    });

    // 7. Notify institute admins via NATS (fire-and-forget, after transaction commits)
    this.natsClient
      .emit('reseller.deleted', {
        resellerId,
        affectedInstituteIds,
      })
      .subscribe({
        error: (err) => this.logger.warn('Failed to emit reseller.deleted', err),
      });
  }
}
