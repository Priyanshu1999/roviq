import { Module } from '@nestjs/common';
import { InstituteRoleRepositoryModule } from './repositories/role-repository.module';
import { InstituteRoleResolver } from './role.resolver';
import { InstituteRoleService } from './role.service';

@Module({
  imports: [InstituteRoleRepositoryModule],
  providers: [InstituteRoleService, InstituteRoleResolver],
  exports: [InstituteRoleService],
})
export class InstituteRoleModule {}
