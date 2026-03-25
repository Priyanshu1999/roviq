import { Module } from '@nestjs/common';
import { BotResolver } from './bot.resolver';
import { BotService } from './bot.service';
import { BotProfileRepositoryModule } from './repositories/bot-profile-repository.module';

@Module({
  imports: [BotProfileRepositoryModule],
  providers: [BotService, BotResolver],
})
export class BotModule {}
