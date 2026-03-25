import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { BotTypeEnum, RateLimitTierEnum } from '../models/bot.model';

@InputType()
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

  @IsEnum(RateLimitTierEnum)
  @IsOptional()
  @Field(() => RateLimitTierEnum, { nullable: true, description: 'Rate limit tier for API calls' })
  rateLimitTier?: RateLimitTierEnum;
}
