import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PlatformDatabaseModule } from '@roviq/nestjs-prisma';
import { AuditModule } from '../audit/audit.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({}), PlatformDatabaseModule, AuditModule],
  providers: [AuthService, AuthResolver, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
