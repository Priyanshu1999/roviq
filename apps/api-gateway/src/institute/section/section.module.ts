import { Module } from '@nestjs/common';
import { SectionRepositoryModule } from './repositories/section-repository.module';
import { SectionResolver } from './section.resolver';
import { SectionService } from './section.service';

@Module({
  imports: [SectionRepositoryModule],
  providers: [SectionService, SectionResolver],
  exports: [SectionService],
})
export class SectionModule {}
