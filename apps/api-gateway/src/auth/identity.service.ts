import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { hash } from '@node-rs/argon2';
import type { AbilityRule, AuthScope } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  memberships,
  mkAdminCtx,
  mkInstituteCtx,
  mkResellerCtx,
  phoneNumbers,
  platformMemberships,
  resellerMemberships,
  users,
  withAdmin,
  withReseller,
  withTenant,
} from '@roviq/database';
import { NOTIFICATION_SUBJECTS } from '@roviq/notifications';

export interface CreateUserInput {
  /** Email address (placeholder allowed for system-created users without one). */
  email: string;
  /** Roviq ID — must be globally unique. */
  username: string;
  /** Optional initial phone for the user. */
  phone?: { countryCode: string; number: string };
  /** Display name for the welcome message. */
  firstName?: string;
  lastName?: string;
}

export interface CreateUserResult {
  userId: string;
  /** Plaintext temporary password — NEVER stored. Caller may hand this to a delivery channel; default flow ships it via Novu. */
  tempPassword: string;
}

export interface CreateMembershipInput {
  userId: string;
  scope: AuthScope;
  /** Required for scope='institute'. */
  tenantId?: string;
  /** Required for scope='reseller'. */
  resellerId?: string;
  roleId: string;
  abilities?: AbilityRule[];
  actorId: string;
}

export interface CreateMembershipResult {
  membershipId: string;
  scope: AuthScope;
}

export interface CreateUserWithMembershipInput extends CreateUserInput {
  scope: AuthScope;
  tenantId?: string;
  resellerId?: string;
  roleId: string;
  abilities?: AbilityRule[];
  actorId: string;
  /** Skip emitting NOTIFICATION.user.created for cases where the caller emits its own welcome (e.g. bulk import sends a single batch notification). */
  skipWelcomeNotification?: boolean;
}

export interface CreateUserWithMembershipResult extends CreateUserResult, CreateMembershipResult {}

/**
 * Owns every write to the `users`, `memberships`, `platform_memberships`, and
 * `reseller_memberships` tables.
 *
 * Per backend-service skill (Identity Service Integration): institute, reseller
 * and admin services MUST NOT insert into these tables directly — they go
 * through this service. Until a separate Identity microservice is split out the
 * service is in-process; the boundary is the public API of this class, not the
 * transport.
 *
 * Behaviour:
 *  - Generates a 128-bit random temp password and Argon2id-hashes it.
 *  - Sets users.must_change_password = true so the first login is forced
 *    through `changePassword` before any other action.
 *  - Emits NOTIFICATION.user.created with the plaintext temp password so the
 *    notification-service can deliver the welcome SMS/email via Novu.
 *  - Returns the plaintext password for callers that need to surface it
 *    inline (e.g. admin "reset password and show once" flows).
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
    // private readonly authEventService: AuthEventService, // TODO: Add this back in when we have a way to emit the event
  ) {}

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    const tempPassword = randomBytes(16).toString('base64url');
    const passwordHash = await hash(tempPassword);

    const [row] = await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      return tx
        .insert(users)
        .values({
          email: input.email,
          username: input.username,
          passwordHash,
          mustChangePassword: true,
        })
        .returning({ id: users.id });
    });

    if (input.phone) {
      const phone = input.phone;
      await withAdmin(this.db, mkAdminCtx(), async (tx) => {
        await tx
          .insert(phoneNumbers)
          .values({
            userId: row.id,
            countryCode: phone.countryCode,
            number: phone.number,
            isPrimary: true,
            label: 'personal',
          })
          .onConflictDoNothing();
      });
    }

    return { userId: row.id, tempPassword };
  }

  async createMembership(input: CreateMembershipInput): Promise<CreateMembershipResult> {
    if (input.scope === 'institute') {
      if (!input.tenantId) throw new Error('tenantId is required for institute-scope membership');
      const tenantId = input.tenantId;
      const [row] = await withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
        return tx
          .insert(memberships)
          .values({
            userId: input.userId,
            tenantId,
            roleId: input.roleId,
            status: 'ACTIVE',
            abilities: input.abilities ?? [],
            createdBy: input.actorId,
            updatedBy: input.actorId,
          })
          .returning({ id: memberships.id });
      });
      return { membershipId: row.id, scope: 'institute' };
    }

    if (input.scope === 'reseller') {
      if (!input.resellerId)
        throw new Error('resellerId is required for reseller-scope membership');
      const resellerId = input.resellerId;
      const [row] = await withReseller(this.db, mkResellerCtx(resellerId), async (tx) => {
        return tx
          .insert(resellerMemberships)
          .values({
            userId: input.userId,
            resellerId,
            roleId: input.roleId,
            isActive: true,
            abilities: input.abilities ?? [],
          })
          .returning({ id: resellerMemberships.id });
      });
      return { membershipId: row.id, scope: 'reseller' };
    }

    // platform
    const [row] = await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      return tx
        .insert(platformMemberships)
        .values({
          userId: input.userId,
          roleId: input.roleId,
          isActive: true,
          abilities: input.abilities ?? [],
        })
        .returning({ id: platformMemberships.id });
    });
    return { membershipId: row.id, scope: 'platform' };
  }

  async createUserWithMembership(
    input: CreateUserWithMembershipInput,
  ): Promise<CreateUserWithMembershipResult> {
    const userResult = await this.createUser({
      email: input.email,
      username: input.username,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    const membership = await this.createMembership({
      userId: userResult.userId,
      scope: input.scope,
      tenantId: input.tenantId,
      resellerId: input.resellerId,
      roleId: input.roleId,
      abilities: input.abilities,
      actorId: input.actorId,
    });

    if (!input.skipWelcomeNotification) {
      this.emitWelcomeNotification({
        userId: userResult.userId,
        username: input.username,
        email: input.email,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        tempPassword: userResult.tempPassword,
        scope: input.scope,
        tenantId: input.tenantId,
        resellerId: input.resellerId,
      });
    }

    return { ...userResult, ...membership };
  }

  private emitWelcomeNotification(payload: {
    userId: string;
    username: string;
    email: string;
    phone?: { countryCode: string; number: string };
    firstName?: string;
    lastName?: string;
    tempPassword: string;
    scope: AuthScope;
    tenantId?: string;
    resellerId?: string;
  }): void {
    this.natsClient
      .emit(NOTIFICATION_SUBJECTS.USER_CREATED, {
        userId: payload.userId,
        scope: payload.scope,
        tenantId: payload.tenantId ?? null,
        resellerId: payload.resellerId ?? null,
        username: payload.username,
        email: payload.email,
        phone: payload.phone ? `${payload.phone.countryCode}${payload.phone.number}` : null,
        firstName: payload.firstName ?? null,
        lastName: payload.lastName ?? null,
        tempPassword: payload.tempPassword,
        mustChangePassword: true,
      })
      .subscribe({
        error: (err) =>
          this.logger.warn(`Failed to emit NOTIFICATION.user.created: ${String(err)}`),
      });
  }
}
