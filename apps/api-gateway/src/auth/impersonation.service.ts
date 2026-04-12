import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AbilityFactory } from '@roviq/casl';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  impersonationSessions,
  institutes,
  memberships,
  resellerMemberships,
  roles,
  users,
  withAdmin,
} from '@roviq/database';
import { REDIS_CLIENT } from '@roviq/redis';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type Redis from 'ioredis';
import { AuthEventService } from './auth-event.service';
import type { ImpersonationAuthPayload } from './dto/impersonation.dto';
import { REDIS_KEYS } from './redis-keys';

// ── Constants ──────────────────────────────────────────────

/** One-time code TTL in seconds */
const CODE_TTL_SECONDS = 30;

/** Impersonation access token TTL in seconds (15 minutes) */
const IMPERSONATION_ACCESS_TTL_SECONDS = 900;

/** Maximum session duration in milliseconds (1 hour) */
const MAX_SESSION_DURATION_MS = 60 * 60 * 1000;

/** Minimum reason length (enforced by DB CHECK, validated here for better errors) */
const MIN_REASON_LENGTH = 10;

// ── Types ──────────────────────────────────────────────────

interface ImpersonationMeta {
  ip?: string;
  userAgent?: string;
}

interface CodePayload {
  sessionId: string;
  targetUserId: string;
  tenantId: string;
}

interface StartImpersonationResult {
  code: string;
  requiresOtp?: boolean;
}

// ── Allowed scope transitions ──────────────────────────────
// platform → institute (platform admin impersonating institute user)
// reseller → institute (reseller impersonating managed institute user)
// institute → institute (intra-institute: admin impersonating a member)

const ALLOWED_IMPERSONATOR_SCOPES = new Set(['platform', 'reseller', 'institute']);

