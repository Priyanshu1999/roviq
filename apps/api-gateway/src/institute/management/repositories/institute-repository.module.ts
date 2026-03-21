import { Module } from '@nestjs/common';
import { InstituteDrizzleRepository } from './institute.drizzle-repository';
import { InstituteRepository } from './institute.repository';

@Module({
  providers: [{ provide: InstituteRepository, useClass: InstituteDrizzleRepository }],
  exports: [InstituteRepository],
})
export class InstituteRepositoryModule {}
