import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { extractMeta, type GqlContext } from '../../auth/gql-context';
import { ConsentService } from './consent.service';
import { GrantConsentInput } from './dto/grant-consent.input';
import { WithdrawConsentInput } from './dto/withdraw-consent.input';
import { ConsentRecordModel } from './models/consent-record.model';
import { ConsentStatus } from './models/consent-status.model';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver()
export class ConsentResolver {
  constructor(private readonly consentService: ConsentService) {}

  @Mutation(() => ConsentRecordModel, {
    description: 'Grant parental consent for a data processing purpose (DPDP Act 2023)',
  })
  @CheckAbility('create', 'Consent')
  async grantConsent(
    @Args('input') input: GrantConsentInput,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<ConsentRecordModel> {
    const meta = extractMeta(ctx);
    return this.consentService.grantConsent(user.membershipId, input, {
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    }) as Promise<ConsentRecordModel>;
  }

  @Mutation(() => ConsentRecordModel, {
    description:
      'Withdraw parental consent for a data processing purpose (creates a new append-only record)',
  })
  @CheckAbility('create', 'Consent')
  async withdrawConsent(
    @Args('input') input: WithdrawConsentInput,
    @CurrentUser() user: AuthUser,
    @Context() ctx: GqlContext,
  ): Promise<ConsentRecordModel> {
    const meta = extractMeta(ctx);
    return this.consentService.withdrawConsent(user.membershipId, input, {
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    }) as Promise<ConsentRecordModel>;
  }

  @Query(() => [ConsentStatus], {
    description: 'Get current consent status for all linked children and purposes',
  })
  @CheckAbility('read', 'Consent')
  async myConsentStatus(@CurrentUser() user: AuthUser): Promise<ConsentStatus[]> {
    return this.consentService.myConsentStatus(user.membershipId);
  }
}
