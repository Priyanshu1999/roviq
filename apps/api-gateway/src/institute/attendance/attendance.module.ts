import { Module } from '@nestjs/common';
import { HolidayModule } from '../holiday/holiday.module';
import { LeaveModule } from '../leave/leave.module';
import { StudentModule } from '../student/student.module';
import { AttendanceResolver } from './attendance.resolver';
import { AttendanceService } from './attendance.service';
import { AttendanceRepositoryModule } from './repositories/attendance-repository.module';

@Module({
  imports: [AttendanceRepositoryModule, StudentModule, LeaveModule, HolidayModule],
  providers: [AttendanceService, AttendanceResolver],
  exports: [AttendanceService],
})
export class AttendanceModule {}
