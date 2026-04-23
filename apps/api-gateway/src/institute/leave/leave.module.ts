import { Module } from '@nestjs/common';
import { LeaveResolver } from './leave.resolver';
import { LeaveService } from './leave.service';
import { LeaveRepositoryModule } from './repositories/leave-repository.module';

@Module({
  imports: [LeaveRepositoryModule],
  providers: [LeaveService, LeaveResolver],
  exports: [LeaveService],
})
export class LeaveModule {}
