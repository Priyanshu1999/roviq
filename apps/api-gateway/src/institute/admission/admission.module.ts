import { Module } from '@nestjs/common';
import { AdmissionService } from './admission.service';
import { ApplicationResolver } from './application.resolver';
import { EnquiryResolver } from './enquiry.resolver';

@Module({
  providers: [AdmissionService, EnquiryResolver, ApplicationResolver],
  exports: [AdmissionService],
})
export class AdmissionModule {}
