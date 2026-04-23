import { Module } from '@nestjs/common';
import { LeaveModule } from '../leave/leave.module';
import { StudentModule } from '../student/student.module';
import { AttendanceResolver } from './attendance.resolver';
import { AttendanceService } from './attendance.service';
import { AttendanceRepositoryModule } from './repositories/attendance-repository.module';

@Module({
  imports: [AttendanceRepositoryModule, StudentModule, LeaveModule],
  providers: [AttendanceService, AttendanceResolver],
  exports: [AttendanceService],
})
export class AttendanceModule {}
