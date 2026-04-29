import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { AuthEventService } from './auth-event.service';
import { IdentityService } from './identity.service';
import { ImpersonationResolver } from './impersonation.resolver';
import { ImpersonationService } from './impersonation.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginLockoutService } from './login-lockout.service';
import { AuthRepositoryModule } from './repositories/auth-repository.module';
import { InstituteRoleModule } from './role/role.module';
import { WsTicketController } from './ws-ticket.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    AuthRepositoryModule,
    AuditModule,
    InstituteRoleModule,
  ],
  controllers: [WsTicketController],
  providers: [
    AuthService,
    AuthEventService,
    AuthResolver,
    IdentityService,
    ImpersonationService,
    ImpersonationResolver,
    JwtStrategy,
    LoginLockoutService,
  ],
  exports: [
    AuthService,
    AuthEventService,
    IdentityService,
    ImpersonationService,
    LoginLockoutService,
  ],
})
export class AuthModule {}
