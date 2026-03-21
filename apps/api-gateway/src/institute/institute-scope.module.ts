import { Module } from '@nestjs/common';
import { AcademicYearModule } from '../academic-year/academic-year.module';
import { InstituteGroupModule } from '../institute-group/institute-group.module';
import { NotificationConfigModule } from '../notification-config/notification-config.module';
import { InstituteModule } from './management/institute.module';
import { SectionModule } from './section/section.module';
import { StandardModule } from './standard/standard.module';
import { SubjectModule } from './subject/subject.module';

@Module({
  imports: [
    AcademicYearModule,
    InstituteModule,
    InstituteGroupModule,
    NotificationConfigModule,
    SectionModule,
    StandardModule,
    SubjectModule,
  ],
})
export class InstituteScopeModule {}
