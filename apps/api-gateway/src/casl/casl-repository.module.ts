import { Module } from '@nestjs/common';
import {
  MembershipAbilityPrismaRepository,
  MembershipAbilityRepository,
  RolePrismaRepository,
  RoleRepository,
} from '@roviq/casl';
import { PlatformDatabaseModule } from '@roviq/nestjs-prisma';

@Module({
  imports: [PlatformDatabaseModule],
  providers: [
    { provide: RoleRepository, useClass: RolePrismaRepository },
    { provide: MembershipAbilityRepository, useClass: MembershipAbilityPrismaRepository },
  ],
  exports: [RoleRepository, MembershipAbilityRepository],
})
export class CaslRepositoryModule {}
