import { Module } from '@nestjs/common';
import { StaffResolver } from './staff.resolver';
import { StaffService } from './staff.service';

@Module({
  providers: [StaffService, StaffResolver],
  exports: [StaffService],
})
export class StaffModule {}
