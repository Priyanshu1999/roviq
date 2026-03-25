import { Module } from '@nestjs/common';
import { CertificateResolver } from './certificate.resolver';
import { CertificateService } from './certificate.service';
import { ComplianceExportResolver } from './compliance-export.resolver';
import { TCResolver } from './tc.resolver';

@Module({
  providers: [CertificateService, TCResolver, CertificateResolver, ComplianceExportResolver],
  exports: [CertificateService],
})
export class CertificateModule {}
