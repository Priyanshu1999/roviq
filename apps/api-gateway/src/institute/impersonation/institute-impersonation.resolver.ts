import { ForbiddenException } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { NoAudit } from '@roviq/audit';
import { CurrentUser, InstituteScope } from '@roviq/auth-backend';
import type { AuthUser } from '@roviq/common-types';
import { StartImpersonationResult } from '../../auth/dto/impersonation.dto';
import { extractMeta, type GqlContext } from '../../auth/gql-context';
import { ImpersonationService } from '../../auth/impersonation.service';

@InstituteScope()
@Resolver()
export class InstituteImpersonationResolver {
  constructor(private readonly impersonationService: ImpersonationService) {}

  @NoAudit()
  @Mutation(() => StartImpersonationResult)
  async impersonateUser(
    @Args('targetUserId') targetUserId: string,
    @Args('reason') reason: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<StartImpersonationResult> {
    if (!user.tenantId) {
      throw new ForbiddenException('Institute scope required for intra-institute impersonation');
    }
    return this.impersonationService.startImpersonation(
      user.userId,
      user.scope,
      targetUserId,
      user.tenantId,
      reason,
      extractMeta(ctx),
    );
  }

  @NoAudit()
  @Mutation(() => Boolean)
  async endImpersonation(
    @Args('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    await this.impersonationService.endImpersonation(sessionId, user.userId);
    return true;
  }
}
