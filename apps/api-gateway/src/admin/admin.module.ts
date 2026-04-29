import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstituteModule } from '../institute/management/institute.module';
import { InstituteGroupModule } from '../institute-group/institute-group.module';
import { AdminAttendanceModule } from './attendance/admin-attendance.module';
import { AdminImpersonationResolver } from './impersonation/admin-impersonation.resolver';
import { AdminInstituteLoaders } from './institute/admin-institute.loaders';
import { AdminInstituteResolver } from './institute/admin-institute.resolver';
import { AdminInstituteService } from './institute/admin-institute.service';
import { AdminInstituteSubscriptionResolver } from './institute/admin-institute.subscription';
import { AdminInstituteFieldResolver } from './institute/admin-institute-field.resolver';
import { AdminInstituteGroupResolver } from './institute-group/admin-institute-group.resolver';
import { AdminResellerResolver } from './reseller/admin-reseller.resolver';
import { AdminResellerService } from './reseller/admin-reseller.service';
import { AdminResellerSubscriptionResolver } from './reseller/admin-reseller.subscription';
import { AdminUserModule } from './user/admin-user.module';

@Module({
  imports: [
    AuthModule, // provides AuthEventService
    InstituteGroupModule, // provides InstituteGroupService for admin group operations
    InstituteModule, // provides InstituteService for admin institute operations
    AdminUserModule,
    AdminAttendanceModule, // cross-tenant attendance summary (ROV admin attendance view)
  ],
  providers: [
    AdminResellerService,
    AdminResellerResolver,
    AdminResellerSubscriptionResolver,
    AdminInstituteGroupResolver,
    AdminInstituteService,
    AdminInstituteResolver,
    AdminInstituteFieldResolver, // admin-only resellerName/groupName on InstituteModel
    AdminInstituteLoaders, // request-scoped DataLoaders for the field resolver
    AdminInstituteSubscriptionResolver,
    AdminImpersonationResolver,
  ],
})
export class AdminModule {}
