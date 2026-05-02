import { Field, InputType } from '@nestjs/graphql';
import { BOT_TYPE_VALUES, BotRateLimitTier, BotType } from '@roviq/common-types';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

@InputType({ description: 'Fields required to create a new institute bot integration.' })
export class CreateBotInput {
  @IsEnum(BOT_TYPE_VALUES)
  @Field(() => BotType, { description: 'Bot purpose category' })
  botType!: BotType;

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
