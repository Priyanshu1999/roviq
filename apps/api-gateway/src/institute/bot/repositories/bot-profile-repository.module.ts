import { Module } from '@nestjs/common';
import { BotProfileDrizzleRepository } from './bot-profile.drizzle-repository';
import { BotProfileRepository } from './bot-profile.repository';

@Module({
  providers: [{ provide: BotProfileRepository, useClass: BotProfileDrizzleRepository }],
  exports: [BotProfileRepository],
})
export class BotProfileRepositoryModule {}
