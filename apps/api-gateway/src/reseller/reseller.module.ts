import { Module } from '@nestjs/common';
import { InstituteModule } from '../institute/management/institute.module';
import { InstituteGroupModule } from '../institute-group/institute-group.module';
import { ResellerInstituteResolver } from './institute/reseller-institute.resolver';
import { ResellerInstituteService } from './institute/reseller-institute.service';
import { ResellerInstituteSubscriptionResolver } from './institute/reseller-institute.subscription';
import { ResellerInstituteGroupResolver } from './institute-group/reseller-institute-group.resolver';
import { ResellerInstituteGroupService } from './institute-group/reseller-institute-group.service';
import { ResellerUserModule } from './user/reseller-user.module';

@Module({
  imports: [InstituteModule, InstituteGroupModule, ResellerUserModule],
  providers: [
    ResellerInstituteSubscriptionResolver,
    ResellerInstituteResolver,
    ResellerInstituteService,
    ResellerInstituteGroupResolver,
    ResellerInstituteGroupService,
  ],
})
export class ResellerModule {}