@Injectable()
export class ImpersonationService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly authEventService: AuthEventService,
    private readonly abilityFactory: AbilityFactory,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── Start impersonation ──────────────────────────────────

  async startImpersonation(
    impersonatorUserId: string,
    impersonatorScope: string,
    targetUserId: string,
    targetTenantId: string,
    reason: string,
    meta?: ImpersonationMeta,
  ): Promise<StartImpersonationResult> {
    // Validate reason length
    if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
      throw new BadRequestException(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
    }

    // Validate impersonator scope
    if (!ALLOWED_IMPERSONATOR_SCOPES.has(impersonatorScope)) {
      throw new ForbiddenException('Invalid impersonator scope');
    }

    // Cannot impersonate yourself
    if (impersonatorUserId === targetUserId) {
      throw new BadRequestException('Cannot impersonate yourself');
    }

    // Verify target user exists and is active
    const targetUser = await withAdmin(this.db, (tx) =>
      tx
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1),
    );

    if (targetUser.length === 0 || targetUser[0].status !== 'ACTIVE') {
      throw new BadRequestException('Target user not found or inactive');
    }

    // Verify target user has an active membership in the target tenant
    const targetMembership = await withAdmin(this.db, (tx) =>
      tx
        .select({
          id: memberships.id,
          tenantId: memberships.tenantId,
          roleId: memberships.roleId,
        })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, targetUserId),
            eq(memberships.tenantId, targetTenantId),
            eq(memberships.status, 'ACTIVE'),
            isNull(memberships.deletedAt),
          ),
        )
        .limit(1),
    );

    if (targetMembership.length === 0) {
      throw new BadRequestException(
        'Target user has no active membership in the specified institute',
      );
    }

    // Verify target tenant (institute) exists
    const targetInstitute = await withAdmin(this.db, (tx) =>
      tx
        .select({ id: institutes.id })
        .from(institutes)
        .where(eq(institutes.id, targetTenantId))
        .limit(1),
    );

    if (targetInstitute.length === 0) {
      throw new BadRequestException('Target institute not found');
    }

    // For reseller scope: verify the reseller owns the target institute
    if (impersonatorScope === 'reseller') {
      // Get the impersonator's reseller ID from their reseller membership
      const [resellerMembership] = await withAdmin(this.db, (tx) =>
        tx
          .select({ resellerId: resellerMemberships.resellerId })
          .from(resellerMemberships)
          .where(
            and(
              eq(resellerMemberships.userId, impersonatorUserId),
              eq(resellerMemberships.isActive, true),
            ),
          )
          .limit(1),
      );

      if (!resellerMembership) {
        throw new ForbiddenException('No active reseller membership');
      }

      // Check the institute belongs to this reseller
      const [inst] = await withAdmin(this.db, (tx) =>
        tx
          .select({ resellerId: institutes.resellerId })
          .from(institutes)
          .where(eq(institutes.id, targetTenantId))
          .limit(1),
      );

      if (!inst || inst.resellerId !== resellerMembership.resellerId) {
        throw new ForbiddenException('Institute does not belong to your reseller');
      }
    }

    // For institute scope: check CASL 'impersonate' ability + role hierarchy
    if (impersonatorScope === 'institute') {
      await this.validateIntraInstituteImpersonation(
        impersonatorUserId,
        targetTenantId,
        targetMembership[0].roleId,
      );
    }

    // Create impersonation session
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_SESSION_DURATION_MS);

    const [session] = await withAdmin(this.db, (tx) =>
      tx
        .insert(impersonationSessions)
        .values({
          impersonatorId: impersonatorUserId,
          impersonatorScope,
          targetUserId,
          targetTenantId,
          reason: reason.trim(),
          ipAddress: meta?.ip ?? null,
          userAgent: meta?.userAgent ?? null,
          startedAt: now,
          expiresAt,
        })
        .returning({ id: impersonationSessions.id }),
    );

    // Generate one-time code and store in Redis
    const code = randomUUID();
    const codePayload: CodePayload = {
      sessionId: session.id,
      targetUserId,
      tenantId: targetTenantId,
    };

    await this.redis.set(
      `${REDIS_KEYS.IMPERSONATION_CODE}${code}`,
      JSON.stringify(codePayload),
      'EX',
      CODE_TTL_SECONDS,
    );

    return { code };
  }

  // ── Exchange one-time code ───────────────────────────────

  async exchangeCode(code: string): Promise<ImpersonationAuthPayload> {
    // Atomic read-and-delete (GETDEL, Redis 6.2+) — prevents TOCTOU race on concurrent exchanges
    const stored = await this.redis.getdel(`${REDIS_KEYS.IMPERSONATION_CODE}${code}`);
    if (!stored) {
      throw new UnauthorizedException('Impersonation code expired or already used');
    }

    const { sessionId, targetUserId, tenantId } = JSON.parse(stored) as CodePayload;

    // Fetch all required data in parallel within a single transaction
    const [targetUsers, membershipRows, sessions, instituteRows] = await withAdmin(this.db, (tx) =>
      Promise.all([
        tx
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(and(eq(users.id, targetUserId), eq(users.status, 'ACTIVE')))
          .limit(1),
        tx
          .select({
            id: memberships.id,
            tenantId: memberships.tenantId,
            roleId: memberships.roleId,
          })
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, targetUserId),
              eq(memberships.tenantId, tenantId),
              eq(memberships.status, 'ACTIVE'),
              isNull(memberships.deletedAt),
            ),
          )
          .limit(1),
        tx
          .select({
            id: impersonationSessions.id,
            impersonatorId: impersonationSessions.impersonatorId,
          })
          .from(impersonationSessions)
          .where(eq(impersonationSessions.id, sessionId))
          .limit(1),
        tx
          .select({
            id: institutes.id,
            name: institutes.name,
          })
          .from(institutes)
          .where(eq(institutes.id, tenantId))
          .limit(1),
      ]),
    );

    const targetUser = targetUsers[0];
    if (!targetUser) throw new UnauthorizedException('Target user no longer active');

    const membership = membershipRows[0];
    if (!membership)
      throw new UnauthorizedException('Target user no longer has an active membership');

    const session = sessions[0];
    if (!session) throw new UnauthorizedException('Impersonation session not found');

    const institute = instituteRows[0];
    if (!institute) throw new UnauthorizedException('Institute not found');

    // Generate impersonation access token (non-renewable, no refresh token)
    const accessToken = this.generateImpersonationToken({
      targetUserId,
      tenantId,
      membershipId: membership.id,
      roleId: membership.roleId,
      impersonatorId: session.impersonatorId,
      sessionId,
    });

    // Emit impersonation_start event
    this.authEventService
      .emit({
        userId: session.impersonatorId,
        type: 'impersonation_start',
        scope: 'institute',
        tenantId,
        metadata: {
          target_user_id: targetUserId,
          target_tenant_id: tenantId,
          session_id: sessionId,
        },
      })
      .catch(() => {});

    return {
      accessToken,
      user: {
        id: targetUser.id,
        username: targetUser.username,
      },
      institute: {
        id: institute.id,
        name: institute.name,
      },
    };
  }

  // ── End impersonation ────────────────────────────────────

  async endImpersonation(sessionId: string, userId: string): Promise<void> {
    // Verify the session exists and the user is either the impersonator or the target
    const [session] = await withAdmin(this.db, (tx) =>
      tx
        .select({
          id: impersonationSessions.id,
          impersonatorId: impersonationSessions.impersonatorId,
          targetUserId: impersonationSessions.targetUserId,
          endedAt: impersonationSessions.endedAt,
        })
        .from(impersonationSessions)
        .where(eq(impersonationSessions.id, sessionId))
        .limit(1),
    );

    if (!session) {
      throw new BadRequestException('Impersonation session not found');
    }

    if (session.endedAt) {
      throw new BadRequestException('Impersonation session already ended');
    }

    // Only the impersonator or the target can end the session
    if (session.impersonatorId !== userId && session.targetUserId !== userId) {
      throw new ForbiddenException('Not authorized to end this impersonation session');
    }

    await withAdmin(this.db, (tx) =>
      tx
        .update(impersonationSessions)
        .set({
          endedAt: new Date(),
          endedReason: 'manual',
        })
        .where(eq(impersonationSessions.id, sessionId)),
    );

    // Invalidate session cache so ImpersonationSessionGuard rejects immediately
    await this.redis.del(`${REDIS_KEYS.IMPERSONATION_SESSION}${sessionId}`);

    // Emit impersonation_end event
    this.authEventService
      .emit({
        userId,
        type: 'impersonation_end',
        metadata: { session_id: sessionId, ended_reason: 'manual' },
      })
      .catch(() => {});
  }

  // ── Private: intra-institute validation ──────────────────

  private async validateIntraInstituteImpersonation(
    impersonatorUserId: string,
    tenantId: string,
    targetRoleId: string,
  ): Promise<void> {
    // Get impersonator's membership in this institute
    const [impersonatorMembership] = await withAdmin(this.db, (tx) =>
      tx
        .select({ id: memberships.id, roleId: memberships.roleId })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, impersonatorUserId),
            eq(memberships.tenantId, tenantId),
            eq(memberships.status, 'ACTIVE'),
            isNull(memberships.deletedAt),
          ),
        )
        .limit(1),
    );

    if (!impersonatorMembership) {
      throw new ForbiddenException('No active membership in this institute');
    }

    // Check CASL 'impersonate' ability on 'User'
    const ability = await this.abilityFactory.createForUser({
      userId: impersonatorUserId,
      scope: 'institute',
      tenantId,
      membershipId: impersonatorMembership.id,
      roleId: impersonatorMembership.roleId,
    });

    if (!ability.can('impersonate', 'User')) {
      throw new ForbiddenException('You do not have permission to impersonate users');
    }

    // Verify target role is "below" impersonator's role in hierarchy
    const roleRows = await withAdmin(this.db, (tx) =>
      tx
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(inArray(roles.id, [impersonatorMembership.roleId, targetRoleId])),
    );

    const hierarchy = ['institute_admin', 'principal', 'teacher', 'student', 'parent'];
    const impRole = roleRows.find((r) => r.id === impersonatorMembership.roleId);
    const targetRole = roleRows.find((r) => r.id === targetRoleId);

    if (impRole && targetRole) {
      const impIdx = hierarchy.indexOf((impRole.name as Record<string, string>).en);
      const targetIdx = hierarchy.indexOf((targetRole.name as Record<string, string>).en);

      if (impIdx >= 0 && targetIdx >= 0 && impIdx >= targetIdx) {
        throw new ForbiddenException('Cannot impersonate a user with equal or higher role');
      }
    }
  }

  // ── Private: generate impersonation token ────────────────

  private generateImpersonationToken(opts: {
    targetUserId: string;
    tenantId: string;
    membershipId: string;
    roleId: string;
    impersonatorId: string;
    sessionId: string;
  }): string {
    return this.jwtService.sign(
      {
        sub: opts.targetUserId,
        scope: 'institute',
        tenantId: opts.tenantId,
        membershipId: opts.membershipId,
        roleId: opts.roleId,
        isImpersonated: true,
        impersonatorId: opts.impersonatorId,
        impersonationSessionId: opts.sessionId,
        type: 'access',
      },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: IMPERSONATION_ACCESS_TTL_SECONDS,
      },
    );
  }
}
