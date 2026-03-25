import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstituteModule } from '../institute/management/institute.module';
import { InstituteGroupModule } from '../institute-group/institute-group.module';
import { AdminInstituteResolver } from './institute/admin-institute.resolver';
import { AdminInstituteService } from './institute/admin-institute.service';
import { AdminInstituteSubscriptionResolver } from './institute/admin-institute.subscription';
import { AdminInstituteGroupResolver } from './institute-group/admin-institute-group.resolver';
import { AdminResellerResolver } from './reseller/admin-reseller.resolver';
import { AdminResellerService } from './reseller/admin-reseller.service';
import { AdminUserModule } from './user/admin-user.module';

@Module({
  imports: [
    AuthModule, // provides AuthEventService
    InstituteGroupModule, // provides InstituteGroupService for admin group operations
    InstituteModule, // provides InstituteService for admin institute operations
    AdminUserModule,
  ],
  providers: [
    AdminResellerService,
    AdminResellerResolver,
    AdminInstituteGroupResolver,
    AdminInstituteService,
    AdminInstituteResolver,
    AdminInstituteSubscriptionResolver,
  ],
})
export class AdminModule {}
