import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { NoAudit } from '@roviq/audit';
import { CurrentUser, ResellerScope } from '@roviq/auth-backend';
import type { AuthUser } from '@roviq/common-types';
import { StartImpersonationResult } from '../../auth/dto/impersonation.dto';
import { extractMeta, type GqlContext } from '../../auth/gql-context';
import { ImpersonationService } from '../../auth/impersonation.service';

@ResellerScope()
@Resolver()
export class ResellerImpersonationResolver {
  constructor(private readonly impersonationService: ImpersonationService) {}

  @NoAudit()
  @Mutation(() => StartImpersonationResult)
  async resellerStartImpersonation(
    @Args('targetUserId') targetUserId: string,
    @Args('targetTenantId') targetTenantId: string,
    @Args('reason') reason: string,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<StartImpersonationResult> {
    return this.impersonationService.startImpersonation(
      user.userId,
      user.scope,
      targetUserId,
      targetTenantId,
      reason,
      extractMeta(ctx),
    );
  }

  @NoAudit()
  @Mutation(() => StartImpersonationResult)
  async resellerVerifyImpersonationOtp(
    @Args('sessionId') sessionId: string,
    @Args('otp') otp: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StartImpersonationResult> {
    return this.impersonationService.verifyOtp(sessionId, otp, user.userId);
  }

  @NoAudit()
  @Mutation(() => Boolean)
  async resellerEndImpersonation(
    @Args('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    await this.impersonationService.endImpersonation(sessionId, user.userId);
    return true;
  }
}
