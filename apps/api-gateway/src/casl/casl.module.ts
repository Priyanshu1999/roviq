import { Global, Module } from '@nestjs/common';
import { AbilityFactory } from '@roviq/casl';
import { PlatformDatabaseModule } from '@roviq/nestjs-prisma';
import { AbilityGuard } from './ability.guard';

@Global()
@Module({
  imports: [PlatformDatabaseModule],
  providers: [AbilityFactory, AbilityGuard],
  exports: [AbilityFactory, AbilityGuard],
})
export class CaslModule {}
