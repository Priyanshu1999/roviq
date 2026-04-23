import { Module } from '@nestjs/common';
import { LeaveDrizzleRepository } from './leave.drizzle-repository';
import { LeaveRepository } from './leave.repository';

@Module({
  providers: [{ provide: LeaveRepository, useClass: LeaveDrizzleRepository }],
  exports: [LeaveRepository],
})
export class LeaveRepositoryModule {}
