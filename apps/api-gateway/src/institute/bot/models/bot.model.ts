import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { BotRateLimitTier, BotStatus, BotType } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import GraphQLJSON from 'graphql-type-json';

registerEnumType(BotStatus, { name: 'BotStatus', description: 'Bot lifecycle state.' });
registerEnumType(BotRateLimitTier, {
  name: 'BotRateLimitTier',
  description: 'Rate limit tier for bot API calls.',
});
registerEnumType(BotType, {
  name: 'BotType',
  description: 'Bot purpose category — determines which automated tasks this bot performs.',
});

@ObjectType()
export class BotModel {
  @Field(() => ID)
  id!: string;

  @Field(() => BotType, { description: 'Bot purpose category' })
  botType!: BotType;

  @Field(() => String, {
    nullable: true,
    description: "API key prefix for identification in logs ('skbot_' + first 8 chars)",
  })
  apiKeyPrefix?: string | null;

  @Field(() => BotStatus, { description: 'Bot lifecycle state' })
  status!: BotStatus;

  @Field(() => BotRateLimitTier, { nullable: true, description: 'Rate limit tier for API calls' })
  rateLimitTier?: BotRateLimitTier | null;

  @Field(() => String, { nullable: true, description: 'Webhook URL for outbound event delivery' })
  webhookUrl?: string | null;

  @Field({ description: 'Whether this is a cross-tenant platform bot' })
  isSystemBot!: boolean;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Bot-specific configuration (schedule, templates, AI model config, etc.)',
  })
  config?: unknown;

  @Field(() => DateTimeScalar, {
    nullable: true,
    description: 'Last time the bot made an API call',
  })
  lastActiveAt?: Date | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
