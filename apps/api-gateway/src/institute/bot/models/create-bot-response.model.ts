import { Field, ObjectType } from '@nestjs/graphql';
import type { BotProfileRecord } from '../repositories/types';
import { BotModel } from './bot.model';

@ObjectType()
export class CreateBotResponse {
  @Field(() => BotModel, { description: 'The created bot profile' })
  bot!: BotProfileRecord;

  @Field({ description: 'Plain API key — returned ONCE at creation, never stored' })
  apiKey!: string;
}
