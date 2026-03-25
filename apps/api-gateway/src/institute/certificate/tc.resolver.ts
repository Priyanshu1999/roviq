import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CertificateService } from './certificate.service';
import { ListTCFilterInput, RequestDuplicateTCInput, RequestTCInput } from './dto/request-tc.input';
import { TCModel } from './models/tc.model';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver(() => TCModel)
export class TCResolver {
  constructor(private readonly certService: CertificateService) {}

  @Mutation(() => TCModel, {
    description: 'Request a Transfer Certificate — starts TCIssuanceWorkflow',
  })
  @CheckAbility('create', 'TC')
  async requestTC(@Args('input') input: RequestTCInput): Promise<TCModel> {
    return this.certService.requestTC(input) as Promise<TCModel>;
  }

  @Mutation(() => TCModel, { description: 'Approve a TC (principal only)' })
  @CheckAbility('manage', 'TC')
  async approveTC(@Args('id', { type: () => ID }) id: string): Promise<TCModel> {
    return this.certService.approveTC(id) as Promise<TCModel>;
  }

  @Mutation(() => TCModel, {
    description: 'Issue TC — generates serial, PDF, marks student transferred_out',
  })
  @CheckAbility('manage', 'TC')
  async issueTC(@Args('id', { type: () => ID }) id: string): Promise<TCModel> {
    return this.certService.issueTC(id) as Promise<TCModel>;
  }

  @Query(() => TCModel, { description: 'Get TC details including 20-field CBSE data snapshot' })
  @CheckAbility('read', 'TC')
  async getTCDetails(@Args('id', { type: () => ID }) id: string): Promise<TCModel> {
    return this.certService.getTCDetails(id) as Promise<TCModel>;
  }

  @Query(() => [TCModel], { description: 'List TCs with optional filters' })
  @CheckAbility('read', 'TC')
  async listTCs(
    @Args('filter', { nullable: true }) filter?: ListTCFilterInput,
  ): Promise<TCModel[]> {
    return this.certService.listTCs(filter) as Promise<TCModel[]>;
  }

  @Mutation(() => TCModel, {
    description: 'Request duplicate TC (PRD §5.3) — is_duplicate=true, references original',
  })
  @CheckAbility('create', 'TC')
  async requestDuplicateTC(@Args('input') input: RequestDuplicateTCInput): Promise<TCModel> {
    return this.certService.requestDuplicateTC({
      originalTcId: input.originalTcId,
      reason: input.reason,
      duplicateFee: input.duplicateFee ? BigInt(input.duplicateFee) : undefined,
    }) as Promise<TCModel>;
  }
}
