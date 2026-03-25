import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { BotStatusEnum, RateLimitTierEnum } from '../models/bot.model';

@InputType()
export class UpdateBotInput {
  @Field(() => String, {
    nullable: true,
    description: 'Bot-specific configuration as JSON string',
  })
  @IsString()
  @IsOptional()
  config?: string;

  @IsUrl()
  @IsOptional()
  @Field(() => String, { nullable: true, description: 'Webhook URL for outbound event delivery' })
  webhookUrl?: string;

  @IsEnum(RateLimitTierEnum)
  @IsOptional()
  @Field(() => RateLimitTierEnum, { nullable: true, description: 'Rate limit tier for API calls' })
  rateLimitTier?: RateLimitTierEnum;

  @IsEnum(BotStatusEnum)
  @IsOptional()
  @Field(() => BotStatusEnum, { nullable: true, description: 'Bot lifecycle state' })
  status?: BotStatusEnum;
}
