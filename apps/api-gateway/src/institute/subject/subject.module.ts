import { Module } from '@nestjs/common';
import { SubjectRepositoryModule } from './repositories/subject-repository.module';
import { SubjectResolver } from './subject.resolver';
import { SubjectService } from './subject.service';

@Module({
  imports: [SubjectRepositoryModule],
  providers: [SubjectService, SubjectResolver],
  exports: [SubjectService],
})
export class SubjectModule {}
