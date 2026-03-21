import { Module } from '@nestjs/common';
import { SectionDrizzleRepository } from './section.drizzle-repository';
import { SectionRepository } from './section.repository';

@Module({
  providers: [{ provide: SectionRepository, useClass: SectionDrizzleRepository }],
  exports: [SectionRepository],
})
export class SectionRepositoryModule {}
