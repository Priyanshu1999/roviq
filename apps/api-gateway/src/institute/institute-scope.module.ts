import { Module } from '@nestjs/common';
import { AcademicYearModule } from '../academic-year/academic-year.module';
import { InstituteGroupModule } from '../institute-group/institute-group.module';
import { NotificationConfigModule } from '../notification-config/notification-config.module';
import { AdmissionModule } from './admission/admission.module';
import { AttendanceModule } from './attendance/attendance.module';
import { BotModule } from './bot/bot.module';
import { CertificateModule } from './certificate/certificate.module';
import { ConsentModule } from './consent/consent.module';
import { GroupModule } from './group/group.module';
import { GuardianModule } from './guardian/guardian.module';
import { HolidayModule } from './holiday/holiday.module';
import { InstituteImpersonationModule } from './impersonation/institute-impersonation.module';
import { LeaveModule } from './leave/leave.module';
import { InstituteModule } from './management/institute.module';
import { SectionModule } from './section/section.module';
import { StaffModule } from './staff/staff.module';
import { StandardModule } from './standard/standard.module';
import { StudentModule } from './student/student.module';
import { SubjectModule } from './subject/subject.module';
import { ProfileModule } from './user/profile.module';

@Module({
  imports: [
    AcademicYearModule,
    AdmissionModule,
    AttendanceModule,
    BotModule,
    CertificateModule,
    ConsentModule,
    GroupModule,
    GuardianModule,
    HolidayModule,
    InstituteImpersonationModule,
    InstituteModule,
    InstituteGroupModule,
    LeaveModule,
    NotificationConfigModule,
    ProfileModule,
    SectionModule,
    StaffModule,
    StandardModule,
    StudentModule,
    SubjectModule,
  ],
})
export class InstituteScopeModule {}
