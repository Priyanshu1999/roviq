import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstituteModule } from '../institute/management/institute.module';
import { InstituteGroupModule } from '../institute-group/institute-group.module';
import { ResellerImpersonationResolver } from './impersonation/reseller-impersonation.resolver';
import { ResellerInstituteResolver } from './institute/reseller-institute.resolver';
import { ResellerInstituteService } from './institute/reseller-institute.service';
import { ResellerInstituteSubscriptionResolver } from './institute/reseller-institute.subscription';
import { ResellerInstituteGroupResolver } from './institute-group/reseller-institute-group.resolver';
import { ResellerInstituteGroupService } from './institute-group/reseller-institute-group.service';
import { ResellerTeamModule } from './team/reseller-team.module';
import { ResellerUserModule } from './user/reseller-user.module';

@Module({
  imports: [
    AuthModule,
    InstituteModule,
    InstituteGroupModule,
    ResellerUserModule,
    ResellerTeamModule,
  ],
  providers: [
    ResellerInstituteSubscriptionResolver,
    ResellerInstituteResolver,
    ResellerInstituteService,
    ResellerInstituteGroupResolver,
    ResellerInstituteGroupService,
    ResellerImpersonationResolver,
  ],
})
export class ResellerModule {}
