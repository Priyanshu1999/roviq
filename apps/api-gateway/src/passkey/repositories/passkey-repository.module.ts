import { Module } from '@nestjs/common';
import { PlatformDatabaseModule } from '@roviq/nestjs-prisma';
import { AuthProviderPrismaRepository } from './auth-provider.prisma-repository';
import { AuthProviderRepository } from './auth-provider.repository';

@Module({
  imports: [PlatformDatabaseModule],
  providers: [{ provide: AuthProviderRepository, useClass: AuthProviderPrismaRepository }],
  exports: [AuthProviderRepository],
})
export class PasskeyRepositoryModule {}
