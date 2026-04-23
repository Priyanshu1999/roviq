import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { StaffResolver } from './staff.resolver';
import { StaffService } from './staff.service';
import { StaffQualificationResolver } from './staff-qualification.resolver';
import { StaffQualificationService } from './staff-qualification.service';

@Module({
  imports: [AuthModule],
  providers: [StaffService, StaffResolver, StaffQualificationService, StaffQualificationResolver],
  exports: [StaffService, StaffQualificationService],
})
export class StaffModule {}
