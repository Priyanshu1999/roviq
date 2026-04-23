import { Field, InputType } from '@nestjs/graphql';
import { BotRateLimitTier } from '@roviq/common-types';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { BotTypeEnum } from '../models/bot.model';

@InputType({ description: 'Fields required to create a new institute bot integration.' })
export class CreateBotInput {
  @IsEnum(BotTypeEnum)
  @Field(() => BotTypeEnum, { description: 'Bot purpose category' })
  botType!: BotTypeEnum;

  @IsUrl()
  @IsOptional()
  @Field(() => String, { nullable: true, description: 'Webhook URL for outbound event delivery' })
  webhookUrl?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Bot-specific configuration as JSON string',
  })
  @IsString()
  @IsOptional()
  config?: string;

  @IsEnum(BotRateLimitTier)
  @IsOptional()
  @Field(() => BotRateLimitTier, { nullable: true, description: 'Rate limit tier for API calls' })
  rateLimitTier?: BotRateLimitTier;
}
