import { Module } from '@nestjs/common';
import { StandardRepositoryModule } from './repositories/standard-repository.module';
import { StandardResolver } from './standard.resolver';
import { StandardService } from './standard.service';

@Module({
  imports: [StandardRepositoryModule],
  providers: [StandardService, StandardResolver],
  exports: [StandardService],
})
export class StandardModule {}
