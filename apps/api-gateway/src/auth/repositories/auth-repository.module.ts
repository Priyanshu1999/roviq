import { Module } from '@nestjs/common';
import { MembershipDrizzleRepository } from './membership.drizzle-repository';
import { MembershipRepository } from './membership.repository';
import { PlatformMembershipDrizzleRepository } from './platform-membership.drizzle-repository';
import { PlatformMembershipRepository } from './platform-membership.repository';
import { RefreshTokenDrizzleRepository } from './refresh-token.drizzle-repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { ResellerMembershipDrizzleRepository } from './reseller-membership.drizzle-repository';
import { ResellerMembershipRepository } from './reseller-membership.repository';
import { UserDrizzleRepository } from './user.drizzle-repository';
import { UserRepository } from './user.repository';

@Module({
  providers: [
    { provide: UserRepository, useClass: UserDrizzleRepository },
    { provide: MembershipRepository, useClass: MembershipDrizzleRepository },
    { provide: PlatformMembershipRepository, useClass: PlatformMembershipDrizzleRepository },
    { provide: ResellerMembershipRepository, useClass: ResellerMembershipDrizzleRepository },
    { provide: RefreshTokenRepository, useClass: RefreshTokenDrizzleRepository },
  ],
  exports: [
    UserRepository,
    MembershipRepository,
    PlatformMembershipRepository,
    ResellerMembershipRepository,
    RefreshTokenRepository,
  ],
})
export class AuthRepositoryModule {}
