import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AdmissionService } from './admission.service';
import { ApplicationResolver } from './application.resolver';
import { EnquiryResolver } from './enquiry.resolver';
import { StudentAdmissionWorkerService } from './workflows/student-admission.worker';

@Module({
  imports: [AuthModule],
  providers: [
    AdmissionService,
    EnquiryResolver,
    ApplicationResolver,
    StudentAdmissionWorkerService,
  ],
  exports: [AdmissionService],
})
export class AdmissionModule {}
