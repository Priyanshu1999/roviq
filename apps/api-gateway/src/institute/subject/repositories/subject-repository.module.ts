import { Module } from '@nestjs/common';
import { SubjectDrizzleRepository } from './subject.drizzle-repository';
import { SubjectRepository } from './subject.repository';

@Module({
  providers: [{ provide: SubjectRepository, useClass: SubjectDrizzleRepository }],
  exports: [SubjectRepository],
})
export class SubjectRepositoryModule {}
