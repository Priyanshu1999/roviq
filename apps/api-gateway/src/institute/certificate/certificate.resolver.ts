import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CertificateService } from './certificate.service';
import { ListCertificateFilterInput, RequestCertificateInput } from './dto/request-tc.input';
import { CertificateModel } from './models/tc.model';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver(() => CertificateModel)
export class CertificateResolver {
  constructor(private readonly certService: CertificateService) {}

  @Mutation(() => CertificateModel, {
    description: 'Request a certificate from template — auto-populates fields',
  })
  @CheckAbility('create', 'Certificate')
  async requestCertificate(
    @Args('input') input: RequestCertificateInput,
  ): Promise<CertificateModel> {
    return this.certService.requestCertificate(input) as Promise<CertificateModel>;
  }

  @Mutation(() => CertificateModel, {
    description: 'Issue certificate — generates serial, renders PDF',
  })
  @CheckAbility('manage', 'Certificate')
  async issueCertificate(@Args('id', { type: () => ID }) id: string): Promise<CertificateModel> {
    return this.certService.issueCertificate(id) as Promise<CertificateModel>;
  }

  @Query(() => [CertificateModel], { description: 'List certificates with optional filters' })
  @CheckAbility('read', 'Certificate')
  async listCertificates(
    @Args('filter', { nullable: true }) filter?: ListCertificateFilterInput,
  ): Promise<CertificateModel[]> {
    return this.certService.listCertificates(filter) as Promise<CertificateModel[]>;
  }
}
