import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ResellerTeamResolver } from './reseller-team.resolver';
import { ResellerTeamService } from './reseller-team.service';

@Module({
  imports: [AuthModule],
  providers: [ResellerTeamService, ResellerTeamResolver],
})
export class ResellerTeamModule {}
