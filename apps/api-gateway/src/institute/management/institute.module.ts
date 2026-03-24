import { Module } from '@nestjs/common';
import { InstituteResolver } from './institute.resolver';
import { InstituteService } from './institute.service';
import { InstituteSubscriptionResolver } from './institute.subscription';
import { InstituteRepositoryModule } from './repositories/institute-repository.module';
import { InstituteSeederService } from './seed/institute-seeder.service';
import { InstituteSetupService } from './seed/institute-setup.service';

@Module({
  imports: [InstituteRepositoryModule],
  providers: [
    InstituteService,
    InstituteResolver,
    InstituteSubscriptionResolver,
    InstituteSeederService,
    InstituteSetupService,
  ],
  exports: [
    InstituteService,
    InstituteSeederService,
    InstituteSetupService,
    InstituteRepositoryModule,
  ],
})
export class InstituteModule {}
