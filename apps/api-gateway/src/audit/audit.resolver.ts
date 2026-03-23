import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import {
  CurrentUser,
  GqlAuthGuard,
  InstituteScopeGuard,
  PlatformScopeGuard,
  ResellerScopeGuard,
} from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { AuditService } from './audit.service';
import { AuditLogFilterInput } from './dto/audit-log-filter.input';
import { AuditLogConnection } from './models/audit-log-connection.model';
import { AuthEventModel } from './models/auth-event.model';

@Resolver()
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  // ── Platform scope ─────────────────────────────────────

  /** Platform admins: see ALL audit logs across every scope and tenant */
  @Query(() => AuditLogConnection)
  @UseGuards(GqlAuthGuard, PlatformScopeGuard, AbilityGuard)
  @CheckAbility('read', 'AuditLog')
  async adminAuditLogs(
    @Args('filter', { nullable: true }) filter?: AuditLogFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<AuditLogConnection> {
    return this.auditService.findAuditLogs({
      filter,
      first: Math.min(first ?? 20, 100),
      after,
    });
  }

  // ── Reseller scope ─────────────────────────────────────

  /** Resellers: see audit logs for their managed institutes + own reseller-scoped entries */
  @Query(() => AuditLogConnection)
  @UseGuards(GqlAuthGuard, ResellerScopeGuard, AbilityGuard)
  @CheckAbility('read', 'AuditLog')
  async resellerAuditLogs(
    @CurrentUser() user: AuthUser,
    @Args('filter', { nullable: true }) filter?: AuditLogFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<AuditLogConnection> {
    return this.auditService.findAuditLogs({
      resellerId: user.resellerId,
      filter,
      first: Math.min(first ?? 20, 100),
      after,
    });
  }

  // ── Institute scope ────────────────────────────────────

  /** Institute admins: see audit logs scoped to their tenant only */
  @Query(() => AuditLogConnection)
  @UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
  @CheckAbility('read', 'AuditLog')
  async auditLogs(
    @CurrentUser() user: AuthUser,
    @Args('filter', { nullable: true }) filter?: AuditLogFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<AuditLogConnection> {
    return this.auditService.findAuditLogs({
      tenantId: user.tenantId,
      filter,
      first: Math.min(first ?? 20, 100),
      after,
    });
  }

  /** Entity audit timeline: view audit trail for a specific entity within the tenant */
  @Query(() => AuditLogConnection)
  @UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
  @CheckAbility('read', 'AuditLog')
  async entityAuditTimeline(
    @CurrentUser() user: AuthUser,
    @Args('entityType') entityType: string,
    @Args('entityId') entityId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<AuditLogConnection> {
    return this.auditService.findAuditLogs({
      tenantId: user.tenantId,
      filter: { entityType, entityId },
      first: Math.min(first ?? 20, 100),
      after,
    });
  }

  // ── Auth events (platform only) ────────────────────────

  /** Auth events: platform admins only — shows login/logout/refresh events across all scopes */
  @Query(() => [AuthEventModel])
  @UseGuards(GqlAuthGuard, PlatformScopeGuard, AbilityGuard)
  @CheckAbility('read', 'AuditLog')
  async authEvents(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 50 }) first?: number,
  ): Promise<AuthEventModel[]> {
    return this.auditService.findAuthEvents(undefined, first ?? 50);
  }
}
