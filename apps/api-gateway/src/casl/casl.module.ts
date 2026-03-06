import { Global, Module } from '@nestjs/common';
import { PlatformDatabaseModule } from '../prisma/platform-database.module';
import { AbilityFactory } from './ability.factory';
import { AbilityGuard } from './ability.guard';

@Global()
@Module({
  imports: [PlatformDatabaseModule],
  providers: [AbilityFactory, AbilityGuard],
  exports: [AbilityFactory, AbilityGuard],
})
export class CaslModule {}
