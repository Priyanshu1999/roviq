import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { GuardianResolver } from './guardian.resolver';
import { GuardianService } from './guardian.service';

@Module({
  imports: [AuthModule],
  providers: [GuardianService, GuardianResolver],
  exports: [GuardianService],
})
export class GuardianModule {}
