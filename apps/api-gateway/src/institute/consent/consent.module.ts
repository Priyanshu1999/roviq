import { Module } from '@nestjs/common';
import { ConsentResolver } from './consent.resolver';
import { ConsentService } from './consent.service';

@Module({
  providers: [ConsentService, ConsentResolver],
  exports: [ConsentService],
})
export class ConsentModule {}
