import { Global, Module } from '@nestjs/common';
import { AbilityFactory, AbilityGuard } from '@roviq/casl';
import { CaslRepositoryModule } from './casl-repository.module';

@Global()
@Module({
  imports: [CaslRepositoryModule],
  providers: [AbilityFactory, AbilityGuard],
  exports: [AbilityFactory, AbilityGuard],
})
export class CaslModule {}
