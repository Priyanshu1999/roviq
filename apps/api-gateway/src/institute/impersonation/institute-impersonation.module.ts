import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { InstituteImpersonationResolver } from './institute-impersonation.resolver';

@Module({
  imports: [AuthModule], // provides ImpersonationService
  providers: [InstituteImpersonationResolver],
})
export class InstituteImpersonationModule {}
