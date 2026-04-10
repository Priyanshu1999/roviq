import { Field, InputType } from '@nestjs/graphql';
import { BotRateLimitTier, BotStatus } from '@roviq/common-types';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

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

  @IsEnum(BotRateLimitTier)
  @IsOptional()
  @Field(() => BotRateLimitTier, { nullable: true, description: 'Rate limit tier for API calls' })
  rateLimitTier?: BotRateLimitTier;

  @IsEnum(BotStatus)
  @IsOptional()
  @Field(() => BotStatus, { nullable: true, description: 'Bot lifecycle state' })
  status?: BotStatus;
}
