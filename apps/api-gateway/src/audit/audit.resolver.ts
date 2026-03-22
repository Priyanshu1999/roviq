import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlAuthGuard } from '@roviq/auth-backend';
import { CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { AuditService } from './audit.service';
import { AuditLogFilterInput } from './dto/audit-log-filter.input';
import { AuditLogConnection } from './models/audit-log-connection.model';
import { AuthEventModel } from './models/auth-event.model';

@Resolver()
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  @Query(() => AuditLogConnection)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('read', 'AuditLog')
  async auditLogs(
    @CurrentUser() user: AuthUser,
    @Args('filter', { nullable: true }) filter?: AuditLogFilterInput,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<AuditLogConnection> {
    if (user.scope === 'reseller') {
      throw new ForbiddenException('Audit logs are not available for reseller scope');
    }
    return this.auditService.findAuditLogs({
      tenantId: user.scope === 'institute' ? user.tenantId : undefined,
      filter,
      first: Math.min(first ?? 20, 100),
      after,
    });
  }

  @Query(() => [AuthEventModel])
  @UseGuards(GqlAuthGuard)
  @CheckAbility('read', 'AuditLog')
  async authEvents(
    @CurrentUser() user: AuthUser,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 50 }) first?: number,
  ): Promise<AuthEventModel[]> {
    if (user.scope === 'reseller') {
      throw new ForbiddenException('Auth events are not available for reseller scope');
    }
    return this.auditService.findAuthEvents(
      user.scope === 'platform' ? undefined : user.tenantId,
      first ?? 50,
    );
  }
}
