import { Module } from '@nestjs/common';
import { AdminAttendanceResolver } from './admin-attendance.resolver';
import { AdminAttendanceService } from './admin-attendance.service';

@Module({
  providers: [AdminAttendanceService, AdminAttendanceResolver],
})
export class AdminAttendanceModule {}
