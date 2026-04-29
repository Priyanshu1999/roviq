import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CertificateService } from './certificate.service';
import { PreviewCertificateInput } from './dto/preview-certificate.input';
import { ListCertificateFilterInput, RequestCertificateInput } from './dto/request-tc.input';
import { CertificateModel } from './models/tc.model';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
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
    return this.certService.requestCertificate(input);
  }

  @Mutation(() => CertificateModel, {
    description: 'Issue certificate — generates serial, renders PDF',
  })
  @CheckAbility('manage', 'Certificate')
  async issueCertificate(@Args('id', { type: () => ID }) id: string): Promise<CertificateModel> {
    return this.certService.issueCertificate(id);
  }

  @Query(() => [CertificateModel], { description: 'List certificates with optional filters' })
  @CheckAbility('read', 'Certificate')
  async listCertificates(
    @Args('filter', { nullable: true }) filter?: ListCertificateFilterInput,
  ): Promise<CertificateModel[]> {
    return this.certService.listCertificates(filter);
  }

  @Query(() => CertificateModel, { description: 'Get a certificate by id' })
  @CheckAbility('read', 'Certificate')
  async getCertificate(@Args('id', { type: () => ID }) id: string): Promise<CertificateModel> {
    return this.certService.findCertificateById(id);
  }

  @Query(() => [String], {
    description:
      'Placeholder field names for a certificate template (auto-populate driver for the Issue Certificate dialog).',
  })
  @CheckAbility('read', 'Certificate')
  async getCertificateTemplateFields(
    @Args('templateId', { type: () => ID }) templateId: string,
  ): Promise<string[]> {
    return this.certService.getCertificateTemplateFields(templateId);
  }

  @Query(() => String, {
    description:
      'Renders a preview HTML for a certificate by substituting student data into the template. No row is persisted.',
  })
  @CheckAbility('read', 'Certificate')
  async previewCertificate(@Args('input') input: PreviewCertificateInput): Promise<string> {
    return this.certService.previewCertificate(input);
  }
}
