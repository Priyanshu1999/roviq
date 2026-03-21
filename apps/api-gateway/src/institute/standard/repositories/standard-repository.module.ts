import { Module } from '@nestjs/common';
import { StandardDrizzleRepository } from './standard.drizzle-repository';
import { StandardRepository } from './standard.repository';

@Module({
  providers: [{ provide: StandardRepository, useClass: StandardDrizzleRepository }],
  exports: [StandardRepository],
})
export class StandardRepositoryModule {}
