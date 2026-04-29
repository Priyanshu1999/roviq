import { Module } from '@nestjs/common';
import { StandardRepositoryModule } from '../standard/repositories/standard-repository.module';
import { SectionRepositoryModule } from './repositories/section-repository.module';
import { SectionResolver } from './section.resolver';
import { SectionService } from './section.service';

@Module({
  // SS-003: section creation validates the parent standard's `streamApplicable`,
  // so the standard repo is needed at create-time.
  imports: [SectionRepositoryModule, StandardRepositoryModule],
  providers: [SectionService, SectionResolver],
  exports: [SectionService],
})
export class SectionModule {}
