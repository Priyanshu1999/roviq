import { Field, ObjectType } from '@nestjs/graphql';
import { BotModel } from './bot.model';

@ObjectType()
export class CreateBotResponse {
  @Field(() => BotModel, { description: 'The created bot profile' })
  bot!: BotModel;

  @Field({ description: 'Plain API key — returned ONCE at creation, never stored' })
  apiKey!: string;
}
