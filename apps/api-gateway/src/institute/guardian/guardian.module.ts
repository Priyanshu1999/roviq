import { Module } from '@nestjs/common';
import { GuardianResolver } from './guardian.resolver';
import { GuardianService } from './guardian.service';

@Module({
  providers: [GuardianService, GuardianResolver],
  exports: [GuardianService],
})
export class GuardianModule {}
