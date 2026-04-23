import { Module } from '@nestjs/common';
import { AttendanceDrizzleRepository } from './attendance.drizzle-repository';
import { AttendanceRepository } from './attendance.repository';

@Module({
  providers: [{ provide: AttendanceRepository, useClass: AttendanceDrizzleRepository }],
  exports: [AttendanceRepository],
})
export class AttendanceRepositoryModule {}
