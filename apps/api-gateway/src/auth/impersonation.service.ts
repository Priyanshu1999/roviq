import { randomInt, randomUUID } from 'node:crypto';
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
import { DefaultRoles } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  impersonationSessions,
  institutesLive,
  membershipsLive,
  mkAdminCtx,
  phoneNumbers,
  resellerMemberships,
  rolesLive,
  users,
  withAdmin,
} from '@roviq/database';
import { EventBusService } from '@roviq/event-bus';
import type { AuthSecurityEvent } from '@roviq/notifications';
import { NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { REDIS_CLIENT } from '@roviq/redis';
import { and, eq, sql } from 'drizzle-orm';
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

interface OtpPayload {
  otp: string;
  attempts: number;
}

interface StartImpersonationResult {
  code?: string;
  requiresOtp?: boolean;
  sessionId?: string;
}

/** OTP TTL — 5 minutes */
const OTP_TTL_SECONDS = 300;

/** Maximum OTP verification attempts before key invalidation */
const MAX_OTP_ATTEMPTS = 3;

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
    private readonly eventBus: EventBusService,
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
    const targetUser = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
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
    const targetMembership = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
      tx
        .select({
          id: membershipsLive.id,
          tenantId: membershipsLive.tenantId,
          roleId: membershipsLive.roleId,
        })
        .from(membershipsLive)
        .where(
          and(
            eq(membershipsLive.userId, targetUserId),
            eq(membershipsLive.tenantId, targetTenantId),
            eq(membershipsLive.status, 'ACTIVE'),
          ),
        )
        .limit(1),
    );

    if (targetMembership.length === 0) {
      throw new BadRequestException(
        'Target user has no active membership in the specified institute',
      );
    }

    // Verify target tenant (institute) exists; load consent flag in same query
    const targetInstitute = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
      tx
        .select({
          id: institutesLive.id,
          requireImpersonationConsent: institutesLive.requireImpersonationConsent,
        })
        .from(institutesLive)
        .where(eq(institutesLive.id, targetTenantId))
        .limit(1),
    );

    if (targetInstitute.length === 0) {
      throw new BadRequestException('Target institute not found');
    }

    const requireConsent = targetInstitute[0].requireImpersonationConsent;

    // For reseller scope: verify the reseller owns the target institute
    if (impersonatorScope === 'reseller') {
      // Get the impersonator's reseller ID from their reseller membership
      const [resellerMembership] = await withAdmin(
        this.db,
        mkAdminCtx('service:impersonation'),
        (tx) =>
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
      const [inst] = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
        tx
          .select({ resellerId: institutesLive.resellerId })
          .from(institutesLive)
          .where(eq(institutesLive.id, targetTenantId))
          .limit(1),
      );

      if (!inst || inst.resellerId !== resellerMembership.resellerId) {
        throw new ForbiddenException('Institute does not belong to your reseller');
      }
    }

    // For institute scope: check CASL 'impersonate' ability
    if (impersonatorScope === 'institute') {
      await this.validateIntraInstituteImpersonation(impersonatorUserId, targetTenantId);
    }

    // Create impersonation session
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_SESSION_DURATION_MS);

    const [session] = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
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

    // ── OTP gate ───────────────────────────────────────────
    // Reseller: ALWAYS requires institute-admin OTP approval.
    // Platform: requires OTP only when the institute has opted-in via require_impersonation_consent.
    // Institute (intra-institute): never requires OTP.
    const otpRequired =
      impersonatorScope === 'reseller' || (impersonatorScope === 'platform' && requireConsent);

    if (otpRequired) {
      await this.dispatchImpersonationOtp({
        sessionId: session.id,
        impersonatorUserId,
        targetUserId,
        targetTenantId,
      });
      return { sessionId: session.id, requiresOtp: true };
    }

    // Generate one-time code and store in Redis
    const code = await this.issueImpersonationCode({
      sessionId: session.id,
      targetUserId,
      tenantId: targetTenantId,
    });

    return { code };
  }

  // ── Verify OTP and issue exchange code ───────────────────

  async verifyOtp(
    sessionId: string,
    otp: string,
    impersonatorUserId: string,
  ): Promise<StartImpersonationResult> {
    // SECURITY: bind OTP verification to the authenticated impersonator. The
    // session row records who started the impersonation; without this check
    // any platform/reseller admin could verify any pending OTP given the
    // sessionId and complete an impersonation that was never theirs to start.
    // Resolve the session FIRST so we can authorize the caller before doing
    // any OTP work (no information leak via timing or attempt-counter writes).
    const [session] = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
      tx
        .select({
          id: impersonationSessions.id,
          impersonatorId: impersonationSessions.impersonatorId,
          targetUserId: impersonationSessions.targetUserId,
          targetTenantId: impersonationSessions.targetTenantId,
          endedAt: impersonationSessions.endedAt,
        })
        .from(impersonationSessions)
        .where(eq(impersonationSessions.id, sessionId))
        .limit(1),
    );

    if (!session) {
      throw new UnauthorizedException('Impersonation session not found');
    }
    if (session.impersonatorId !== impersonatorUserId) {
      throw new UnauthorizedException('OTP verification not authorized for this session');
    }
    if (session.endedAt) {
      throw new UnauthorizedException('Impersonation session already ended');
    }
    if (!session.targetTenantId) {
      // OTP-gated impersonation is only meaningful for tenant-scoped sessions.
      throw new UnauthorizedException('Impersonation session has no target tenant');
    }

    const key = `${REDIS_KEYS.IMPERSONATION_OTP}${sessionId}`;
    const stored = await this.redis.get(key);
    if (!stored) {
      throw new UnauthorizedException('OTP expired or not found');
    }

    const payload = JSON.parse(stored) as OtpPayload;

    if (payload.otp !== otp) {
      const attempts = payload.attempts + 1;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.redis.del(key);
        throw new UnauthorizedException('OTP invalid — maximum attempts exceeded');
      }
      const ttl = await this.redis.ttl(key);
      const nextPayload: OtpPayload = { otp: payload.otp, attempts };
      await this.redis.set(key, JSON.stringify(nextPayload), 'EX', ttl > 0 ? ttl : OTP_TTL_SECONDS);
      throw new UnauthorizedException('OTP invalid');
    }

    // Consume OTP
    await this.redis.del(key);

    const code = await this.issueImpersonationCode({
      sessionId: session.id,
      targetUserId: session.targetUserId,
      tenantId: session.targetTenantId,
    });

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
    const [targetUsers, membershipRows, sessions, instituteRows] = await withAdmin(
      this.db,
      mkAdminCtx('service:impersonation'),
      (tx) =>
        Promise.all([
          tx
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(and(eq(users.id, targetUserId), eq(users.status, 'ACTIVE')))
            .limit(1),
          tx
            .select({
              id: membershipsLive.id,
              tenantId: membershipsLive.tenantId,
              roleId: membershipsLive.roleId,
            })
            .from(membershipsLive)
            .where(
              and(
                eq(membershipsLive.userId, targetUserId),
                eq(membershipsLive.tenantId, tenantId),
                eq(membershipsLive.status, 'ACTIVE'),
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
              id: institutesLive.id,
              name: institutesLive.name,
            })
            .from(institutesLive)
            .where(eq(institutesLive.id, tenantId))
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
    const [session] = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
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

    await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
      tx
        .update(impersonationSessions)
        .set({
          endedAt: new Date(),
          endedReason: 'manual',
        })
        .where(eq(impersonationSessions.id, sessionId)),
    );

    // Invalidate session cache so ImpersonationSessionGuard rejects immediately.
    //
    // Race: another request may be mid-way through a cache-miss DB lookup when
    // we hit this point — it has already read the DB row (endedAt still null
    // because that SELECT raced the UPDATE above) and is about to SET the
    // cache entry. A bare `del` would be silently overwritten, keeping an
    // ended session visible as live for up to SESSION_CACHE_TTL.
    //
    // Fix: write a tombstone the guard checks BEFORE its cache read. Any
    // concurrent in-flight guard that subsequently SETs the session cache
    // is harmless — the next guard invocation will see the tombstone and
    // short-circuit. Tombstone TTL (70s) is strictly > SESSION_CACHE_TTL so
    // it cannot expire before the stale cache entry it shadows.
    await Promise.all([
      this.redis.del(`${REDIS_KEYS.IMPERSONATION_SESSION}${sessionId}`),
      this.redis.set(`${REDIS_KEYS.IMPERSONATION_SESSION}${sessionId}:tombstone`, '1', 'EX', 70),
    ]);

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
  ): Promise<void> {
    // Get impersonator's membership in this institute
    const [impersonatorMembership] = await withAdmin(
      this.db,
      mkAdminCtx('service:impersonation'),
      (tx) =>
        tx
          .select({ id: membershipsLive.id, roleId: membershipsLive.roleId })
          .from(membershipsLive)
          .where(
            and(
              eq(membershipsLive.userId, impersonatorUserId),
              eq(membershipsLive.tenantId, tenantId),
              eq(membershipsLive.status, 'ACTIVE'),
            ),
          )
          .limit(1),
    );

    if (!impersonatorMembership) {
      throw new ForbiddenException('No active membership in this institute');
    }

    // Check CASL 'impersonate' ability on 'User'. AbilityFactory resolves the
    // impersonator's role abilities from the DB — only roles that have been
    // explicitly granted `impersonate:User` (e.g. institute_admin) pass this
    // check. This is the authoritative access-control gate; no secondary
    // hardcoded role-name list is needed.
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
  }

  // ── Private: issue exchange code ─────────────────────────

  private async issueImpersonationCode(payload: CodePayload): Promise<string> {
    const code = randomUUID();
    await this.redis.set(
      `${REDIS_KEYS.IMPERSONATION_CODE}${code}`,
      JSON.stringify(payload),
      'EX',
      CODE_TTL_SECONDS,
    );
    return code;
  }

  // ── Private: dispatch impersonation OTP ──────────────────

  private async dispatchImpersonationOtp(opts: {
    sessionId: string;
    impersonatorUserId: string;
    targetUserId: string;
    targetTenantId: string;
  }): Promise<void> {
    // ── Pre-flight validation (Issue 4 — silent-empty-phone fix) ──
    // Resolve the institute admin AND their primary phone BEFORE writing the
    // OTP to Redis. If the admin has no contact phone we cannot deliver the
    // OTP, and the caller would otherwise hang on `requiresOtp: true`
    // forever. Validating up front avoids polluting Redis on a known-bad
    // path.

    // 1. Find the institute_admin for the target tenant
    const [adminRow] = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
      tx
        .select({
          userId: membershipsLive.userId,
        })
        .from(membershipsLive)
        .innerJoin(rolesLive, eq(rolesLive.id, membershipsLive.roleId))
        .where(
          and(
            eq(membershipsLive.tenantId, opts.targetTenantId),
            eq(membershipsLive.status, 'ACTIVE'),
            sql`${rolesLive.name}->>'en' = ${DefaultRoles.InstituteAdmin}`,
          ),
        )
        .limit(1),
    );

    if (!adminRow) {
      // No institute_admin to consent — surface a clear error so the caller can retry/escalate.
      throw new BadRequestException(
        'Cannot request impersonation consent — institute has no active institute_admin',
      );
    }

    // 2. Look up admin's primary phone — fail fast if missing so the caller
    //    isn't stuck waiting on an OTP that can never be delivered.
    const [phoneRow] = await withAdmin(this.db, mkAdminCtx('service:impersonation'), (tx) =>
      tx
        .select({
          countryCode: phoneNumbers.countryCode,
          number: phoneNumbers.number,
        })
        .from(phoneNumbers)
        .where(and(eq(phoneNumbers.userId, adminRow.userId), eq(phoneNumbers.isPrimary, true)))
        .limit(1),
    );

    if (!phoneRow) {
      throw new BadRequestException(
        'Cannot request impersonation consent — institute admin has no contact phone on file',
      );
    }

    const recipientPhone = `${phoneRow.countryCode}${phoneRow.number}`;

    // 3. Generate cryptographically random 6-digit OTP, zero-padded
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');

    // 4. Persist OTP in Redis (5 min TTL) — only after we've confirmed we can
    //    actually deliver it.
    const otpPayload: OtpPayload = { otp, attempts: 0 };
    await this.redis.set(
      `${REDIS_KEYS.IMPERSONATION_OTP}${opts.sessionId}`,
      JSON.stringify(otpPayload),
      'EX',
      OTP_TTL_SECONDS,
    );

    // 5. Emit NATS event — notification-service handles delivery via Novu
    const event: AuthSecurityEvent = {
      tenantId: opts.targetTenantId,
      userId: adminRow.userId,
      eventType: 'IMPERSONATION_OTP',
      metadata: {
        otp,
        recipientPhone,
        purpose: 'impersonation_consent',
        impersonator_id: opts.impersonatorUserId,
        target_user_id: opts.targetUserId,
        session_id: opts.sessionId,
      },
    };
    this.eventBus.emit(NOTIFICATION_SUBJECTS.AUTH_SECURITY, event);
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
