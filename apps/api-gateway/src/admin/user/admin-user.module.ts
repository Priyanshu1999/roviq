import { Module } from '@nestjs/common';
import { AdminUserResolver } from './admin-user.resolver';
import { AdminUserService } from './admin-user.service';

@Module({
  providers: [AdminUserService, AdminUserResolver],
})
export class AdminUserModule {}
