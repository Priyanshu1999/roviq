import { Module } from '@nestjs/common';
import { InstituteRoleDrizzleRepository } from './role.drizzle-repository';
import { InstituteRoleRepository } from './role.repository';

@Module({
  providers: [{ provide: InstituteRoleRepository, useClass: InstituteRoleDrizzleRepository }],
  exports: [InstituteRoleRepository],
})
export class InstituteRoleRepositoryModule {}
